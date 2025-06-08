import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import analyzeRoute from "./routes/analyze.js";

dotenv.config();

const app = express();

// Поддержка CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(/\s*,\s*/)
    : "*",
  credentials: true,
}));

// Парсер json и urlencoded (на всякий случай)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Только API! — никаких статик и fallback!
app.use("/analyze", analyzeRoute);

// Только ошибки (404)
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🔮  Backend online  →  http://localhost:${PORT}`);
});
