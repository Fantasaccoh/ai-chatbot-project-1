require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { MongoClient } = require("mongodb");
const OpenAI = require("openai");
const path = require("path");


const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;


const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);


let db, usersCollection, sessionsCollection;

async function connectDB() {
  const client = new MongoClient(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  await client.connect();
  db = client.db("chatbotDB"); // database name
  usersCollection = db.collection("users");
  sessionsCollection = db.collection("sessions");
  console.log("Connected to MongoDB!");
}

connectDB().catch((err) => {
  console.error("Error connecting to MongoDB:", err);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  const existingUser = await usersCollection.findOne({ username });
  if (existingUser) return res.status(400).send("Username already exists");

  await usersCollection.insertOne({ username, password });
  req.session.username = username;
  res.send({ success: true });
});


app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await usersCollection.findOne({ username, password });
  if (!user) return res.status(400).send("Invalid credentials");

  req.session.username = username;
  res.send({ success: true });
});

app.get("/history", async (req, res) => {
  if (!req.session.username) return res.status(401).send("Unauthorized");
  const history = await sessionsCollection
    .find({ username: req.session.username })
    .toArray();
  res.send(history);
});

app.post("/chat", async (req, res) => {
  if (!req.session.username) return res.status(401).send("Unauthorized");
  const { message } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
    });

    const responseText = completion.choices[0].message.content;

    await sessionsCollection.insertOne({
      username: req.session.username,
      userMessage: message,
      botResponse: responseText,
      timestamp: new Date(),
    });

    res.send({ response: responseText });
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).send("Error generating response");
  }
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
