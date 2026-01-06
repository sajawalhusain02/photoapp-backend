const express = require("express");
const multer = require("multer");
const blobServiceClient = require("../config/blobClient");
const { requireAuth, requireRole } = require("../middleware/auth");
const cosmosClient = require("../config/cosmosClient");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post(
  "/",
  requireAuth,
  requireRole("creator"),
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          error: 'No file received. Field name must be "image".',
        });
      }

      // 1) Upload to Blob
      const containerName = process.env.BLOB_CONTAINER_ORIGINAL;
      const containerClient = blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists();

      const safeName = (req.file.originalname || "upload").replace(/[^\w.\-]/g, "_");
      const blobName = `${Date.now()}-${safeName}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.uploadData(req.file.buffer, {
        blobHTTPHeaders: {
          blobContentType: req.file.mimetype || "application/octet-stream",
        },
      });

      const blobUrl = blockBlobClient.url;

      // 2) Save metadata to Cosmos (media container)
      const db = cosmosClient.database(process.env.COSMOS_DB_NAME); // photoapp
      const mediaContainer = db.container("media");

      const doc = {
        id: uuidv4(),
        blobName,
        blobUrl,
        title: req.body.title || "",
        caption: req.body.caption || "",
        location: req.body.location || "",
        people: req.body.people || "",
        createdAt: new Date().toISOString(),
        createdBy: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
        },
      };

      await mediaContainer.items.create(doc);

      return res.json({
        ok: true,
        message: "Photo uploaded and saved to Cosmos",
        fileName: blobName,
        url: blobUrl,
        media: doc,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: err.message || "Upload failed" });
    }
  }
);

module.exports = router;
