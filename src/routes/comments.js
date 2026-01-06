const express = require("express");
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

async function getCommentsContainer() {
  const { database } = await client.databases.createIfNotExists({
    id: process.env.COSMOS_DB_NAME,
  });

  const { container } = await database.containers.createIfNotExists({
    id: "comments",
    partitionKey: { paths: ["/photoId"] },
  });

  return container;
}

// GET /api/comments?photoId=...
router.get("/", async (req, res) => {
  try {
    const { photoId } = req.query;
    if (!photoId) return res.status(400).json({ error: "photoId required" });

    const container = await getCommentsContainer();

    const query = {
      query: "SELECT * FROM c WHERE c.photoId = @photoId ORDER BY c.createdAt DESC",
      parameters: [{ name: "@photoId", value: photoId }],
    };

    const { resources } = await container.items.query(query).fetchAll();
    res.json({ ok: true, items: resources });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/comments  (consumer only)
router.post("/", requireAuth, requireRole("consumer"), async (req, res) => {
  try {
    const { photoId, text } = req.body;
    if (!photoId || !text) return res.status(400).json({ error: "photoId and text required" });

    const container = await getCommentsContainer();

    const doc = {
      id: uuidv4(),
      photoId,
      text: String(text).trim(),
      createdAt: new Date().toISOString(),
      createdBy: { id: req.user.id, email: req.user.email, role: req.user.role },
    };

    await container.items.create(doc);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
