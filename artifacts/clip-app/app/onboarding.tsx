import * as amplitude from "@amplitude/analytics-react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { requestNotificationPermission, scheduleDailyDigest } from "../src/notifications/digest";
import { addDemoClips, saveSettings } from "../src/storage/clips";

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  const steps = [
    "Приветствие",
    "Как добавлять",
    "AI-анализ",
    "Уведомления",
  ];

  const handleStep0Continue = () => {
    setStep(1);
  };

  const handleStep1Continue = () => {
    setStep(2);
  };

  const handleStep2Continue = () => {
    setStep(3);
  };

  const handleNotifChoice = async (hour: number | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (hour !== null) {
      const granted = await requestNotificationPermission();
      if (granted) {
        await scheduleDailyDigest(hour);
      }
    }
    await saveSettings({ notificationHour: hour, onboardingDone: true });
    await addDemoClips();
    amplitude.track("onboarding_completed", { notificationHour: hour });
    router.replace("/(tabs)");
  };

  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    inner: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: insets.top + 40,
      paddingBottom: insets.bottom + 24,
    },
    progress: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 40,
    },
    dot: {
      flex: 1,
      height: 2,
      borderRadius: 2,
    },
    headline: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 12,
      lineHeight: 36,
    },
    subtitle: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: 32,
    },
    input: {
      backgroundColor: colors.bgInput,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      minHeight: 120,
      textAlignVertical: "top",
    },
    btnPrimary: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 16,
    },
    btnPrimaryText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
    },
    btnSecondary: {
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    btnSecondaryText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
    },
    illustrationBox: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      marginBottom: 32,
      alignItems: "center",
      gap: 16,
    },
    illustrationText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 20,
    },
    illustrationStep: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      alignSelf: "stretch",
    },
    illustrationStepNum: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accentSubtle,
      borderWidth: 1,
      borderColor: colors.accentDim,
      alignItems: "center",
      justifyContent: "center",
    },
    illustrationStepNumText: {
      color: colors.accent,
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
    },
    illustrationStepText: {
      color: colors.foreground,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      flex: 1,
    },
    notifGrid: {
      gap: 12,
      marginBottom: 24,
    },
    notifBtn: {
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 18,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    notifBtnText: {
      fontSize: 16,
      fontFamily: "Inter_500Medium",
    },
    notifBtnSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    benefitList: {
      gap: 16,
      marginBottom: 36,
    },
    benefitRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    benefitIcon: {
      fontSize: 18,
      color: colors.accent,
      width: 24,
      textAlign: "center",
    },
    benefitText: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      flex: 1,
    },
  });

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={s.container}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.inner}>
          <View style={s.progress}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[
                  s.dot,
                  {
                    backgroundColor:
                      i <= step ? colors.accent : colors.border,
                  },
                ]}
              />
            ))}
          </View>

          {step === 0 && (
            <>
              <Text style={s.headline}>
                {"Ты читаешь много.\nПомнишь мало."}
              </Text>
              <Text style={s.subtitle}>Clip это исправит.</Text>
              <View style={s.benefitList}>
                {[
                  { icon: "↗", text: "Сохраняй из любого приложения за 3 сек" },
                  { icon: "✦", text: "Получай лучшее каждое утро" },
                  { icon: "🤖", text: "AI делает конспект любой статьи" },
                ].map((b) => (
                  <View key={b.icon} style={s.benefitRow}>
                    <Text style={s.benefitIcon}>{b.icon}</Text>
                    <Text style={s.benefitText}>{b.text}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={s.btnPrimary} onPress={handleStep0Continue}>
                <Text style={s.btnPrimaryText}>Начать</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={s.headline}>
                {"Добавляй из\nлюбого приложения"}
              </Text>
              <Text style={s.subtitle}>
                Увидел важную мысль — поделись с Clip. Три секунды, и она в архиве навсегда.
              </Text>
              <View style={s.illustrationBox}>
                {[
                  "Выдели текст в любом приложении",
                  'Нажми "Поделиться"',
                  "Выбери Clip из списка — идея в архиве и готова к AI-конспекту в любой момент",
                ].map((text, i) => (
                  <View key={i} style={s.illustrationStep}>
                    <View style={s.illustrationStepNum}>
                      <Text style={s.illustrationStepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={s.illustrationStepText}>{text}</Text>
                    {i < 2 && (
                      <Feather
                        name="arrow-down"
                        size={14}
                        color={colors.textMuted}
                      />
                    )}
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={s.btnPrimary}
                onPress={handleStep1Continue}
              >
                <Text style={s.btnPrimaryText}>Понял, продолжить</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={s.headline}>AI анализирует статьи за тебя</Text>
              <Text style={s.subtitle}>
                {"2 анализа в день — бесплатно, без настройки.\nНужно больше? Добавь свой API ключ — это займёт 2 минуты и стоит копейки."}
              </Text>
              <View style={s.illustrationBox}>
                {[
                  "Открой любую сохранённую карточку",
                  "Нажми «Анализировать»",
                  "Получи конспект с ключевыми идеями",
                ].map((text, i) => (
                  <View key={i} style={s.illustrationStep}>
                    <View style={s.illustrationStepNum}>
                      <Text style={s.illustrationStepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={s.illustrationStepText}>{text}</Text>
                    {i < 2 && (
                      <Feather name="arrow-down" size={14} color={colors.textMuted} />
                    )}
                  </View>
                ))}
              </View>
              <TouchableOpacity style={s.btnPrimary} onPress={handleStep2Continue}>
                <Text style={s.btnPrimaryText}>Отлично!</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={s.headline}>
                Когда присылать лучшее из того что ты читал?
              </Text>
              <Text style={s.subtitle}>
                Каждый день Clip будет напоминать тебе о сохранённом.
              </Text>
              <View style={s.notifGrid}>
                <TouchableOpacity
                  style={[
                    s.notifBtn,
                    {
                      backgroundColor: colors.accentSubtle,
                      borderColor: colors.accentDim,
                    },
                  ]}
                  onPress={() => handleNotifChoice(8)}
                >
                  <Feather name="sunrise" size={22} color={colors.accent} />
                  <View>
                    <Text
                      style={[s.notifBtnText, { color: colors.foreground }]}
                    >
                      Утром
                    </Text>
                    <Text
                      style={[s.notifBtnSub, { color: colors.textSecondary }]}
                    >
                      8:00
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.notifBtn,
                    {
                      backgroundColor: colors.accentSubtle,
                      borderColor: colors.accentDim,
                    },
                  ]}
                  onPress={() => handleNotifChoice(20)}
                >
                  <Feather name="moon" size={22} color={colors.accent} />
                  <View>
                    <Text
                      style={[s.notifBtnText, { color: colors.foreground }]}
                    >
                      Вечером
                    </Text>
                    <Text
                      style={[s.notifBtnSub, { color: colors.textSecondary }]}
                    >
                      20:00
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.notifBtn,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => handleNotifChoice(null)}
                >
                  <Feather name="bell-off" size={22} color={colors.textSecondary} />
                  <View>
                    <Text
                      style={[s.notifBtnText, { color: colors.textSecondary }]}
                    >
                      Не сейчас
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
