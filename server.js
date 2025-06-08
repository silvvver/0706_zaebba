// ВАЖНО: dotenv ДО ВСЕГО!
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import analyzeRoute from "./routes/analyze.js";

const app = express();

// Поддержка CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN
    ? process.env.ALLOWED_ORIGIN.split(/\s*,\s*/)
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
  // DEBUG! Показываем ключ (на проде убери строку!)
  // console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY);
});
