import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import TagPicker from "../../src/components/TagPicker";
import { useClips } from "../../src/context/ClipsContext";
import { getSettings, Settings } from "../../src/storage/clips";
import { summarizeContent } from "../../src/utils/summarize";

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

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
  const {
    clips,
    allTags,
    removeClip,
    editClipTags,
    editClipText,
    editClipSummary,
  } = useClips();

  const clip = useMemo(() => clips.find((c) => c.id === id), [clips, id]);

  // Tags editing state
  const [editingTags, setEditingTags] = useState(false);
  const [editedTags, setEditedTags] = useState<string[]>([]);

  // Text editing state
  const [editingText, setEditingText] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [savingText, setSavingText] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  // AI analysis state
  const [aiSettings, setAiSettings] = useState<Settings | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const s = await getSettings();
        if (active) setAiSettings(s);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  useEffect(() => {
    if (clip) {
      setEditedTags(clip.tags);
      setEditedText(clip.text);
    }
  }, [clip]);

  // Focus input when entering text edit mode
  useEffect(() => {
    if (editingText) {
      setTimeout(() => textInputRef.current?.focus(), 80);
    }
  }, [editingText]);

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

  if (!clip) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>Идея не найдена</Text>
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
      "Удалить идею?",
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

  const handleSaveText = async () => {
    const trimmed = editedText.trim();
    if (!trimmed) {
      Alert.alert("Пустой текст", "Текст идеи не может быть пустым.");
      return;
    }
    if (trimmed === clip.text) {
      setEditingText(false);
      return;
    }
    setSavingText(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await editClipText(clip.id, trimmed);
      setEditingText(false);
    } finally {
      setSavingText(false);
    }
  };

  const handleCancelTextEdit = () => {
    setEditedText(clip.text);
    setEditingText(false);
  };

  const buildAnalysisInput = (): string => {
    if (clip.linkPreview) {
      const parts = [
        clip.linkPreview.title,
        clip.linkPreview.description ?? "",
        clip.text ?? "",
      ];
      return parts.filter((s) => s.trim().length > 0).join("\n\n");
    }
    return clip.text;
  };

  const canAnalyze =
    !!aiSettings?.aiApiKey &&
    !!aiSettings?.aiProvider &&
    (!!clip.linkPreview || clip.text.length > 200);

  const handleAnalyze = async () => {
    if (!aiSettings?.aiApiKey || !aiSettings?.aiProvider) return;
    const m = aiSettings.aiModules;
    const anyActive =
      m.keyIdeas || m.terms || m.aiPerspective || m.questions || m.practical;
    if (!anyActive) {
      Alert.alert(
        "Нет активных модулей",
        "Включи хотя бы один модуль анализа в настройках AI"
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnalyzing(true);
    try {
      const text = buildAnalysisInput();
      const result = await summarizeContent(
        text,
        aiSettings.aiProvider,
        aiSettings.aiApiKey,
        aiSettings.aiDepth,
        aiSettings.aiModules
      );
      if (result === "AUTH_ERROR") {
        Alert.alert("Ошибка", "Неверный API ключ. Проверь настройки.");
        return;
      }
      if (!result) {
        Alert.alert("Ошибка", "Не удалось получить ответ. Попробуй позже.");
        return;
      }
      await editClipSummary(clip.id, result);
    } catch (error: any) {
      Alert.alert("Ошибка AI", error?.message || "Неизвестная ошибка");
    } finally {
      setAnalyzing(false);
    }
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
    quoteSection: {
      gap: 0,
    },
    quoteSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    accentBar: {
      width: 3,
      height: 28,
      backgroundColor: colors.accent,
      borderRadius: 2,
    },
    editTextBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editTextBtnText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
    },
    quoteText: {
      fontSize: 20,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      lineHeight: 32,
    },
    fullImage: {
      width: "100%",
      maxHeight: 400,
      aspectRatio: 1,
      borderRadius: 10,
      backgroundColor: colors.bgInput,
      marginBottom: 16,
    },
    linkSection: {
      gap: 12,
    },
    linkImage: {
      width: "100%",
      height: 180,
      borderRadius: 10,
      backgroundColor: colors.bgInput,
    },
    linkTitle: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      lineHeight: 30,
    },
    linkDescription: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      lineHeight: 22,
    },
    linkDomain: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.textMuted,
    },
    openLinkBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 13,
      borderRadius: 10,
      marginTop: 4,
    },
    openLinkBtnText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    linkCommentDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginTop: 16,
      marginBottom: 16,
    },
    linkCommentLabel: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 8,
    },
    linkCommentText: {
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      lineHeight: 24,
    },
    commentText: {
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      lineHeight: 24,
    },
    textInput: {
      fontSize: 20,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      lineHeight: 32,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 10,
      padding: 14,
      minHeight: 100,
      textAlignVertical: "top",
      backgroundColor: colors.bgInput,
    },
    saveTextBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: 12,
    },
    saveTextBtnText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    cancelTextBtn: {
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 8,
    },
    cancelTextBtnText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
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
    analyzeBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 13,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.accentDim,
      backgroundColor: colors.accentSubtle,
    },
    analyzeBtnText: {
      color: colors.accent,
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
    summaryBlock: {
      backgroundColor: colors.accentSubtle,
      borderWidth: 1,
      borderColor: colors.accentDim,
      borderRadius: 12,
      padding: 14,
      gap: 10,
    },
    summaryHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    summaryTitle: {
      color: colors.accent,
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
    summaryRefresh: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    summaryRefreshText: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: "Inter_500Medium",
    },
    summaryParagraph: {
      color: colors.foreground,
      fontSize: 14,
      lineHeight: 21,
      fontFamily: "Inter_400Regular",
    },
    summaryHeading: {
      color: colors.foreground,
      fontSize: 14,
      lineHeight: 21,
      fontFamily: "Inter_700Bold",
      marginTop: 4,
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Image (if present) ── */}
        {clip.imageUri && (
          <Image
            source={{ uri: clip.imageUri }}
            style={s.fullImage}
            resizeMode="contain"
          />
        )}

        {/* ── Link preview (if present) ── */}
        {clip.linkPreview && (
          <View style={s.linkSection}>
            {clip.linkPreview.imageUrl && (
              <Image
                source={{ uri: clip.linkPreview.imageUrl }}
                style={s.linkImage}
                resizeMode="cover"
              />
            )}
            <Text style={s.linkTitle}>{clip.linkPreview.title}</Text>
            {clip.linkPreview.description ? (
              <Text style={s.linkDescription}>
                {clip.linkPreview.description}
              </Text>
            ) : null}
            <Text style={s.linkDomain}>
              {getDomain(clip.linkPreview.url)}
            </Text>
            <TouchableOpacity
              style={s.openLinkBtn}
              onPress={() => Linking.openURL(clip.linkPreview!.url)}
            >
              <Feather
                name="external-link"
                size={16}
                color={colors.primaryForeground}
              />
              <Text style={s.openLinkBtnText}>Открыть статью</Text>
            </TouchableOpacity>
            {clip.text ? (
              <>
                <View style={s.linkCommentDivider} />
                <Text style={s.linkCommentLabel}>Комментарий</Text>
                <Text style={s.linkCommentText}>{clip.text}</Text>
              </>
            ) : null}
          </View>
        )}

        {/* ── Text / comment section ── */}
        {!clip.linkPreview && (clip.text || !clip.imageUri || editingText) && (
          <View style={s.quoteSection}>
            <View style={s.quoteSectionHeader}>
              <View style={s.accentBar} />
              <TouchableOpacity
                style={s.editTextBtn}
                onPress={() =>
                  editingText ? handleCancelTextEdit() : setEditingText(true)
                }
              >
                <Feather
                  name={editingText ? "x" : "edit-2"}
                  size={12}
                  color={colors.textSecondary}
                />
                <Text style={s.editTextBtnText}>
                  {editingText ? "Отмена" : "Редактировать"}
                </Text>
              </TouchableOpacity>
            </View>

            {editingText ? (
              <>
                <TextInput
                  ref={textInputRef}
                  style={s.textInput}
                  value={editedText}
                  onChangeText={setEditedText}
                  multiline
                  scrollEnabled={false}
                  autoCorrect={false}
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity
                  style={[s.saveTextBtn, savingText && { opacity: 0.6 }]}
                  onPress={handleSaveText}
                  disabled={savingText}
                >
                  <Text style={s.saveTextBtnText}>
                    {savingText ? "Сохраняю…" : "Сохранить"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={clip.imageUri ? s.commentText : s.quoteText}>
                {clip.text}
              </Text>
            )}
          </View>
        )}

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

        {/* ── Tags section ── */}
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

        {clip.summary ? (
          <View style={s.summaryBlock}>
            <View style={s.summaryHeader}>
              <Text style={s.summaryTitle}>✦ AI-анализ</Text>
              <TouchableOpacity
                style={s.summaryRefresh}
                onPress={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? (
                  <ActivityIndicator size="small" color={colors.textMuted} />
                ) : (
                  <Text style={s.summaryRefreshText}>Обновить</Text>
                )}
              </TouchableOpacity>
            </View>
            <View>
              {clip.summary.split("\n").map((line, idx) => {
                const trimmed = line.trim();
                if (trimmed.length === 0) {
                  return <View key={idx} style={{ height: 6 }} />;
                }
                const headingMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*$/);
                if (headingMatch) {
                  return (
                    <Text key={idx} style={s.summaryHeading}>
                      {headingMatch[1]}
                    </Text>
                  );
                }
                return (
                  <Text key={idx} style={s.summaryParagraph}>
                    {trimmed.replace(/\*\*/g, "")}
                  </Text>
                );
              })}
            </View>
          </View>
        ) : canAnalyze ? (
          <TouchableOpacity
            style={s.analyzeBtn}
            onPress={handleAnalyze}
            disabled={analyzing}
          >
            {analyzing ? (
              <>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={s.analyzeBtnText}>Анализирую...</Text>
              </>
            ) : (
              <Text style={s.analyzeBtnText}>✦ Анализировать</Text>
            )}
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
          <Feather name="trash-2" size={16} color="#F87171" />
          <Text style={s.deleteBtnText}>Удалить идею</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
