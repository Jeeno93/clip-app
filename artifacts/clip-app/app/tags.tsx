import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import EditTagModal from "../src/components/EditTagModal";
import { useClips } from "../src/context/ClipsContext";
import {
  deleteTagEntry,
  ensureTagEntries,
  getAllTagEntries,
  renameTag,
  saveTagEntry,
  TagEntry,
} from "../src/storage/clips";

export default function TagsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { clips, refresh } = useClips();

  const [entries, setEntries] = useState<TagEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TagEntry | null>(null);

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      // Ensure all tags from clips have entries
      const allTagsInClips = Array.from(
        new Set(clips.flatMap((c) => c.tags))
      );
      await ensureTagEntries(allTagsInClips);

      const stored = await getAllTagEntries();
      setEntries(stored);
    } finally {
      setLoading(false);
    }
  }, [clips]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  const tagCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    clips.forEach((c) => {
      c.tags.forEach((t) => {
        map[t] = (map[t] ?? 0) + 1;
      });
    });
    return map;
  }, [clips]);

  const sortedEntries = useMemo(() => {
    return [...entries]
      .map((e) => ({ ...e, count: tagCountMap[e.name] ?? 0 }))
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  }, [entries, tagCountMap]);

  const handleSave = async (
    oldName: string,
    newName: string,
    note: string
  ) => {
    if (newName !== oldName) {
      await renameTag(oldName, newName);
    }
    const existing = entries.find((e) => e.name === oldName);
    await saveTagEntry({
      name: newName,
      note: note || undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
    await refresh();
    await loadEntries();
  };

  const handleDelete = async (name: string) => {
    await deleteTagEntry(name);
    await refresh();
    await loadEntries();
  };

  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: topPad + 12,
      paddingHorizontal: 16,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    list: {
      padding: 16,
      gap: 10,
      paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 20,
    },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    tagName: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.accent,
      flex: 1,
    },
    countRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    countText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.textMuted,
    },
    chevron: {
      marginLeft: 4,
    },
    noteText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      marginTop: 4,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      textAlign: "center",
    },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Теги</Text>
      </View>

      {loading ? (
        <View style={s.emptyContainer}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : sortedEntries.length === 0 ? (
        <View style={s.emptyContainer}>
          <Feather name="tag" size={36} color={colors.textMuted} />
          <Text style={s.emptyText}>
            Теги появятся здесь после добавления карточек с тегами
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        >
          {sortedEntries.map((entry) => (
            <TouchableOpacity
              key={entry.name}
              style={s.card}
              onPress={() => setEditing(entry)}
              activeOpacity={0.75}
            >
              <View style={s.cardRow}>
                <Text style={s.tagName}>#{entry.name}</Text>
                <View style={s.countRow}>
                  {(entry.count ?? 0) > 0 && (
                    <Text style={s.countText}>{entry.count}</Text>
                  )}
                  <Feather
                    name="chevron-right"
                    size={14}
                    color={colors.textMuted}
                    style={s.chevron}
                  />
                </View>
              </View>
              {entry.note ? (
                <Text style={s.noteText} numberOfLines={2}>
                  {entry.note}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <EditTagModal
        visible={editing !== null}
        entry={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </View>
  );
}
