const express = require("express");
const cosmosClient = require("../config/cosmosClient");
const { requireAuth } = require("../middleware/auth");
const { getBlobSasUrl } = require("../utils/sas");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const db = cosmosClient.database(process.env.COSMOS_DB_NAME);
    const container = db.container(process.env.COSMOS_CONTAINER_MEDIA);

    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "10", 10);
    const offset = (page - 1) * limit;

    const query = {
      query: "SELECT * FROM c ORDER BY c.createdAt DESC OFFSET @o LIMIT @l",
      parameters: [
        { name: "@o", value: offset },
        { name: "@l", value: limit },
      ],
    };

    const { resources } = await container.items.query(query).fetchAll();

    const items = resources.map((m) => {
      const blobName = m.blobName;
      const imageUrl = blobName
        ? getBlobSasUrl(process.env.BLOB_CONTAINER_ORIGINAL, blobName)
        : null;

      return {
        ...m,
        imageUrl, // ✅ frontend should use this
      };
    });

    res.json({
      ok: true,
      page,
      limit,
      count: items.length,
      items,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
