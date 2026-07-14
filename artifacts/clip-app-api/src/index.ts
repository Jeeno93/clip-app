import "dotenv/config";
import cors from "cors";
import express from "express";

const PORT = process.env.PORT || 80;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Daily caps — deliberately small. A shared free pool is bot bait; a small
// daily trickle per device is nearly invisible to a real user (a couple of
// analyses a day) but makes scripted draining low-value (has to run for
// weeks to add up to anything, instead of one request against a giant pool).
const DAILY_LIMIT_PER_DEVICE = 2;
const DAILY_LIMIT_PER_IP = 10;

type AiDepth = "quick" | "standard" | "deep";
interface AiModules {
  keyIdeas: boolean;
  terms: boolean;
  aiPerspective: boolean;
  questions: boolean;
  practical: boolean;
}

interface QuotaEntry {
  count: number;
  day: string; // YYYY-MM-DD, UTC
}

// In-memory only — quota resets naturally at UTC midnight, and an occasional
// reset from a redeploy is an acceptable trade for not needing a DB just to
// throttle a free tier at this scale.
const deviceQuota = new Map<string, QuotaEntry>();
const ipQuota = new Map<string, QuotaEntry>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function checkAndConsume(store: Map<string, QuotaEntry>, key: string, limit: number): { allowed: boolean; remaining: number } {
  const today = todayKey();
  const entry = store.get(key);
  if (!entry || entry.day !== today) {
    store.set(key, { count: 1, day: today });
    return { allowed: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count };
}

function peekRemaining(store: Map<string, QuotaEntry>, key: string, limit: number): number {
  const today = todayKey();
  const entry = store.get(key);
  if (!entry || entry.day !== today) return limit;
  return Math.max(0, limit - entry.count);
}

const TRUNCATE_MARKER = "\n\n[...фрагмент статьи пропущен...]\n\n";
const DEEPSEEK_CHAR_LIMIT = 50000;

function smartTruncate(text: string, limit: number): string {
  if (limit <= 0) return "";
  if (text.length <= limit) return text;
  if (limit <= TRUNCATE_MARKER.length + 10) return text.slice(0, limit);
  const budget = limit - TRUNCATE_MARKER.length;
  const startPart = Math.floor(budget * 0.7);
  const endPart = Math.max(1, budget - startPart);
  const start = text.slice(0, startPart);
  const end = text.slice(-endPart);
  const lastSpaceStart = start.lastIndexOf(" ");
  const startClean = lastSpaceStart > 0 ? start.slice(0, lastSpaceStart) : start;
  const firstSpaceEnd = end.indexOf(" ");
  const endClean = firstSpaceEnd >= 0 ? end.slice(firstSpaceEnd + 1) : end;
  return startClean + TRUNCATE_MARKER + endClean;
}

function getMaxTokens(depth: AiDepth, modules: AiModules): number {
  const activeModules = Object.values(modules).filter(Boolean).length;
  const base = { quick: 800, standard: 1500, deep: 2500 }[depth];
  const extra = Math.max(0, activeModules - 1) * 400;
  return Math.min(base + extra, 4000);
}

function depthInstruction(depth: AiDepth): string {
  switch (depth) {
    case "quick":
      return "Отвечай кратко, 1-2 предложения на каждый пункт.";
    case "standard":
      return "Отвечай развёрнуто, 2-4 предложения на каждый пункт.";
    case "deep":
      return "Отвечай детально и глубоко, не ограничивай себя объёмом.";
  }
}

function buildSystemPrompt(depth: AiDepth, contentTypeHint?: string): string {
  const typeHint = contentTypeHint ? ` Тип материала: ${contentTypeHint}` : "";
  return `Ты помогаешь пользователю извлекать знания из статей и постов. Отвечай на русском языке. ${depthInstruction(depth)}${typeHint}`;
}

function buildUserPrompt(text: string, modules: AiModules): string {
  const sections: string[] = [];
  if (modules.keyIdeas) {
    sections.push(
      "**Ключевые идеи**\nДля каждой ключевой идеи пиши по структуре:\n- Одно предложение: что утверждает автор\n- 2-3 предложения: почему это неочевидно или удивительно, какой контекст объясняет эту идею\n- Одно предложение: почему это важно или что это меняет\n\nНе просто называй идею — объясняй её так, чтобы человек который не читал статью почувствовал «ааа, понял» а не «ну и что». Избегай голых тезисов без раскрытия."
    );
  }
  if (modules.terms) {
    sections.push("**Термины и понятия**\nОбъясни сложные термины и концепции простым языком.");
  }
  if (modules.aiPerspective) {
    sections.push("**Взгляд AI**\nТвоя оценка материала: что важно, что спорно, что упущено.");
  }
  if (modules.questions) {
    sections.push("**Вопросы для размышления**\nСформулируй 2-3 вопроса которые этот материал поднимает.");
  }
  if (modules.practical) {
    sections.push("**Практическое применение**\nКак эти идеи можно применить на практике.");
  }
  return `Проанализируй этот текст и ответь по следующим пунктам:\n\n${sections.join("\n\n")}\n\nТекст: ${text}`;
}

async function callDeepSeek(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<{ text: string; truncated: boolean } | "AUTH_ERROR" | null> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (res.status === 401 || res.status === 403) return "AUTH_ERROR";
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
  const text = data?.choices?.[0]?.message?.content;
  const truncated = data?.choices?.[0]?.finish_reason === "length";
  return typeof text === "string" && text.trim() ? { text: text.trim(), truncated } : null;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", hasKey: !!DEEPSEEK_API_KEY });
});

app.get("/api/analyze/quota", (req, res) => {
  const deviceId = String(req.query.deviceId || "");
  if (!deviceId) return res.status(400).json({ error: "deviceId required" });
  const remaining = peekRemaining(deviceQuota, deviceId, DAILY_LIMIT_PER_DEVICE);
  res.json({ remaining, limit: DAILY_LIMIT_PER_DEVICE });
});

app.post("/api/analyze", async (req, res) => {
  if (!DEEPSEEK_API_KEY) {
    return res.status(503).json({ error: "server_not_configured" });
  }

  const { deviceId, text, depth, modules, contentTypeHint } = req.body as {
    deviceId?: string;
    text?: string;
    depth?: AiDepth;
    modules?: AiModules;
    contentTypeHint?: string;
  };

  if (!deviceId || typeof deviceId !== "string") {
    return res.status(400).json({ error: "deviceId required" });
  }
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text required" });
  }
  if (!depth || !modules) {
    return res.status(400).json({ error: "depth and modules required" });
  }
  const anyActive = Object.values(modules).some(Boolean);
  if (!anyActive) {
    return res.status(400).json({ error: "no active modules" });
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown";

  const deviceCheck = checkAndConsume(deviceQuota, deviceId, DAILY_LIMIT_PER_DEVICE);
  if (!deviceCheck.allowed) {
    return res.status(429).json({ error: "quota_exceeded", remaining: 0 });
  }
  const ipCheck = checkAndConsume(ipQuota, ip, DAILY_LIMIT_PER_IP);
  if (!ipCheck.allowed) {
    return res.status(429).json({ error: "quota_exceeded", remaining: 0 });
  }

  try {
    const truncatedText = smartTruncate(text, DEEPSEEK_CHAR_LIMIT);
    const systemPrompt = buildSystemPrompt(depth, contentTypeHint);
    const userPrompt = buildUserPrompt(truncatedText, modules);
    const maxTokens = getMaxTokens(depth, modules);

    const result = await callDeepSeek(systemPrompt, userPrompt, maxTokens);

    if (result === "AUTH_ERROR") {
      console.error("DeepSeek auth error — server key may be invalid/revoked");
      return res.status(502).json({ error: "provider_error" });
    }
    if (!result) {
      return res.status(502).json({ error: "empty_response" });
    }

    res.json({
      text: result.text,
      truncated: result.truncated,
      timedOut: false,
      remaining: deviceCheck.remaining,
    });
  } catch (err: any) {
    console.error("Analyze error:", err?.message || err);
    res.status(502).json({ error: "provider_error" });
  }
});

app.listen(PORT, () => {
  console.log(`clip-app-api listening on port ${PORT}`);
});
