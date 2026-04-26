import AsyncStorage from "@react-native-async-storage/async-storage";

const CLIPS_KEY = "@clip:clips";
const STREAK_KEY = "@clip:streak";
const SETTINGS_KEY = "@clip:settings";
const DAILY_CARDS_KEY = "@clip:daily_cards";
const DAILY_DATE_KEY = "@clip:daily_date";

export const FREE_LIMIT = 100;

export interface Clip {
  id: string;
  text: string;
  title?: string;
  imageUri: string | null;
  source: string;
  tags: string[];
  createdAt: string;
  linkPreview?: {
    title: string;
    description: string | null;
    imageUrl: string | null;
    url: string;
    fullText?: string;
  };
  summary?: string;
}

export type AiProvider = "gemini" | "claude" | "openai" | "deepseek" | "yandex";
export type AiDepth = "quick" | "standard" | "deep";

export interface AiModules {
  keyIdeas: boolean;
  terms: boolean;
  aiPerspective: boolean;
  questions: boolean;
  practical: boolean;
}

export interface AiKeys {
  gemini: string | null;
  claude: string | null;
  openai: string | null;
  deepseek: string | null;
  yandex: string | null;
}

export interface Streak {
  count: number;
  lastDate: string;
}

export type ThemeMode = "dark" | "light" | "system";

export interface Settings {
  notificationHour: number | null;
  onboardingDone: boolean;
  themeMode: ThemeMode;
  aiProvider: AiProvider | null;
  aiKeys: AiKeys;
  aiDepth: AiDepth;
  aiModules: AiModules;
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

export async function getAllClips(): Promise<Clip[]> {
  try {
    const raw = await AsyncStorage.getItem(CLIPS_KEY);
    if (!raw) return [];
    const clips: Clip[] = JSON.parse(raw);
    return clips.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveClip(
  clip: Omit<Clip, "id" | "createdAt">
): Promise<Clip> {
  const clips = await getAllClips();
  const newClip: Clip = {
    ...clip,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  clips.unshift(newClip);
  await AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(clips));
  await updateStreak();
  return newClip;
}

export async function deleteClip(id: string): Promise<void> {
  const clips = await getAllClips();
  const filtered = clips.filter((c) => c.id !== id);
  await AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(filtered));
}

export async function updateClip(
  id: string,
  changes: Partial<Clip>
): Promise<void> {
  const clips = await getAllClips();
  const updated = clips.map((c) => (c.id === id ? { ...c, ...changes } : c));
  await AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(updated));
}

export async function getDailyCards(): Promise<Clip[]> {
  const clips = await getAllClips();
  if (clips.length === 0) return [];

  const today = todayKey();
  const target = Math.min(3, clips.length);

  // 1. Карточки, добавленные сегодня (UTC). clips уже отсортированы newest first.
  const todayClips = clips.filter(
    (c) => c.createdAt.slice(0, 10) === today
  );

  // 2. Если сегодня уже 3+ — показать 3 самых новых (без фиксации на день).
  if (todayClips.length >= 3) {
    return todayClips.slice(0, 3);
  }

  // 3. Если сегодня 1-2 — показать их + добрать случайных из архива (без фиксации).
  if (todayClips.length > 0) {
    const usedIds = new Set(todayClips.map((c) => c.id));
    const pool = clips.filter((c) => !usedIds.has(c.id));
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
    const fill = shuffledPool.slice(0, target - todayClips.length);
    return [...todayClips, ...fill];
  }

  // 4. Сегодня ничего не добавлено — старая логика с фиксацией на день.
  const savedDate = await AsyncStorage.getItem(DAILY_DATE_KEY);
  const savedIds = await AsyncStorage.getItem(DAILY_CARDS_KEY);

  if (savedDate === today && savedIds) {
    const ids: string[] = JSON.parse(savedIds);
    const found = ids
      .map((id) => clips.find((c) => c.id === id))
      .filter(Boolean) as Clip[];

    if (found.length === target) return found;

    if (found.length > 0 && found.length < target) {
      const usedIds = new Set(found.map((c) => c.id));
      const pool = clips.filter((c) => !usedIds.has(c.id));
      const shuffledPool = pool.sort(() => Math.random() - 0.5);
      const refill = shuffledPool.slice(0, target - found.length);
      const merged = [...found, ...refill];
      await AsyncStorage.setItem(
        DAILY_CARDS_KEY,
        JSON.stringify(merged.map((c) => c.id))
      );
      return merged;
    }
  }

  const shuffled = [...clips].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, target);
  const selectedIds = selected.map((c) => c.id);
  await AsyncStorage.setItem(DAILY_DATE_KEY, today);
  await AsyncStorage.setItem(DAILY_CARDS_KEY, JSON.stringify(selectedIds));
  return selected;
}

export async function getRandomClip(): Promise<Clip | null> {
  const clips = await getAllClips();
  if (clips.length === 0) return null;
  return clips[Math.floor(Math.random() * clips.length)];
}

export async function getAllTags(): Promise<string[]> {
  const clips = await getAllClips();
  const tagSet = new Set<string>();
  clips.forEach((c) => c.tags.forEach((t) => tagSet.add(t)));
  return Array.from(tagSet).sort();
}

async function updateStreak(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    const today = todayKey();
    let streak: Streak = { count: 0, lastDate: "" };

    if (raw) {
      streak = JSON.parse(raw);
    }

    if (streak.lastDate === today) {
      return;
    }

    const yesterdayStr = yesterdayKey();

    if (streak.lastDate === yesterdayStr) {
      streak.count += 1;
    } else {
      streak.count = 1;
    }
    streak.lastDate = today;
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  } catch {
  }
}

export async function getStreak(): Promise<Streak> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    if (!raw) return { count: 0, lastDate: "" };
    return JSON.parse(raw);
  } catch {
    return { count: 0, lastDate: "" };
  }
}

const DEFAULT_AI_KEYS: AiKeys = {
  gemini: null,
  claude: null,
  openai: null,
  deepseek: null,
  yandex: null,
};

const DEFAULT_SETTINGS: Settings = {
  notificationHour: null,
  onboardingDone: false,
  themeMode: "dark",
  aiProvider: null,
  aiKeys: { ...DEFAULT_AI_KEYS },
  aiDepth: "standard",
  aiModules: {
    keyIdeas: true,
    terms: true,
    aiPerspective: false,
    questions: false,
    practical: false,
  },
};

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, aiKeys: { ...DEFAULT_AI_KEYS } };
    const saved = JSON.parse(raw);

    // Deep-merge aiKeys with defaults
    const aiKeys: AiKeys = {
      ...DEFAULT_AI_KEYS,
      ...(saved.aiKeys ?? {}),
    };

    // Migration: legacy single aiApiKey -> aiKeys[aiProvider]
    if (
      typeof saved.aiApiKey === "string" &&
      saved.aiApiKey.trim().length > 0 &&
      saved.aiProvider &&
      typeof saved.aiProvider === "string" &&
      saved.aiProvider in aiKeys &&
      !aiKeys[saved.aiProvider as AiProvider]
    ) {
      aiKeys[saved.aiProvider as AiProvider] = saved.aiApiKey.trim();
    }

    const { aiApiKey: _legacy, ...rest } = saved;

    return {
      ...DEFAULT_SETTINGS,
      ...rest,
      aiKeys,
      aiModules: {
        ...DEFAULT_SETTINGS.aiModules,
        ...(saved.aiModules ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, aiKeys: { ...DEFAULT_AI_KEYS } };
  }
}

let saveQueue: Promise<void> = Promise.resolve();

export async function saveSettings(s: Partial<Settings>): Promise<void> {
  const next = saveQueue.then(async () => {
    const current = await getSettings();
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...current, ...s })
    );
  });
  saveQueue = next.catch(() => {});
  return next;
}
