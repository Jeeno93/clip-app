import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as IntentLauncher from "expo-intent-launcher";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import TagPicker from "../src/components/TagPicker";
import { useClips } from "../src/context/ClipsContext";
import { FREE_LIMIT } from "../src/storage/clips";
import {
  fetchLinkPreview,
  isUrl,
  type LinkPreview,
} from "../src/utils/fetchLinkPreview";

// Voice input is implemented via the system speech-recognition Intent
// (ACTION_RECOGNIZE_SPEECH) which is Android-only and ships with the Google
// app — no third-party native module, no RECORD_AUDIO permission required.
const VOICE_AVAILABLE = Platform.OS === "android";

export default function AddClipScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    sharedText?: string;
    source?: string;
    imageUri?: string;
  }>();
  const { clips, allTags, addClip, reachedLimit } = useClips();

  const imageUri = params.imageUri ?? null;
  const hasImage = !!imageUri;

  const [text, setText] = useState(params.sharedText ?? "");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Tracked so the saved clip's `source` becomes "voice" when transcript was used.
  const [hasUsedVoice, setHasUsedVoice] = useState(false);

  const inputRef = useRef<TextInput>(null);

  const startVoiceInput = async () => {
    if (!VOICE_AVAILABLE) return;
    try {
      const result = await IntentLauncher.startActivityAsync(
        // The constant isn't exported by expo-intent-launcher — pass the raw
        // Android action string, which is the documented usage for system
        // intents that the lib doesn't enumerate.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "android.speech.action.RECOGNIZE_SPEECH" as any,
        {
          extra: {
            "android.speech.extra.LANGUAGE_MODEL": "free_form",
            "android.speech.extra.LANGUAGE": "ru-RU",
            "android.speech.extra.MAX_RESULTS": 1,
            "android.speech.extra.PROMPT": "Говорите...",
          },
        }
      );
      // RESULT_OK === -1 on Android.
      if (result.resultCode !== -1) return;

      // Different lib versions surface the speech results under either
      // `result.extra` (current) or `result.data.extras` (older / alt). Read
      // both shapes defensively.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = result as any;
      const bag = r?.extra ?? r?.data?.extras ?? null;
      const list = bag?.results;
      const transcript: string | null = Array.isArray(list)
        ? typeof list[0] === "string"
          ? list[0]
          : null
        : null;

      if (transcript) {
        setText((prev) => (prev ? prev + " " + transcript : transcript));
        setHasUsedVoice(true);
      }
    } catch {
      Alert.alert(
        "Голосовой ввод недоступен",
        "Убедись, что на устройстве установлено приложение Google."
      );
    }
  };

  useEffect(() => {
    // Don't autofocus when an image is shared — comment is optional
    if (hasImage) return;
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [hasImage]);

  // Detect a URL in the initial text (shared or pasted) and fetch preview once.
  useEffect(() => {
    if (hasImage) return;
    const trimmed = text.trim();
    if (!isUrl(trimmed)) return;
    if (linkUrl === trimmed) return;
    let cancelled = false;
    setLinkUrl(trimmed);
    setLinkPreview(null);
    setLoadingPreview(true);
    (async () => {
      const preview = await fetchLinkPreview(trimmed);
      if (cancelled) return;
      setLoadingPreview(false);
      if (preview) setLinkPreview(preview);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, hasImage]);

  const source = hasImage
    ? "screenshot"
    : linkPreview
    ? "link"
    : hasUsedVoice
    ? "voice"
    : (params.source ?? "manual");

  const canSave = hasImage || text.trim().length > 0;

  const previewDomain = useMemo(() => {
    if (!linkPreview) return null;
    try {
      return new URL(linkPreview.url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }, [linkPreview]);

  const handleSave = async () => {
    if (!canSave) return;
    if (reachedLimit) {
      Alert.alert(
        "Лимит достигнут",
        `Бесплатная версия поддерживает до ${FREE_LIMIT} идей.`
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    const trimmedTitle = title.trim();
    const clip = await addClip(
      text.trim(),
      tags,
      source,
      imageUri,
      linkPreview ?? undefined,
      trimmedTitle.length > 0 ? trimmedTitle : undefined
    );
    setSaving(false);
    if (clip) {
      router.back();
    }
  };

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

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
    headerTitle: {
      fontSize: 17,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    cancelBtn: {
      padding: 6,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderRadius: 10,
    },
    saveBtnText: {
      color: colors.primaryForeground,
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      gap: 24,
      paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 20,
    },
    label: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1.2,
      marginBottom: 10,
    },
    textInput: {
      backgroundColor: colors.bgInput,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      minHeight: 160,
      textAlignVertical: "top",
      lineHeight: 24,
    },
    titleInput: {
      backgroundColor: "transparent",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 8,
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 12,
    },
    textInputCompact: {
      minHeight: 80,
    },
    textRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    textInputFlex: {
      flex: 1,
    },
    micButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.bgInput,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    micIcon: {
      fontSize: 20,
    },
    imagePreview: {
      width: "100%",
      height: 200,
      borderRadius: 8,
      backgroundColor: colors.bgInput,
    },
    previewLoading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
      backgroundColor: colors.bgInput,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewLoadingText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    previewCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    previewImage: {
      width: "100%",
      height: 80,
      backgroundColor: colors.bgInput,
    },
    previewBody: {
      padding: 12,
      gap: 4,
    },
    previewTitle: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      lineHeight: 20,
    },
    previewDescription: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      lineHeight: 18,
    },
    previewDomain: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.textMuted,
      marginTop: 4,
    },
    sourceBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.accentSubtle,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      alignSelf: "flex-start",
    },
    sourceBadgeText: {
      color: colors.accent,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    limitBanner: {
      backgroundColor: "#2D1515",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#7C2B2B",
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    limitText: {
      color: "#F87171",
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      flex: 1,
    },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Новая идея</Text>
        <TouchableOpacity
          style={[
            s.saveBtn,
            (!canSave || reachedLimit || saving) && { opacity: 0.5 },
          ]}
          onPress={handleSave}
          disabled={!canSave || reachedLimit || saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Text style={s.saveBtnText}>Сохранить</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={s.content}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
      <ScrollView
        style={s.content}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {reachedLimit && (
          <View style={s.limitBanner}>
            <Feather name="alert-triangle" size={16} color="#F87171" />
            <Text style={s.limitText}>
              Достигнут лимит бесплатной версии ({FREE_LIMIT} идей)
            </Text>
          </View>
        )}

        {hasImage && (
          <View>
            <Text style={s.label}>Изображение</Text>
            <Image
              source={{ uri: imageUri! }}
              style={s.imagePreview}
              resizeMode="cover"
            />
          </View>
        )}

        {!hasImage && loadingPreview && (
          <View>
            <Text style={s.label}>Превью</Text>
            <View style={s.previewLoading}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={s.previewLoadingText}>Загружаю превью...</Text>
            </View>
          </View>
        )}

        {!hasImage && linkPreview && (
          <View>
            <Text style={s.label}>Превью</Text>
            <View style={s.previewCard}>
              {linkPreview.imageUrl && (
                <Image
                  source={{ uri: linkPreview.imageUrl }}
                  style={s.previewImage}
                  resizeMode="cover"
                />
              )}
              <View style={s.previewBody}>
                <Text style={s.previewTitle} numberOfLines={2}>
                  {linkPreview.title}
                </Text>
                {linkPreview.description ? (
                  <Text style={s.previewDescription} numberOfLines={2}>
                    {linkPreview.description}
                  </Text>
                ) : null}
                {previewDomain ? (
                  <Text style={s.previewDomain}>{previewDomain}</Text>
                ) : null}
              </View>
            </View>
          </View>
        )}

        <View>
          <Text style={s.label}>
            {hasImage
              ? "Комментарий"
              : linkPreview
              ? "Комментарий"
              : "Идея"}
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Заголовок (необязательно)"
            placeholderTextColor={colors.textMuted}
            style={s.titleInput}
            maxLength={100}
            editable={!reachedLimit}
          />
          <View style={s.textRow}>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder={
                hasImage
                  ? "Добавь комментарий..."
                  : linkPreview
                  ? "Добавь комментарий..."
                  : "Введи текст идеи или мысли..."
              }
              placeholderTextColor={colors.textMuted}
              style={[
                s.textInput,
                s.textInputFlex,
                (hasImage || linkPreview) && s.textInputCompact,
              ]}
              multiline
              editable={!reachedLimit}
            />
            {VOICE_AVAILABLE && (
              <TouchableOpacity
                onPress={startVoiceInput}
                disabled={reachedLimit}
                style={s.micButton}
              >
                <Text style={s.micIcon}>🎤</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {source !== "manual" && (
          <View>
            <Text style={s.label}>Источник</Text>
            <View style={s.sourceBadge}>
              <Feather name="share-2" size={14} color={colors.accent} />
              <Text style={s.sourceBadgeText}>{source}</Text>
            </View>
          </View>
        )}

        <View>
          <Text style={s.label}>Теги</Text>
          <TagPicker
            selected={tags}
            existingTags={allTags}
            onChange={setTags}
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
