require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

console.log("Environment check:");
console.log("- PORT:", process.env.PORT);
console.log("- MONGO_DB_URL:", process.env.MONGO_DB_URL ? "Set" : "Missing");
console.log("- GROQ_API_KEY:", process.env.GROQ_API_KEY ? "Set" : "Missing");

const app = express();

// connect to MongoDB
const mongoUrl = process.env.MONGO_DB_URL;
if (mongoUrl) {
  mongoose.connect(mongoUrl)
    .then(() => console.log("MongoDB connected successfully"))
    .catch(err => console.error("MongoDB connection error:", err.message));
} else {
  console.warn("MONGO_DB_URL not set. Running without DB.");
}

app.use(cors());
app.use(express.json());

const authRoutes = require("./routes/auth");
const resumeRoutes = require("./routes/resume");

app.use("/api/auth", authRoutes);
app.use("/api/resume", resumeRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});