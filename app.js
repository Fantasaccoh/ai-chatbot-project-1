require("dotenv").config(); 
const express = require("express");
const path = require("path");
const { MongoClient } = require("mongodb");
const session = require("express-session");
const { Configuration, OpenAIApi } = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "secret",
  resave: false,
  saveUninitialized: true,
}));
app.use(express.static(path.join(__dirname, "public"))); // serve static files from public folder

const mongoUri = process.env.MONGO_URI;
let db;

async function connectDB() {
  try {
    const client = new MongoClient(mongoUri, {
      serverApi: { version: "1" }, 
    });
    await client.connect();
    db = client.db(); 
    console.log("Connected to MongoDB!");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
}


const openaiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(openaiConfig);

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: message }],
    });
    res.json({ reply: response.data.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OpenAI request failed" });
  }
});


app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});


connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
