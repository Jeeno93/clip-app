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
import { DOMAIN_EMOJIS } from "../constants/domainEmojis";
import { saveCustomContentType, ContentType } from "../storage/clips";

interface CreateContentTypeModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (type: ContentType) => void;
}

export default function CreateContentTypeModal({
  visible,
  onClose,
  onCreated,
}: CreateContentTypeModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [icon, setIcon] = useState(DOMAIN_EMOJIS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName("");
      setIcon(DOMAIN_EMOJIS[0]);
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
      const id = `custom_${Date.now()}`;
      await saveCustomContentType({ id, name: trimmed, icon, promptHint: "" });
      const created: ContentType = { id, name: trimmed, icon, promptHint: "", isBuiltIn: false };
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
    emojiGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingBottom: 4,
    },
    emojiBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
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
    emojiText: { fontSize: 22 },
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
      opacity: 1,
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
    >
      <KeyboardAvoidingView
        style={s.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>Свой тип контента</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={s.cancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.label}>Иконка</Text>
          <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
            <View style={s.emojiGrid}>
              {DOMAIN_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[s.emojiBtn, e === icon && s.emojiBtnActive]}
                  onPress={() => setIcon(e)}
                >
                  <Text style={s.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Название типа (до 30 символов)"
            placeholderTextColor={colors.textMuted}
            style={s.nameInput}
            maxLength={30}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          <TouchableOpacity
            style={[s.createBtn, !canSave && { opacity: 0.5 }]}
            onPress={handleCreate}
            disabled={!canSave}
          >
            <Text style={s.createBtnText}>Создать</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
