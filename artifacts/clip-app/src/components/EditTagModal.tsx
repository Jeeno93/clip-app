import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Alert,
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
import type { TagEntry } from "../storage/clips";

interface EditTagModalProps {
  visible: boolean;
  entry: TagEntry | null;
  onClose: () => void;
  onSave: (oldName: string, newName: string, note: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}

export default function EditTagModal({
  visible,
  entry,
  onClose,
  onSave,
  onDelete,
}: EditTagModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [nameDraft, setNameDraft] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && entry) {
      setNameDraft(entry.name);
      setNote(entry.note ?? "");
      setSaving(false);
    }
  }, [visible, entry]);

  const canSave = nameDraft.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!entry || !canSave) return;
    const trimmedName = nameDraft.trim().replace(/^#+/, "");
    if (!trimmedName) return;
    setSaving(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await onSave(entry.name, trimmedName, note.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!entry) return;
    Alert.alert(
      `Удалить тег #${entry.name}?`,
      "Тег будет удалён из всех карточек",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await onDelete(entry.name);
            onClose();
          },
        },
      ]
    );
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
      marginBottom: 20,
    },
    tagName: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.accent,
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
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      backgroundColor: colors.bgInput,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    noteInput: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    prefix: {
      position: "absolute",
      left: 14,
      top: 13,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.accent,
    },
    saveBtn: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 20,
    },
    saveBtnText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    deleteBtn: {
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 10,
      borderWidth: 1,
      borderColor: "#ef4444",
    },
    deleteBtnText: {
      color: "#ef4444",
      fontSize: 15,
      fontFamily: "Inter_500Medium",
    },
  });

  if (!entry) return null;

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
            <ScrollView
              style={s.sheet}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={false}
            >
              <View style={s.header}>
                <Text style={s.tagName}>#{entry.name}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Text style={s.cancelText}>Отмена</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.label}>Переименовать тег</Text>
              <View>
                <Text style={s.prefix}>#</Text>
                <TextInput
                  value={nameDraft}
                  onChangeText={(v) => setNameDraft(v.replace(/^#+/, ""))}
                  placeholder="название"
                  placeholderTextColor={colors.textMuted}
                  style={[s.input, { paddingLeft: 26 }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>

              <Text style={s.label}>Примечание</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Для чего этот тег, как использую..."
                placeholderTextColor={colors.textMuted}
                style={[s.input, s.noteInput]}
                multiline
                maxLength={200}
              />

              <TouchableOpacity
                style={[s.saveBtn, !canSave && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={!canSave}
              >
                <Text style={s.saveBtnText}>
                  {saving ? "Сохраняю..." : "Сохранить"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
                <Text style={s.deleteBtnText}>Удалить тег</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
