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
  imageUri: null;
  source: string;
  tags: string[];
  createdAt: string;
}

export interface Streak {
  count: number;
  lastDate: string;
}

export interface Settings {
  notificationHour: number | null;
  onboardingDone: boolean;
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
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

  const today = new Date().toDateString();
  const savedDate = await AsyncStorage.getItem(DAILY_DATE_KEY);
  const savedIds = await AsyncStorage.getItem(DAILY_CARDS_KEY);

  if (savedDate === today && savedIds) {
    const ids: string[] = JSON.parse(savedIds);
    const found = ids
      .map((id) => clips.find((c) => c.id === id))
      .filter(Boolean) as Clip[];
    if (found.length > 0) return found;
  }

  const shuffled = [...clips].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(3, clips.length));
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
    const today = new Date().toDateString();
    let streak: Streak = { count: 0, lastDate: "" };

    if (raw) {
      streak = JSON.parse(raw);
    }

    if (streak.lastDate === today) {
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

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

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { notificationHour: null, onboardingDone: false };
    return JSON.parse(raw);
  } catch {
    return { notificationHour: null, onboardingDone: false };
  }
}

export async function saveSettings(s: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ ...current, ...s })
  );
}
