const express = require("express");
const cosmosClient = require("../config/cosmosClient");

const router = express.Router();

const db = cosmosClient.database(process.env.COSMOS_DB_NAME);
const mediaContainer = db.container(process.env.COSMOS_CONTAINER_MEDIA || "media");

/**
 * GET /api/photos
 * Query params:
 *  - q (search title/caption/location/people)
 *  - page (default 1)
 *  - limit (default 10)
 */
router.get("/", async (req, res) => {
  try {
    const q = (req.query.q || "").trim().toLowerCase();
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "10", 10);
    const offset = (page - 1) * limit;

    let querySpec;

    if (q) {
      querySpec = {
        query: `
          SELECT * FROM c
          WHERE CONTAINS(LOWER(c.title), @q)
             OR CONTAINS(LOWER(c.caption), @q)
             OR CONTAINS(LOWER(c.location), @q)
             OR CONTAINS(LOWER(c.people), @q)
          ORDER BY c.createdAt DESC
          OFFSET @offset LIMIT @limit
        `,
        parameters: [
          { name: "@q", value: q },
          { name: "@offset", value: offset },
          { name: "@limit", value: limit },
        ],
      };
    } else {
      querySpec = {
        query: `
          SELECT * FROM c
          ORDER BY c.createdAt DESC
          OFFSET @offset LIMIT @limit
        `,
        parameters: [
          { name: "@offset", value: offset },
          { name: "@limit", value: limit },
        ],
      };
    }

    const { resources } = await mediaContainer.items.query(querySpec).fetchAll();

    res.json({
      ok: true,
      page,
      limit,
      count: resources.length,
      items: resources,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/photos/:id
 * view single photo metadata
 */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // query by id (no partition key assumptions)
    const querySpec = {
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    };

    const { resources } = await mediaContainer.items.query(querySpec).fetchAll();
    if (!resources.length) return res.status(404).json({ ok: false, message: "Not found" });

    res.json({ ok: true, item: resources[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
