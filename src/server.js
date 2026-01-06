require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { BlobServiceClient } = require("@azure/storage-blob");
const { CosmosClient } = require("@azure/cosmos");

const uploadRoute = require("./routes/upload");
const mediaRoute = require("./routes/media");
const authRoutes = require("./routes/auth");

const photosRoutes = require("./routes/photos");
const commentsRoutes = require("./routes/comments");
const ratingsRoutes = require("./routes/ratings");

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ FIX: use regex for OPTIONS (works with your version)
app.options(/.*/, cors());

app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/upload", uploadRoute);
app.use("/api/media", mediaRoute);

app.use("/api/photos", photosRoutes);
app.use("/api/comments", commentsRoutes);
app.use("/api/ratings", ratingsRoutes);

app.get("/", (req, res) => {
  res.send("PhotoApp Backend Running...");
});

app.get("/health", async (req, res) => {
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );

    const containers = [];
    for await (const c of blobServiceClient.listContainers()) {
      containers.push(c.name);
    }

    const cosmosClient = new CosmosClient({
      endpoint: process.env.COSMOS_ENDPOINT,
      key: process.env.COSMOS_KEY,
    });

    const { resource: db } = await cosmosClient
      .database(process.env.COSMOS_DB_NAME)
      .read();

    res.json({
      ok: true,
      blobContainersFound: containers,
      cosmosDbFound: db?.id || null,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
