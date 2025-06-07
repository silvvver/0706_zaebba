// server.js (ES‑modules version)
import express from "express";
import path, { dirname } from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

import analyzeRoute from "./routes/analyze.js";

dotenv.config();

// ────────────────────────────────────────────────────────────
// Helpers for __dirname / __filename in ES‑modules
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
// ────────────────────────────────────────────────────────────

const app = express();
app.set("trust proxy", 1);   // чтобы express-rate-limit не ругался


// 1) Устанавливаем безопасные HTTP‑заголовки
app.use(helmet());

// 2) Логи HTTP‑запросов (combined — как в Nginx)
app.use(morgan("combined"));

// 3) CORS: список доменов берём из .env  (ALLOWED_ORIGINS=a.com,b.com)
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(/\s*,\s*/)
      : "*",
    methods: ["GET", "POST"],
  })
);

// 4) Rate‑limit: ≤30 запросов с IP за 15 минут
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// 5) Отдаём статику из ./public (index.html, css, js)
app.use(express.static(path.join(__dirname, "public")));

// 6) API‑роут для анализа ладони
app.use("/analyze", analyzeRoute);

// 7) Fallback: любое GET → index.html (SPA‑подход)
app.get("/*", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🔮  Backend online  →  http://localhost:${PORT}`)
);
