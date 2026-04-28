import { router } from "expo-router";
import React from "react";
import {
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const PROVIDERS = [
  {
    emoji: "🟢",
    name: "DeepSeek",
    note: "доступен в РФ без VPN",
    url: "https://platform.deepseek.com",
  },
  {
    emoji: "🔵",
    name: "Claude (Anthropic)",
    note: null,
    url: "https://console.anthropic.com",
  },
  {
    emoji: "🟡",
    name: "Gemini (Google)",
    note: "может требовать VPN в РФ",
    url: "https://aistudio.google.com",
  },
  {
    emoji: "⚪",
    name: "OpenAI",
    note: null,
    url: "https://platform.openai.com",
  },
] as const;

export default function AiOnboardingModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const s = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.8)",
      justifyContent: "flex-end",
    },
    card: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: Math.max(insets.bottom, 16) + 12,
      gap: 16,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: 4,
    },
    title: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    description: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      lineHeight: 20,
    },
    sectionLabel: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 8,
    },
    providersContainer: {
      gap: 8,
    },
    providerCard: {
      backgroundColor: colors.bgInput,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    providerEmoji: {
      fontSize: 18,
    },
    providerLeft: {
      flex: 1,
      gap: 2,
    },
    providerName: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    providerNote: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.textMuted,
    },
    openBtn: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.border,
    },
    openBtnText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.textMuted,
    },
    settingsBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    settingsBtnText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    closeBtn: {
      alignItems: "center",
      paddingVertical: 10,
    },
    closeBtnText: {
      color: colors.textMuted,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
    },
  });

  const handleSettings = () => {
    onClose();
    router.push("/settings");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <View style={s.card}>
            <View style={s.handle} />

            <Text style={s.title}>✦ AI-анализ статей</Text>

            <Text style={s.description}>
              {"Clip умеет делать конспекты статей с помощью AI — ключевые идеи, объяснение терминов, взгляд на материал.\n\nДля этого нужен API ключ одного из сервисов. Ты платишь провайдеру напрямую — обычно это несколько центов за статью."}
            </Text>

            <View>
              <Text style={s.sectionLabel}>Выбери провайдера</Text>
              <View style={s.providersContainer}>
                {PROVIDERS.map((p) => (
                  <View key={p.name} style={s.providerCard}>
                    <Text style={s.providerEmoji}>{p.emoji}</Text>
                    <View style={s.providerLeft}>
                      <Text style={s.providerName}>{p.name}</Text>
                      {p.note ? (
                        <Text style={s.providerNote}>{p.note}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={s.openBtn}
                      onPress={() => Linking.openURL(p.url)}
                    >
                      <Text style={s.openBtnText}>Открыть →</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity style={s.settingsBtn} onPress={handleSettings}>
              <Text style={s.settingsBtnText}>Настроить ключ</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
