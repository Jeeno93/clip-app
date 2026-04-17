import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Don't autofocus when an image is shared — comment is optional
    if (hasImage) return;
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [hasImage]);

  const source = hasImage ? "screenshot" : (params.source ?? "manual");

  const canSave = hasImage || text.trim().length > 0;

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
    const clip = await addClip(text.trim(), tags, source, imageUri);
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
    textInputCompact: {
      minHeight: 80,
    },
    imagePreview: {
      width: "100%",
      height: 200,
      borderRadius: 8,
      backgroundColor: colors.bgInput,
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

        <View>
          <Text style={s.label}>{hasImage ? "Комментарий" : "Идея"}</Text>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={
              hasImage
                ? "Добавь комментарий..."
                : "Введи текст идеи или мысли..."
            }
            placeholderTextColor={colors.textMuted}
            style={[s.textInput, hasImage && s.textInputCompact]}
            multiline
            editable={!reachedLimit}
          />
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
    </View>
  );
}
