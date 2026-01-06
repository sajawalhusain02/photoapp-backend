const express = require("express");
const { CosmosClient } = require("@azure/cosmos");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

async function getRatingsContainer() {
  const { database } = await client.databases.createIfNotExists({
    id: process.env.COSMOS_DB_NAME,
  });

  const { container } = await database.containers.createIfNotExists({
    id: "ratings",
    partitionKey: { paths: ["/photoId"] },
  });

  return container;
}

// GET /api/ratings?photoId=...
router.get("/", async (req, res) => {
  try {
    const { photoId } = req.query;
    if (!photoId) return res.status(400).json({ error: "photoId required" });

    const container = await getRatingsContainer();

    const query = {
      query: "SELECT c.rating FROM c WHERE c.photoId = @photoId",
      parameters: [{ name: "@photoId", value: photoId }],
    };

    const { resources } = await container.items.query(query).fetchAll();
    const values = resources
      .map((r) => Number(r.rating))
      .filter((v) => Number.isFinite(v));

    const count = values.length;
    const avg = count ? values.reduce((a, b) => a + b, 0) / count : 0;

    res.json({ ok: true, photoId, avg, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ratings  (consumer only) { photoId, rating: 1..5 }
router.post("/", requireAuth, requireRole("consumer"), async (req, res) => {
  try {
    const { photoId, rating } = req.body;
    const r = Number(rating);

    if (!photoId) return res.status(400).json({ error: "photoId required" });
    if (!Number.isInteger(r) || r < 1 || r > 5)
      return res.status(400).json({ error: "rating must be integer 1..5" });

    const container = await getRatingsContainer();

    const doc = {
      id: `${photoId}:${req.user.id}`,
      photoId,
      userId: req.user.id,
      rating: r,
      updatedAt: new Date().toISOString(),
    };

    await container.items.upsert(doc);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
