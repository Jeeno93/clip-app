import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
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
import { useClips } from "../context/ClipsContext";
import type { Domain } from "../storage/clips";

const EMOJIS = [
  "🤖", "📦", "🧠", "📚", "💡", "🎯", "🔬",
  "💼", "🌍", "🎨", "✍️", "🏗️", "📊", "🎵", "❤️",
];

interface CreateDomainModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (domain: Domain) => void;
}

export default function CreateDomainModal({
  visible,
  onClose,
  onCreated,
}: CreateDomainModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { createDomain } = useClips();

  const [name, setName] = useState("");
  const [icon, setIcon] = useState(EMOJIS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName("");
      setIcon(EMOJIS[0]);
      setSaving(false);
    }
  }, [visible]);

  const canSave = name.trim().length > 0 && !saving;

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const created = await createDomain({ name: trimmed, icon });
      onCreated?.(created);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const s = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 18,
      paddingHorizontal: 20,
      paddingBottom: (Platform.OS === "web" ? 24 : insets.bottom) + 18,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    cancelText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
    },
    label: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1.2,
      marginBottom: 10,
    },
    emojiRow: {
      gap: 10,
      paddingBottom: 4,
    },
    emojiBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgInput,
      alignItems: "center",
      justifyContent: "center",
    },
    emojiBtnActive: {
      borderColor: colors.accent,
      borderWidth: 2,
      backgroundColor: colors.accentSubtle,
    },
    emojiText: {
      fontSize: 22,
    },
    nameInput: {
      backgroundColor: colors.bgInput,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      marginTop: 18,
      marginBottom: 18,
    },
    createBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    createBtnText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={s.sheet}>
              <View style={s.header}>
                <Text style={s.title}>Новый домен</Text>
                <TouchableOpacity onPress={onClose}>
                  <Text style={s.cancelText}>Отмена</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.label}>Иконка</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.emojiRow}
              >
                {EMOJIS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[s.emojiBtn, icon === e && s.emojiBtnActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setIcon(e);
                    }}
                  >
                    <Text style={s.emojiText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Название домена..."
                placeholderTextColor={colors.textMuted}
                style={s.nameInput}
                maxLength={30}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />

              <TouchableOpacity
                style={[s.createBtn, !canSave && { opacity: 0.5 }]}
                onPress={handleCreate}
                disabled={!canSave}
              >
                <Text style={s.createBtnText}>
                  {saving ? "Создаю..." : "Создать"}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
