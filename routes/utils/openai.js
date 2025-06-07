/* routes/utils/openai.js
   ──────────────────────
   Один «универсальный» хелпер: askVision()
   • делает GPT-Vision-запрос
   • на первой строке просит модель честно ответить yes/no ― ладонь ли это
   • возвращает { answer, isPalm, usage }
*/
import { OpenAI } from "openai";
import dotenv     from "dotenv";
dotenv.config();

// >>> Вставь debug-вывод переменной окружения
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);

const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL_ID = process.env.MODEL_ID || "gpt-4o";

/**
 * @param {Buffer} imageBuffer — JPEG/PNG-буфер
 * @param {string} filename    — исходное имя (необязательно, но бывает полезно)
 * @param {string} prompt      — полный system+user-prompt
 */
export async function askVision(imageBuffer, filename, prompt) {
  const imageBase64 = imageBuffer.toString("base64");

  const messages = [
    {
      role: "system",
      content:
        "Ты — мастер-хиpоман. Сначала ответь одним словом «yes» или «no» на вопрос: " +
        "видна ли на изображении человеческая ладонь? " +
        "После этого (с новой строки) дай ответ пользователю.",
    },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type:  "image_url",
          image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" },
        },
      ],
    },
  ];

  const chat = await openai.chat.completions.create({
    model: MODEL_ID,
    max_tokens: 2048,
    messages,
  });

  const raw   = chat.choices?.[0]?.message?.content?.trim() || "";
  const [first, ...rest] = raw.split(/\n+/);
  const isPalm = /^yes\b/i.test(first.trim());      // ← GPT сказала «yes»?

  return {
    answer : rest.join("\n").trim(),  // то, что после первой строки
    isPalm,
    usage  : chat.usage,              // пригодится для логов/аналитики
  };
}
