import React, { useRef, useState } from "react";
import {
  ScrollView,
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
}

export default function TagPicker({
  selected,
  existingTags,
  onChange,
}: TagPickerProps) {
  const colors = useColors();
  const [newTag, setNewTag] = useState("");
  const scrollRef = useRef<ScrollView>(null);

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

  const handleInputFocus = () => {
    // Delay so the keyboard has time to fully animate in
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  const allTags = Array.from(new Set([...existingTags, ...selected]));

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tagsScroll}
        contentContainerStyle={styles.tagsContent}
        keyboardShouldPersistTaps="handled"
      >
        {allTags.map((tag) => {
          const isSelected = selected.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              onPress={() => toggle(tag)}
              style={[
                styles.tag,
                {
                  backgroundColor: isSelected
                    ? colors.accent
                    : colors.bgCard,
                  borderColor: isSelected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.tagText,
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
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput
          value={newTag}
          onChangeText={setNewTag}
          placeholder="Новый тег..."
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: colors.bgInput,
              borderColor: colors.border,
              color: colors.foreground,
            },
          ]}
          onFocus={handleInputFocus}
          onSubmitEditing={addNewTag}
          returnKeyType="done"
        />
        <TouchableOpacity
          onPress={addNewTag}
          style={[styles.addBtn, { backgroundColor: colors.accentSubtle }]}
        >
          <Feather name="plus" size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  tagsScroll: {
    flexGrow: 0,
  },
  tagsContent: {
    gap: 8,
    paddingRight: 8,
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
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
