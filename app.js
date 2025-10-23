require("dotenv").config();
const express = require("express");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGO_URI);
let collection;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db("myDatabase");
    collection = db.collection("recipes");
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ Error connecting to MongoDB:", err);
  }
}
connectDB();

// Simple route
app.get("/", (req, res) => {
  res.send("Server is running and connected to MongoDB!");
});

// Example: get all recipes
app.get("/recipes", async (req, res) => {
  try {
    const recipes = await collection.find().toArray();
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch recipes" });
  }
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
