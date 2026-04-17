import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  Clip,
  FREE_LIMIT,
  deleteClip,
  getAllClips,
  getAllTags,
  getDailyCards,
  getRandomClip,
  saveClip,
  updateClip,
} from "../storage/clips";

interface ClipsContextType {
  clips: Clip[];
  dailyCards: Clip[];
  allTags: string[];
  loading: boolean;
  reachedLimit: boolean;
  addClip: (
    text: string,
    tags: string[],
    source: string
  ) => Promise<Clip | null>;
  removeClip: (id: string) => Promise<void>;
  editClipTags: (id: string, tags: string[]) => Promise<void>;
  editClipText: (id: string, text: string) => Promise<void>;
  getRandomOne: () => Clip | null;
  refreshDailyCards: () => Promise<void>;
  refresh: () => Promise<void>;
}

const ClipsContext = createContext<ClipsContextType | null>(null);

export function ClipsProvider({ children }: { children: React.ReactNode }) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [dailyCards, setDailyCards] = useState<Clip[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, dc, tags] = await Promise.all([
        getAllClips(),
        getDailyCards(),
        getAllTags(),
      ]);
      setClips(c);
      setDailyCards(dc);
      setAllTags(tags);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const addClip = useCallback(
    async (
      text: string,
      tags: string[],
      source: string
    ): Promise<Clip | null> => {
      if (clips.length >= FREE_LIMIT) return null;
      const clip = await saveClip({ text, tags, source, imageUri: null });
      await loadAll();
      return clip;
    },
    [clips.length, loadAll]
  );

  const removeClip = useCallback(
    async (id: string) => {
      await deleteClip(id);
      await loadAll();
    },
    [loadAll]
  );

  const editClipTags = useCallback(
    async (id: string, tags: string[]) => {
      await updateClip(id, { tags });
      await loadAll();
    },
    [loadAll]
  );

  const editClipText = useCallback(
    async (id: string, text: string) => {
      await updateClip(id, { text });
      await loadAll();
    },
    [loadAll]
  );

  const getRandomOne = useCallback((): Clip | null => {
    if (clips.length === 0) return null;
    return clips[Math.floor(Math.random() * clips.length)];
  }, [clips]);

  const refreshDailyCards = useCallback(async () => {
    const dc = await getDailyCards();
    setDailyCards(dc);
  }, []);

  return (
    <ClipsContext.Provider
      value={{
        clips,
        dailyCards,
        allTags,
        loading,
        reachedLimit: clips.length >= FREE_LIMIT,
        addClip,
        removeClip,
        editClipTags,
        editClipText,
        getRandomOne,
        refreshDailyCards,
        refresh: loadAll,
      }}
    >
      {children}
    </ClipsContext.Provider>
  );
}

export function useClips(): ClipsContextType {
  const ctx = useContext(ClipsContext);
  if (!ctx) throw new Error("useClips must be used within ClipsProvider");
  return ctx;
}
