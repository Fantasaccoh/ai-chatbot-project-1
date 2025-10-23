const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
const { Configuration, OpenAIApi } = require("openai");
require("dotenv").config();

const app = express();


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, "public")));


const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
let usersCollection;
let sessionsCollection;

async function connectDB() {
  await client.connect();
  const db = client.db("chatbotDB");
  usersCollection = db.collection("users");
  sessionsCollection = db.collection("chatSessions");
  console.log("✅ Connected to MongoDB Atlas");
}

connectDB();


const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY
}));


app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  const userExists = await usersCollection.findOne({ username });
  if (userExists) return res.status(400).send("User already exists");

  const hashed = await bcrypt.hash(password, 10);
  await usersCollection.insertOne({ username, password: hashed });
  res.send("Signup successful");
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await usersCollection.findOne({ username });
  if (!user) return res.status(400).send("Invalid username");

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).send("Invalid password");

  req.session.userId = user._id;
  res.send("Login successful");
});


function authMiddleware(req, res, next) {
  if (!req.session.userId) return res.status(401).send("Not logged in");
  next();
}

app.post("/chat", authMiddleware, async (req, res) => {
  const { message } = req.body;

  try {

    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: message }]
    });

    const botResponse = response.data.choices[0].message.content;


    await sessionsCollection.insertOne({
      userId: req.session.userId,
      message,
      response: botResponse,
      createdAt: new Date()
    });

    res.json({ response: botResponse });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error communicating with OpenAI");
  }
});

app.get("/history", authMiddleware, async (req, res) => {
  const history = await sessionsCollection.find({ userId: req.session.userId }).toArray();
  res.json(history);
});

app.get("/chat.html", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "public/chat.html"));
});


app.post("/logout", authMiddleware, (req, res) => {
  req.session.destroy();
  res.send("Logged out");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
