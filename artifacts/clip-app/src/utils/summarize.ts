import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AiDepth, AiModules, AiProvider } from "../storage/clips";

const TIMEOUT_MS = 30000;
const YANDEX_FOLDER_ID_KEY = "@clip:yandex_folder_id";

// Per-provider character limits for the analysis input. Values picked to stay
// well under each provider's context window with room for the system prompt
// and the model's reply.
const PROVIDER_LIMITS: Record<AiProvider, number> = {
  gemini: 50000,   // 1M токенов контекст
  claude: 50000,   // 200K токенов контекст
  deepseek: 50000, // 128K токенов контекст
  openai: 30000,   // 128K токенов контекст
  yandex: 20000,   // 32K токенов контекст
};
const SOFT_LIMIT = 15000; // мягкий лимит по умолчанию (если провайдер неизвестен)
// Hard ceiling — reserved as the upper bound for any text we ever pass to a
// provider, even if a future config raises the per-provider limits.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const HARD_LIMIT = 50000;

const TRUNCATE_MARKER = "\n\n[...фрагмент статьи пропущен...]\n\n";

/**
 * Truncate a long text in a "smart" way: keep 70% from the start (intro and
 * key theses) and 30% from the end (conclusions), with an explicit
 * "fragment skipped" marker between them. Cuts on word boundaries so we don't
 * leave a half-word at the seams.
 *
 * The output length is strictly <= `limit` — the marker length is reserved
 * from the budget. If the limit is so small the marker doesn't fit, the
 * function falls back to a hard slice from the start.
 */
export function smartTruncate(text: string, limit: number): string {
  if (limit <= 0) return "";
  if (text.length <= limit) return text;

  // Marker doesn't fit + meaningful padding → hard-cut from the start.
  if (limit <= TRUNCATE_MARKER.length + 10) {
    return text.slice(0, limit);
  }

  // Reserve marker length so the final string never exceeds `limit`.
  const budget = limit - TRUNCATE_MARKER.length;
  const startPart = Math.floor(budget * 0.7);
  // Guard against `endPart === 0`, which would silently flip
  // `text.slice(-0)` into `text.slice(0)` and return the entire text.
  const endPart = Math.max(1, budget - startPart);

  const start = text.slice(0, startPart);
  const end = text.slice(-endPart);

  // Cut on word boundaries — fall back to the raw slice if there is no space.
  const lastSpaceStart = start.lastIndexOf(" ");
  const startClean = lastSpaceStart > 0 ? start.slice(0, lastSpaceStart) : start;
  const firstSpaceEnd = end.indexOf(" ");
  const endClean = firstSpaceEnd >= 0 ? end.slice(firstSpaceEnd + 1) : end;

  return startClean + TRUNCATE_MARKER + endClean;
}

export function getMaxTokens(
  depth: "quick" | "standard" | "deep",
  modules: AiModules
): number {
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

function buildSystemPrompt(depth: AiDepth): string {
  return `Ты помогаешь пользователю извлекать знания из статей и постов. Отвечай на русском языке. ${depthInstruction(depth)}`;
}

function buildUserPrompt(text: string, modules: AiModules): string {
  const sections: string[] = [];
  if (modules.keyIdeas) {
    sections.push(
      "**Ключевые идеи**\nДля каждой ключевой идеи пиши по структуре:\n- Одно предложение: что утверждает автор\n- 2-3 предложения: почему это неочевидно или удивительно, какой контекст объясняет эту идею\n- Одно предложение: почему это важно или что это меняет\n\nНе просто называй идею — объясняй её так, чтобы человек который не читал статью почувствовал «ааа, понял» а не «ну и что». Избегай голых тезисов без раскрытия."
    );
  }
  if (modules.terms) {
    sections.push(
      "**Термины и понятия**\nОбъясни сложные термины и концепции простым языком."
    );
  }
  if (modules.aiPerspective) {
    sections.push(
      "**Взгляд AI**\nТвоя оценка материала: что важно, что спорно, что упущено."
    );
  }
  if (modules.questions) {
    sections.push(
      "**Вопросы для размышления**\nСформулируй 2-3 вопроса которые этот материал поднимает."
    );
  }
  if (modules.practical) {
    sections.push(
      "**Практическое применение**\nКак эти идеи можно применить на практике."
    );
  }

  return `Проанализируй этот текст и ответь по следующим пунктам:\n\n${sections.join("\n\n")}\n\nТекст: ${text}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface SummarizeResult {
  text: string;
  truncated: boolean;
}

type ProviderResult = SummarizeResult | "AUTH_ERROR" | null;

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<ProviderResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  if (res.status === 401 || res.status === 403) return "AUTH_ERROR";
  const data = await res.json().catch((e) => ({ _parseError: e.message }));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const finishReason = data?.candidates?.[0]?.finishReason;
  const truncated = finishReason === "MAX_TOKENS";
  return typeof text === "string" && text.trim() ? { text: text.trim(), truncated } : null;
}

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<ProviderResult> {
  const url = "https://api.anthropic.com/v1/messages";
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (res.status === 401 || res.status === 403) return "AUTH_ERROR";
  const data = await res.json().catch((e) => ({ _parseError: e.message }));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  const text = data?.content?.[0]?.text;
  const finishReason = data?.stop_reason;
  const truncated = finishReason === "max_tokens";
  return typeof text === "string" && text.trim() ? { text: text.trim(), truncated } : null;
}

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<ProviderResult> {
  const url = "https://api.openai.com/v1/chat/completions";
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (res.status === 401 || res.status === 403) return "AUTH_ERROR";
  const data = await res.json().catch((e) => ({ _parseError: e.message }));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  const text = data?.choices?.[0]?.message?.content;
  const finishReason = data?.choices?.[0]?.finish_reason;
  const truncated = finishReason === "length";
  return typeof text === "string" && text.trim() ? { text: text.trim(), truncated } : null;
}

async function callDeepSeek(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<ProviderResult> {
  const url = "https://api.deepseek.com/chat/completions";
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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
  const data = await res.json().catch((e) => ({ _parseError: e.message }));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  const text = data?.choices?.[0]?.message?.content;
  const finishReason = data?.choices?.[0]?.finish_reason;
  const truncated = finishReason === "length";
  return typeof text === "string" && text.trim() ? { text: text.trim(), truncated } : null;
}

async function callYandex(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<ProviderResult> {
  const folderId = (await AsyncStorage.getItem(YANDEX_FOLDER_ID_KEY))?.trim();
  if (!folderId) {
    throw new Error("Не указан FolderID для YandexGPT. Заполни его в настройках.");
  }
  const url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Api-Key ${apiKey}`,
    },
    body: JSON.stringify({
      modelUri: `gpt://${folderId}/yandexgpt-lite`,
      completionOptions: {
        stream: false,
        temperature: 0.6,
        maxTokens: String(maxTokens),
      },
      messages: [
        { role: "system", text: systemPrompt },
        { role: "user", text: userPrompt },
      ],
    }),
  });
  if (res.status === 401 || res.status === 403) return "AUTH_ERROR";
  const data = await res.json().catch((e) => ({ _parseError: e.message }));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  const text = data?.result?.alternatives?.[0]?.message?.text;
  const finishReason = data?.result?.alternatives?.[0]?.status;
  const truncated = finishReason === "ALTERNATIVE_STATUS_TRUNCATED_FINAL";
  return typeof text === "string" && text.trim() ? { text: text.trim(), truncated } : null;
}

export async function summarizeContent(
  text: string,
  provider: AiProvider,
  apiKey: string,
  depth: AiDepth,
  modules: AiModules,
  overrideMaxTokens?: number
): Promise<SummarizeResult | "AUTH_ERROR" | null> {
  // No active modules — nothing to summarize
  const anyActive =
    modules.keyIdeas ||
    modules.terms ||
    modules.aiPerspective ||
    modules.questions ||
    modules.practical;
  if (!anyActive) return null;

  // Trim the input to the provider's safe character limit before building
  // the prompt — this keeps long articles within the model's context window.
  const providerLimit = PROVIDER_LIMITS[provider] ?? SOFT_LIMIT;
  const truncatedText = smartTruncate(text, providerLimit);

  const systemPrompt = buildSystemPrompt(depth);
  const userPrompt = buildUserPrompt(truncatedText, modules);
  const maxTokens = overrideMaxTokens ?? getMaxTokens(depth, modules);

  try {
    let raw: ProviderResult = null;
    if (provider === "gemini") {
      raw = await callGemini(apiKey, systemPrompt, userPrompt, maxTokens);
    } else if (provider === "claude") {
      raw = await callClaude(apiKey, systemPrompt, userPrompt, maxTokens);
    } else if (provider === "openai") {
      raw = await callOpenAI(apiKey, systemPrompt, userPrompt, maxTokens);
    } else if (provider === "deepseek") {
      raw = await callDeepSeek(apiKey, systemPrompt, userPrompt, maxTokens);
    } else if (provider === "yandex") {
      raw = await callYandex(apiKey, systemPrompt, userPrompt, maxTokens);
    }
    return raw;
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : "AI request failed";
    console.error("AI error:", msg);
    throw new Error(msg);
  }
}
