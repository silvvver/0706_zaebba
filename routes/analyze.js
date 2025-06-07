/* routes/analyze.js
   ─────────────────
   multer → freeLimiter (IP-based, 3/day) → обработка.
   Если GPT говорит, что это НЕ ладонь, отдаём 422 и блокируем «платный» флоу.
*/
import { Router }        from "express";
import multer            from "multer";
import fs                from "fs/promises";
import sharp             from "sharp";
import path              from "path";
import { fileURLToPath } from "url";
import dotenv            from "dotenv";
import rateLimit         from "express-rate-limit";

import { askVision }     from "./utils/openai.js";

dotenv.config();

/* ───────── paths ───────── */
const __filename  = fileURLToPath(import.meta.url);
const __dirname   = path.dirname(__filename);
const PROMPTS_DIR = path.join(__dirname, "..", "prompts");   // free.txt / paid.txt

/* ───────── router ───────── */
const router = Router();

/* ───────── Multer: ≤5 МБ, только картинки ───────── */
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Принимаются только изображения")),
});

/* ───────── 3 бесплатных попытки/сутки ───────── */
const freeLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max     : 500,
  standardHeaders: true,
  legacyHeaders  : false,
  keyGenerator   : (req) => req.ip,
  skip           : (req) => req?.body?.plan === "paid",   // тело уже распарсено
  message        : { error: "Лимит 3 бесплатных анализов в сутки. Выберите полный анализ." },
});

/* ───────── /analyze ───────── */
router.post(
  "/",
  upload.single("handImage"),   // 1️⃣  multer (распарсит form-data и тело)
  freeLimiter,                  // 2️⃣  тарифный лимитер
  async (req, res) => {
    const tempPath = req.file?.path;
    if (!tempPath) return res.status(400).json({ error: "Файл не получен" });

    try {
      /* ----------- минимальная проверка размера ----------- */
      const meta = await sharp(tempPath).metadata();
      if (!meta.width || meta.width < 300) {
        throw new Error("Фото слишком маленькое или тёмное. Попробуйте ближе и при хорошем свете.");
      }

      /* ----------- выбираем prompt ----------- */
      const isPaid      = req.body?.plan === "paid";
      const promptFile  = path.join(PROMPTS_DIR, isPaid ? "paid.txt" : "free.txt");
      const systemPrompt = await fs.readFile(promptFile, "utf8");

      const userPrompt = isPaid
        ? "Проанализируй ладонь максимально подробно (≥ 2500 символов)."
        : "Дай краткий (≤ 350 символов) персональный комментарий:\n" +
          "• эпитет\n• линия жизни\n• линия головы\n• линия сердца";

      /* ----------- GPT-Vision ----------- */
      const jpeg = await sharp(tempPath).jpeg({ quality: 92 }).toBuffer();
      const { answer: full, usage, isPalm } = await askVision(
        jpeg,
        req.file.originalname,
        `${systemPrompt}\n\n${userPrompt}`
      );

      /* ----------- если это НЕ ладонь ----------- */
      if (!isPalm) {
        return res.status(422).json({
          error: "К сожалению, я не вижу ладонь на этом изображении. " +
                 "Пожалуйста, загрузите чёткое фото внутренней стороны кисти.",
          palm : false,
        });
      }

      if (!full) throw new Error("GPT вернул пустой ответ");

      /* ----------- teaser + full ----------- */
      const teaser =
        full
          .replace(/\s+/g, " ")
          .split(/(?<=[.!?])\s+/)
          .slice(0, 2)
          .join(" ")
          .slice(0, 350)
          .trimEnd() + " …";

      res.json({ teaser, full, usage });

    } catch (err) {
      console.error("❌ analyze:", err.message);
      res.status(500).json({ error: err.message });
    } finally {
      tempPath && fs.unlink(tempPath).catch(() => {});
    }
  }
);

export default router;
