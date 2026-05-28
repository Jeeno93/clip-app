import AsyncStorage from "@react-native-async-storage/async-storage";

const CLIPS_KEY = "@clip:clips";
const STREAK_KEY = "@clip:streak";
const SETTINGS_KEY = "@clip:settings";
const DAILY_CARDS_KEY = "@clip:daily_cards";
const DAILY_DATE_KEY = "@clip:daily_date";
const DOMAINS_KEY = "@clip:domains";
const TAG_ENTRIES_KEY = "@clip:tag_entries";

const BUILT_IN_API_KEY = "sk-c4d5d2069a6443699acaa4ade2a8e9dc";
const BUILT_IN_PROVIDER = "deepseek" as const;
const FREE_ANALYSES_LIMIT = 10;
const FREE_ANALYSES_KEY = "@clip:free_analyses_used";

export async function getFreeAnalysesUsed(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(FREE_ANALYSES_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export async function incrementFreeAnalyses(): Promise<number> {
  const used = await getFreeAnalysesUsed();
  const newUsed = used + 1;
  await AsyncStorage.setItem(FREE_ANALYSES_KEY, String(newUsed));
  return newUsed;
}

export async function getFreeAnalysesRemaining(): Promise<number> {
  const used = await getFreeAnalysesUsed();
  return Math.max(0, FREE_ANALYSES_LIMIT - used);
}

export { BUILT_IN_API_KEY, BUILT_IN_PROVIDER, FREE_ANALYSES_LIMIT };

export interface Clip {
  id: string;
  text: string;
  title?: string;
  imageUri: string | null;
  source: string;
  tags: string[];
  createdAt: string;
  domainId?: string; // null/undefined = Inbox (Входящие)
  linkPreview?: {
    title: string;
    description: string | null;
    imageUrl: string | null;
    url: string;
    fullText?: string;
  };
  summary?: string;
  summaryTruncated?: boolean;
}

export interface Domain {
  id: string;
  name: string;
  icon: string; // emoji
  createdAt: string;
}

export interface TagEntry {
  name: string;      // unique tag name
  note?: string;     // user note
  createdAt: string; // ISO date
  count?: number;    // computed, not stored
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
  await ensureTagEntries(newClip.tags);
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

// ─────────────────────────── Domains ───────────────────────────

export async function getAllDomains(): Promise<Domain[]> {
  try {
    const raw = await AsyncStorage.getItem(DOMAINS_KEY);
    if (!raw) return [];
    const domains: Domain[] = JSON.parse(raw);
    // Sort by createdAt asc (oldest first — stable order for sidebar)
    return domains.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveDomain(
  domain: Omit<Domain, "id" | "createdAt">
): Promise<Domain> {
  const domains = await getAllDomains();
  const newDomain: Domain = {
    ...domain,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  domains.push(newDomain);
  await AsyncStorage.setItem(DOMAINS_KEY, JSON.stringify(domains));
  return newDomain;
}

export async function deleteDomain(id: string): Promise<void> {
  const domains = await getAllDomains();
  const filtered = domains.filter((d) => d.id !== id);
  await AsyncStorage.setItem(DOMAINS_KEY, JSON.stringify(filtered));

  // Detach all clips from the deleted domain → they go back to Inbox.
  const clips = await getAllClips();
  const updated = clips.map((c) =>
    c.domainId === id ? { ...c, domainId: undefined } : c
  );
  await AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(updated));
}

export async function updateDomain(
  id: string,
  changes: Partial<Domain>
): Promise<void> {
  const domains = await getAllDomains();
  const updated = domains.map((d) => (d.id === id ? { ...d, ...changes } : d));
  await AsyncStorage.setItem(DOMAINS_KEY, JSON.stringify(updated));
}

export async function moveClipsToInbox(domainId: string): Promise<void> {
  const clips = await getAllClips();
  const updated = clips.map((c) =>
    c.domainId === domainId ? { ...c, domainId: undefined } : c
  );
  await AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(updated));
}

export async function deleteDomainWithClips(domainId: string): Promise<void> {
  const clips = await getAllClips();
  const filteredClips = clips.filter((c) => c.domainId !== domainId);
  await AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(filteredClips));

  const domains = await getAllDomains();
  const filteredDomains = domains.filter((d) => d.id !== domainId);
  await AsyncStorage.setItem(DOMAINS_KEY, JSON.stringify(filteredDomains));
}

export async function moveClipToDomain(
  clipId: string,
  domainId: string | null
): Promise<void> {
  // null → back to Inbox; remove the field so JSON.stringify drops it.
  await updateClip(clipId, {
    domainId: domainId === null ? undefined : domainId,
  });
}

export async function getInboxClips(): Promise<Clip[]> {
  const clips = await getAllClips();
  return clips.filter((c) => !c.domainId);
}

export async function getDomainClips(domainId: string): Promise<Clip[]> {
  const clips = await getAllClips();
  return clips.filter((c) => c.domainId === domainId);
}

export async function getInboxCount(): Promise<number> {
  const clips = await getAllClips();
  return clips.filter((c) => !c.domainId).length;
}

// ─────────────────────────── Tag Entries ────────────────────────

export async function getAllTagEntries(): Promise<TagEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(TAG_ENTRIES_KEY);
    if (!raw) return [];
    const entries: TagEntry[] = JSON.parse(raw);
    return entries;
  } catch {
    return [];
  }
}

export async function saveTagEntry(entry: TagEntry): Promise<void> {
  const entries = await getAllTagEntries();
  const idx = entries.findIndex((e) => e.name === entry.name);
  if (idx >= 0) {
    entries[idx] = { ...entries[idx], ...entry };
  } else {
    entries.push(entry);
  }
  await AsyncStorage.setItem(TAG_ENTRIES_KEY, JSON.stringify(entries));
}

export async function deleteTagEntry(name: string): Promise<void> {
  const entries = await getAllTagEntries();
  const filtered = entries.filter((e) => e.name !== name);
  await AsyncStorage.setItem(TAG_ENTRIES_KEY, JSON.stringify(filtered));

  const clips = await getAllClips();
  const updatedClips = clips.map((c) => ({
    ...c,
    tags: c.tags.filter((t) => t !== name),
  }));
  await AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(updatedClips));
}

export async function renameTag(
  oldName: string,
  newName: string
): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return;

  const clips = await getAllClips();
  const updatedClips = clips.map((c) => ({
    ...c,
    tags: c.tags.map((t) => (t === oldName ? trimmed : t)),
  }));
  await AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(updatedClips));

  const entries = await getAllTagEntries();
  const updatedEntries = entries.map((e) =>
    e.name === oldName ? { ...e, name: trimmed } : e
  );
  await AsyncStorage.setItem(TAG_ENTRIES_KEY, JSON.stringify(updatedEntries));
}

export async function ensureTagEntries(tags: string[]): Promise<void> {
  if (tags.length === 0) return;
  const entries = await getAllTagEntries();
  const existingNames = new Set(entries.map((e) => e.name));
  let changed = false;
  for (const tag of tags) {
    if (tag && !existingNames.has(tag)) {
      entries.push({ name: tag, createdAt: new Date().toISOString() });
      existingNames.add(tag);
      changed = true;
    }
  }
  if (changed) {
    await AsyncStorage.setItem(TAG_ENTRIES_KEY, JSON.stringify(entries));
  }
}

// ───────────────────────────────────────────────────────────────

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
