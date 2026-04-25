import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AiDepth, AiModules, AiProvider } from "../storage/clips";

const TIMEOUT_MS = 30000;
const YANDEX_FOLDER_ID_KEY = "@clip:yandex_folder_id";

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
      "**Ключевые идеи**\nВыдели главные мысли автора. Сколько идей — столько сколько есть, не больше и не меньше."
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

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: { maxOutputTokens: 1500 },
    }),
  });
  if (res.status === 401 || res.status === 403) return "AUTH_ERROR";
  const data = await res.json().catch((e) => ({ _parseError: e.message }));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
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
      max_tokens: 1500,
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
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  const url = "https://api.openai.com/v1/chat/completions";
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1500,
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
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

async function callDeepSeek(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  const url = "https://api.deepseek.com/chat/completions";
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 1500,
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
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

async function callYandex(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
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
        maxTokens: "1500",
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
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

export async function summarizeContent(
  text: string,
  provider: AiProvider,
  apiKey: string,
  depth: AiDepth,
  modules: AiModules
): Promise<string | null> {
  // No active modules — nothing to summarize
  const anyActive =
    modules.keyIdeas ||
    modules.terms ||
    modules.aiPerspective ||
    modules.questions ||
    modules.practical;
  if (!anyActive) return null;

  const systemPrompt = buildSystemPrompt(depth);
  const userPrompt = buildUserPrompt(text, modules);

  try {
    if (provider === "gemini") {
      return await callGemini(apiKey, systemPrompt, userPrompt);
    }
    if (provider === "claude") {
      return await callClaude(apiKey, systemPrompt, userPrompt);
    }
    if (provider === "openai") {
      return await callOpenAI(apiKey, systemPrompt, userPrompt);
    }
    if (provider === "deepseek") {
      return await callDeepSeek(apiKey, systemPrompt, userPrompt);
    }
    if (provider === "yandex") {
      return await callYandex(apiKey, systemPrompt, userPrompt);
    }
    return null;
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : "AI request failed";
    console.error("AI error:", msg);
    throw new Error(msg);
  }
}
