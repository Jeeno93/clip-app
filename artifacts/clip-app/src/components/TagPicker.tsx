import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface TagPickerProps {
  selected: string[];
  existingTags: string[];
  onChange: (tags: string[]) => void;
  tagUsageCounts?: Record<string, number>;
}

export default function TagPicker({
  selected,
  existingTags,
  onChange,
  tagUsageCounts,
}: TagPickerProps) {
  const colors = useColors();
  const [newTag, setNewTag] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [showCount, setShowCount] = useState(10);

  const toggle = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  };

  const addNewTag = () => {
    const trimmed = newTag.trim().toLowerCase().replace(/\s+/g, "_");
    if (!trimmed) return;
    if (!selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setNewTag("");
  };

  const allTags = useMemo(() => {
    const tags = Array.from(new Set([...existingTags, ...selected]));
    if (tagUsageCounts) {
      return tags.sort(
        (a, b) => (tagUsageCounts[b] ?? 0) - (tagUsageCounts[a] ?? 0)
      );
    }
    return tags;
  }, [existingTags, selected, tagUsageCounts]);

  const searchTrimmed = tagSearch.trim().toLowerCase();
  const visibleTags = searchTrimmed
    ? allTags.filter((tag) => tag.includes(searchTrimmed))
    : allTags.slice(0, showCount);
  const hasMore = !searchTrimmed && allTags.length > showCount;
  const canCollapse = !searchTrimmed && showCount > 10;

  const s = StyleSheet.create({
    container: { gap: 10 },
    searchInput: {
      height: 38,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 12,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      backgroundColor: colors.bgInput,
      borderColor: colors.border,
      color: colors.foreground,
    },
    tagsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    tag: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
    },
    tagText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    paginationBtn: {
      paddingVertical: 4,
      alignSelf: "flex-start",
    },
    paginationText: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.accent,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    input: {
      flex: 1,
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 14,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      backgroundColor: colors.bgInput,
      borderColor: colors.border,
      color: colors.foreground,
    },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSubtle,
    },
  });

  return (
    <View style={s.container}>
      {allTags.length > 5 && (
        <TextInput
          value={tagSearch}
          onChangeText={setTagSearch}
          placeholder="Поиск тегов..."
          placeholderTextColor={colors.textMuted}
          style={s.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
      )}

      {visibleTags.length > 0 && (
        <View style={s.tagsWrap}>
          {visibleTags.map((tag) => {
            const isSelected = selected.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                onPress={() => toggle(tag)}
                style={[
                  s.tag,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.bgCard,
                    borderColor: isSelected ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.tagText,
                    {
                      color: isSelected
                        ? colors.primaryForeground
                        : colors.textSecondary,
                    },
                  ]}
                >
                  #{tag}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {(hasMore || canCollapse) && (
        <View style={{ flexDirection: "row", gap: 12 }}>
          {hasMore && (
            <TouchableOpacity
              style={s.paginationBtn}
              onPress={() => setShowCount((prev) => prev + 20)}
            >
              <Text style={s.paginationText}>Ещё 20 →</Text>
            </TouchableOpacity>
          )}
          {canCollapse && (
            <TouchableOpacity
              style={s.paginationBtn}
              onPress={() => setShowCount(10)}
            >
              <Text style={s.paginationText}>Скрыть ↑</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={s.inputRow}>
        <TextInput
          value={newTag}
          onChangeText={setNewTag}
          placeholder="Новый тег..."
          placeholderTextColor={colors.textMuted}
          style={s.input}
          onSubmitEditing={addNewTag}
          returnKeyType="done"
          autoCorrect={false}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={addNewTag} style={s.addBtn}>
          <Feather name="plus" size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
