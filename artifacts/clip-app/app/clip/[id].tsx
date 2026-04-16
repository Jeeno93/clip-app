import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import TagPicker from "../../src/components/TagPicker";
import { useClips } from "../../src/context/ClipsContext";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ClipDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clips, allTags, removeClip, editClipTags } = useClips();

  const clip = useMemo(() => clips.find((c) => c.id === id), [clips, id]);
  const [editingTags, setEditingTags] = useState(false);
  const [editedTags, setEditedTags] = useState<string[]>([]);

  useEffect(() => {
    if (clip) setEditedTags(clip.tags);
  }, [clip]);

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

  if (!clip) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>Цитата не найдена</Text>
      </View>
    );
  }

  const handleShare = async () => {
    try {
      await Share.share({ message: clip.text });
    } catch {}
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Удалить цитату?",
      "Это действие нельзя отменить.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            await removeClip(clip.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleSaveTags = async () => {
    await editClipTags(clip.id, editedTags);
    setEditingTags(false);
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
      justifyContent: "space-between",
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    scrollContent: {
      padding: 24,
      gap: 24,
      paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24,
    },
    accentBar: {
      width: 3,
      height: 28,
      backgroundColor: colors.accent,
      borderRadius: 2,
      marginBottom: 20,
    },
    quoteText: {
      fontSize: 20,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      lineHeight: 32,
    },
    metaSection: {
      gap: 10,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    metaLabel: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
      width: 70,
    },
    metaValue: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      flex: 1,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    tagsSection: {
      gap: 12,
    },
    tagsSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    tagsSectionTitle: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    editTagsBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editTagsBtnText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
    },
    tagsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    tag: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      backgroundColor: colors.accentSubtle,
      borderColor: colors.accentDim,
    },
    tagText: {
      fontSize: 13,
      color: colors.accentDim,
      fontFamily: "Inter_400Regular",
    },
    saveTagsBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
    },
    saveTagsBtnText: {
      color: colors.primaryForeground,
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
    deleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#7C2B2B",
      backgroundColor: "#2D1515",
    },
    deleteBtnText: {
      color: "#F87171",
      fontSize: 15,
      fontFamily: "Inter_500Medium",
    },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={s.headerActions}>
          <TouchableOpacity onPress={handleShare}>
            <Feather name="share" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete}>
            <Feather name="trash-2" size={20} color="#F87171" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        <View>
          <View style={s.accentBar} />
          <Text style={s.quoteText}>{clip.text}</Text>
        </View>

        <View style={s.divider} />

        <View style={s.metaSection}>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Источник</Text>
            <Text style={s.metaValue}>
              {clip.source === "manual" ? "Вручную" : clip.source}
            </Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Дата</Text>
            <Text style={s.metaValue}>{formatDate(clip.createdAt)}</Text>
          </View>
        </View>

        <View style={s.divider} />

        <View style={s.tagsSection}>
          <View style={s.tagsSectionHeader}>
            <Text style={s.tagsSectionTitle}>Теги</Text>
            <TouchableOpacity
              style={s.editTagsBtn}
              onPress={() => setEditingTags(!editingTags)}
            >
              <Feather
                name={editingTags ? "x" : "edit-2"}
                size={12}
                color={colors.textSecondary}
              />
              <Text style={s.editTagsBtnText}>
                {editingTags ? "Отмена" : "Редактировать"}
              </Text>
            </TouchableOpacity>
          </View>

          {editingTags ? (
            <>
              <TagPicker
                selected={editedTags}
                existingTags={allTags}
                onChange={setEditedTags}
              />
              <TouchableOpacity
                style={s.saveTagsBtn}
                onPress={handleSaveTags}
              >
                <Text style={s.saveTagsBtnText}>Сохранить теги</Text>
              </TouchableOpacity>
            </>
          ) : clip.tags.length > 0 ? (
            <View style={s.tagsRow}>
              {clip.tags.map((t) => (
                <View key={t} style={s.tag}>
                  <Text style={s.tagText}>#{t}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              Нет тегов
            </Text>
          )}
        </View>

        <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
          <Feather name="trash-2" size={16} color="#F87171" />
          <Text style={s.deleteBtnText}>Удалить цитату</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
