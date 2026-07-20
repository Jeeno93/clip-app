import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AiDepth, AiModules, AiProvider } from "../storage/clips";

const YANDEX_FOLDER_ID_KEY = "@clip:yandex_folder_id";

function getTimeoutMs(textLength: number, depth: AiDepth): number {
  const base =
    depth === "deep" ? 60000 : depth === "standard" ? 45000 : 30000;
  const extra = Math.max(0, Math.floor((textLength - 10000) / 5000)) * 10000;
  return Math.min(base + extra, 120000);
}

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
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface SummarizeResult {
  text: string;
  truncated: boolean;
  timedOut: boolean;
}

type ProviderResult = SummarizeResult | "AUTH_ERROR" | null;

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  timeoutMs: number
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
  }, timeoutMs);
  if (res.status === 401 || res.status === 403) return "AUTH_ERROR";
  const data = await res.json().catch((e) => ({ _parseError: e.message }));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const finishReason = data?.candidates?.[0]?.finishReason;
  const truncated = finishReason === "MAX_TOKENS";
  return typeof text === "string" && text.trim() ? { text: text.trim(), truncated, timedOut: false } : null;
}

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  timeoutMs: number
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
  }, timeoutMs);
  if (res.status === 401 || res.status === 403) return "AUTH_ERROR";
  const data = await res.json().catch((e) => ({ _parseError: e.message }));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  const text = data?.content?.[0]?.text;
  const finishReason = data?.stop_reason;
  const truncated = finishReason === "max_tokens";
  return typeof text === "string" && text.trim() ? { text: text.trim(), truncated, timedOut: false } : null;
}

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  timeoutMs: number
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
  }, timeoutMs);
  if (res.status === 401 || res.status === 403) return "AUTH_ERROR";
  const data = await res.json().catch((e) => ({ _parseError: e.message }));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  const text = data?.choices?.[0]?.message?.content;
  const finishReason = data?.choices?.[0]?.finish_reason;
  const truncated = finishReason === "length";
  return typeof text === "string" && text.trim() ? { text: text.trim(), truncated, timedOut: false } : null;
}

async function callDeepSeek(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  timeoutMs: number
): Promise<ProviderResult> {
  const url = "https://api.deepseek.com/chat/completions";
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // deepseek-chat депрекейтится 24.07.2026 — v4-flash в non-thinking
      // режиме (по умолчанию, без параметра thinking) это прямая замена.
      model: "deepseek-v4-flash",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  }, timeoutMs);
  if (res.status === 401 || res.status === 403) return "AUTH_ERROR";
  const data = await res.json().catch((e) => ({ _parseError: e.message }));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  const text = data?.choices?.[0]?.message?.content;
  const finishReason = data?.choices?.[0]?.finish_reason;
  const truncated = finishReason === "length";
  return typeof text === "string" && text.trim() ? { text: text.trim(), truncated, timedOut: false } : null;
}

async function callYandex(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  timeoutMs: number
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
  }, timeoutMs);
  if (res.status === 401 || res.status === 403) return "AUTH_ERROR";
  const data = await res.json().catch((e) => ({ _parseError: e.message }));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  const text = data?.result?.alternatives?.[0]?.message?.text;
  const finishReason = data?.result?.alternatives?.[0]?.status;
  const truncated = finishReason === "ALTERNATIVE_STATUS_TRUNCATED_FINAL";
  return typeof text === "string" && text.trim() ? { text: text.trim(), truncated, timedOut: false } : null;
}

const CLIP_API_URL = process.env.EXPO_PUBLIC_CLIP_API_URL;

export type ProxySummarizeResult =
  | (SummarizeResult & { remaining: number })
  | "AUTH_ERROR"
  | "QUOTA_EXCEEDED"
  | "NOT_CONFIGURED"
  | null;

/**
 * Free-tier path for users without their own API key. Calls clip-app-api,
 * which holds the real provider key server-side and enforces the daily
 * quota itself — the client never sees a secret, unlike the old
 * BUILT_IN_API_KEY approach.
 */
export async function summarizeViaProxy(
  text: string,
  depth: AiDepth,
  modules: AiModules,
  deviceId: string,
  contentTypeHint?: string
): Promise<ProxySummarizeResult> {
  if (!CLIP_API_URL) return "NOT_CONFIGURED";

  // Таймаут простоя соединения на Envoy короче, чем ~5 минут, которые OkHttp
  // держит соединение в пуле, поэтому к моменту, когда пользователь дочитал
  // карточку и нажал «Анализировать», соединение, которое OkHttp хочет
  // переиспользовать, уже может быть мертво на сервере — и POST просто
  // зависает. В отличие от опроса квоты (только чтение), ретраить сам вызов
  // анализа небезопасно — сервер списывает квоту до того, как сформирован
  // ответ, поэтому «завис → повторили» может сжечь оба дневных бесплатных
  // анализа на одном нестабильном соединении. Пинг /health перед этим —
  // дешёвый, не мутирующий способ вытеснить протухшее соединение, чтобы
  // реальный POST ушёл по заведомо живому.
  try {
    await fetchWithTimeout(`${CLIP_API_URL}/health`, { method: "GET" }, 5000);
  } catch {}

  const timeoutMs = getTimeoutMs(text.length, depth);
  try {
    const res = await fetchWithTimeout(
      `${CLIP_API_URL}/api/analyze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, text, depth, modules, contentTypeHint }),
      },
      timeoutMs
    );
    if (res.status === 429) return "QUOTA_EXCEEDED";
    if (res.status === 503) return "NOT_CONFIGURED";
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    if (typeof data?.text !== "string" || !data.text.trim()) return null;
    return {
      text: data.text.trim(),
      truncated: !!data.truncated,
      timedOut: false,
      remaining: typeof data.remaining === "number" ? data.remaining : 0,
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return { text: "", truncated: false, timedOut: true, remaining: 0 };
    }
    throw new Error(typeof error?.message === "string" ? error.message : "Proxy request failed");
  }
}

async function fetchQuotaOnce(deviceId: string): Promise<Response> {
  return fetchWithTimeout(
    `${CLIP_API_URL}/api/analyze/quota?deviceId=${encodeURIComponent(deviceId)}`,
    { method: "GET" },
    10000
  );
}

export async function getProxyQuotaRemaining(deviceId: string): Promise<number | null> {
  if (!CLIP_API_URL) return null;
  try {
    let res: Response;
    try {
      res = await fetchQuotaOnce(deviceId);
    } catch (error: any) {
      // Android-овский OkHttp держит соединения в пуле до 5 минут простоя —
      // дольше, чем таймаут простоя на Envoy, поэтому переиспользованное
      // соединение может быть мертво ещё до отправки, и запрос просто висит,
      // пока его не оборвёт наш собственный таймаут. Неудачная попытка
      // вытесняет это соединение из пула OkHttp, так что повтор почти всегда
      // получает свежее. Ретраить безопасно: этот GET только читает — в
      // отличие от POST-анализа, он не может дважды списать дневную квоту.
      if (error?.name !== "AbortError") throw error;
      res = await fetchQuotaOnce(deviceId);
    }
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return typeof data?.remaining === "number" ? data.remaining : null;
  } catch {
    return null;
  }
}

export async function summarizeContent(
  text: string,
  provider: AiProvider,
  apiKey: string,
  depth: AiDepth,
  modules: AiModules,
  overrideMaxTokens?: number,
  contentTypeHint?: string
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

  const systemPrompt = buildSystemPrompt(depth, contentTypeHint);
  const userPrompt = buildUserPrompt(truncatedText, modules);
  const maxTokens = overrideMaxTokens ?? getMaxTokens(depth, modules);
  const timeoutMs = getTimeoutMs(text.length, depth);

  try {
    let raw: ProviderResult = null;
    if (provider === "gemini") {
      raw = await callGemini(apiKey, systemPrompt, userPrompt, maxTokens, timeoutMs);
    } else if (provider === "claude") {
      raw = await callClaude(apiKey, systemPrompt, userPrompt, maxTokens, timeoutMs);
    } else if (provider === "openai") {
      raw = await callOpenAI(apiKey, systemPrompt, userPrompt, maxTokens, timeoutMs);
    } else if (provider === "deepseek") {
      raw = await callDeepSeek(apiKey, systemPrompt, userPrompt, maxTokens, timeoutMs);
    } else if (provider === "yandex") {
      raw = await callYandex(apiKey, systemPrompt, userPrompt, maxTokens, timeoutMs);
    }
    return raw;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return { text: "", truncated: false, timedOut: true };
    }
    const msg = typeof error?.message === "string" ? error.message : "AI request failed";
    console.error("AI error:", msg);
    throw new Error(msg);
  }
}
