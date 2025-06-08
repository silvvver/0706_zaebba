/* routes/analyze.js */
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

const __filename  = fileURLToPath(import.meta.url);
const __dirname   = path.dirname(__filename);
const PROMPTS_DIR = path.join(__dirname, "..", "prompts");

const router = Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Принимаются только изображения")),
});

const freeLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max     : 500,
  standardHeaders: true,
  legacyHeaders  : false,
  keyGenerator   : (req) => req.ip,
  skip           : (req) => req?.body?.plan === "paid",
  message        : { error: "Лимит 3 бесплатных анализов в сутки. Выберите полный анализ." },
});

router.post(
  "/",
  upload.single("handImage"),
  freeLimiter,
  async (req, res) => {
    const tempPath = req.file?.path;
    console.log("=== Новый запрос ===");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("File:", req.file);
    if (!tempPath) {
      console.log("❌ Файл не получен");
      return res.status(400).json({ error: "Файл не получен" });
    }

    try {
      const meta = await sharp(tempPath).metadata();
      console.log("Image meta:", meta);

      if (!meta.width || meta.width < 300) {
        console.log("❌ Фото слишком маленькое");
        throw new Error("Фото слишком маленькое или тёмное. Попробуйте ближе и при хорошем свете.");
      }

      const isPaid      = req.body?.plan === "paid";
      const promptFile  = path.join(PROMPTS_DIR, isPaid ? "paid.txt" : "free.txt");
      const systemPrompt = await fs.readFile(promptFile, "utf8");

      const userPrompt = isPaid
        ? "Проанализируй ладонь максимально подробно (≥ 2500 символов)."
        : "Дай краткий (≤ 350 символов) персональный комментарий:\n• эпитет\n• линия жизни\n• линия головы\n• линия сердца";

      const jpeg = await sharp(tempPath).jpeg({ quality: 92 }).toBuffer();

      // Логируем вызов askVision
      console.log("Вызываем askVision...");

      const { answer: full, usage, isPalm } = await askVision(
        jpeg,
        req.file.originalname,
        `${systemPrompt}\n\n${userPrompt}`
      );

      console.log("askVision →", { isPalm, hasFull: !!full, usage });

      if (!isPalm) {
        console.log("❌ На фото нет ладони (isPalm = false)");
        return res.status(422).json({
          error: "К сожалению, я не вижу ладонь на этом изображении. " +
                 "Пожалуйста, загрузите чёткое фото внутренней стороны кисти.",
          palm : false,
        });
      }

      if (!full) {
        console.log("❌ GPT вернул пустой ответ");
        throw new Error("GPT вернул пустой ответ");
      }

      const teaser =
        full
          .replace(/\s+/g, " ")
          .split(/(?<=[.!?])\s+/)
          .slice(0, 2)
          .join(" ")
          .slice(0, 350)
          .trimEnd() + " …";

      // Успех
      res.json({ teaser, full, usage });

    } catch (err) {
      console.error("❌ analyze:", err.message, err.stack || "");
      res.status(500).json({ error: err.message });
    } finally {
      tempPath && fs.unlink(tempPath).catch(() => {});
    }
  }
);

export default router;
