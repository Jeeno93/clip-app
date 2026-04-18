import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useTheme } from "../src/context/ThemeContext";
import {
  cancelDailyDigest,
  requestNotificationPermission,
  scheduleDailyDigest,
} from "../src/notifications/digest";
import {
  AiDepth,
  AiModules,
  AiProvider,
  getSettings,
  saveSettings,
  ThemeMode,
} from "../src/storage/clips";

const PROVIDERS: {
  value: AiProvider;
  label: string;
  pricing: string;
  placeholder: string;
  hint: string;
}[] = [
  {
    value: "gemini",
    label: "Gemini",
    pricing: "Бесплатно",
    placeholder: "AIza...",
    hint: "Получить ключ: aistudio.google.com",
  },
  {
    value: "claude",
    label: "Claude",
    pricing: "Платно",
    placeholder: "sk-ant-...",
    hint: "Получить ключ: console.anthropic.com",
  },
  {
    value: "openai",
    label: "OpenAI",
    pricing: "Платно",
    placeholder: "sk-...",
    hint: "Получить ключ: platform.openai.com",
  },
];

const DEPTH_OPTIONS: { value: AiDepth; label: string }[] = [
  { value: "quick", label: "Быстро" },
  { value: "standard", label: "Стандарт" },
  { value: "deep", label: "Глубоко" },
];

const MODULE_OPTIONS: { key: keyof AiModules; label: string }[] = [
  { key: "keyIdeas", label: "Ключевые идеи" },
  { key: "terms", label: "Объяснение терминов" },
  { key: "aiPerspective", label: "Взгляд AI на материал" },
  { key: "questions", label: "Вопросы для размышления" },
  { key: "practical", label: "Практическое применение" },
];

const HOUR_OPTIONS = [7, 8, 9, 10, 12, 14, 17, 19, 20, 21, 22];

const THEME_OPTIONS: {
  value: ThemeMode;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}[] = [
  { value: "dark", label: "Тёмная", icon: "moon" },
  { value: "light", label: "Светлая", icon: "sun" },
  { value: "system", label: "Системная", icon: "smartphone" },
];

function formatHour(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  const [hour, setHour] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingHour, setSavingHour] = useState(false);

  // AI settings state
  const [aiProvider, setAiProvider] = useState<AiProvider | null>(null);
  const [aiApiKey, setAiApiKey] = useState<string>("");
  const [aiKeyDraft, setAiKeyDraft] = useState<string>("");
  const [aiDepth, setAiDepth] = useState<AiDepth>("standard");
  const [aiModules, setAiModules] = useState<AiModules>({
    keyIdeas: true,
    terms: true,
    aiPerspective: false,
    questions: false,
    practical: false,
  });
  const [keyJustSaved, setKeyJustSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const st = await getSettings();
      setHour(st.notificationHour);
      setAiProvider(st.aiProvider);
      setAiApiKey(st.aiApiKey ?? "");
      setAiKeyDraft(st.aiApiKey ?? "");
      setAiDepth(st.aiDepth);
      setAiModules(st.aiModules);
      setLoading(false);
    })();
  }, []);

  const handleProviderChoice = async (provider: AiProvider) => {
    if (provider === aiProvider) return;
    Haptics.selectionAsync();
    setAiProvider(provider);
    setKeyJustSaved(false);
    await saveSettings({ aiProvider: provider });
  };

  const handleSaveApiKey = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const trimmed = aiKeyDraft.trim();
    setAiApiKey(trimmed);
    await saveSettings({ aiApiKey: trimmed.length > 0 ? trimmed : null });
    setKeyJustSaved(true);
  };

  const handleDepthChoice = async (depth: AiDepth) => {
    if (depth === aiDepth) return;
    Haptics.selectionAsync();
    setAiDepth(depth);
    await saveSettings({ aiDepth: depth });
  };

  const handleModuleToggle = async (key: keyof AiModules) => {
    Haptics.selectionAsync();
    const next = { ...aiModules, [key]: !aiModules[key] };
    setAiModules(next);
    await saveSettings({ aiModules: next });
  };

  const currentProvider = PROVIDERS.find((p) => p.value === aiProvider);

  const handleHourChoice = async (newHour: number | null) => {
    Haptics.selectionAsync();
    setSavingHour(true);
    try {
      if (newHour === null) {
        await cancelDailyDigest();
        await saveSettings({ notificationHour: null });
        setHour(null);
      } else {
        const granted = await requestNotificationPermission();
        if (granted) {
          await scheduleDailyDigest(newHour);
        }
        await saveSettings({ notificationHour: newHour });
        setHour(newHour);
      }
    } finally {
      setSavingHour(false);
    }
  };

  const handleThemeChoice = async (mode: ThemeMode) => {
    if (mode === themeMode) return;
    Haptics.selectionAsync();
    await setThemeMode(mode);
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
      gap: 12,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    scrollContent: {
      padding: 24,
      paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24,
      gap: 32,
    },
    section: {
      gap: 12,
    },
    sectionLabel: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: 4,
    },
    sectionHint: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      lineHeight: 19,
      marginBottom: 8,
    },
    hourGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    hourChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      minWidth: 64,
      alignItems: "center",
    },
    hourChipText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
    },
    offBtn: {
      marginTop: 4,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: hour === null ? colors.bgInput : "transparent",
    },
    offBtnText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
    },
    themeRow: {
      flexDirection: "row",
      gap: 8,
    },
    themeChip: {
      flex: 1,
      paddingVertical: 16,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
      gap: 8,
    },
    themeChipLabel: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 6,
      minHeight: 18,
    },
    statusText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
    },
    providerRow: {
      flexDirection: "row",
      gap: 8,
    },
    providerCard: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 6,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
      gap: 4,
    },
    providerLabel: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
    providerPricing: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.textMuted,
    },
    apiKeyInput: {
      backgroundColor: colors.bgInput,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    saveKeyBtn: {
      backgroundColor: colors.accent,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 8,
    },
    saveKeyBtnText: {
      color: colors.primaryForeground,
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
    keyStatus: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.accent,
      marginTop: 6,
      minHeight: 16,
    },
    keyHint: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.textMuted,
      marginTop: 6,
    },
    depthRow: {
      flexDirection: "row",
      gap: 8,
    },
    depthChip: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center",
    },
    depthChipText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
    },
    moduleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
    },
    moduleLabel: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      flex: 1,
    },
  });

  if (loading) {
    return (
      <View
        style={[
          s.container,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Настройки</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Notification time ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Уведомления</Text>
          <Text style={s.sectionHint}>
            Когда присылать ежедневную идею из архива.
          </Text>

          <View style={s.hourGrid}>
            {HOUR_OPTIONS.map((h) => {
              const active = hour === h;
              return (
                <TouchableOpacity
                  key={h}
                  style={[
                    s.hourChip,
                    {
                      backgroundColor: active
                        ? colors.accent
                        : colors.bgCard,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => handleHourChoice(h)}
                  disabled={savingHour}
                >
                  <Text
                    style={[
                      s.hourChipText,
                      {
                        color: active
                          ? colors.primaryForeground
                          : colors.foreground,
                      },
                    ]}
                  >
                    {formatHour(h)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={s.offBtn}
            onPress={() => handleHourChoice(null)}
            disabled={savingHour}
          >
            <Feather
              name="bell-off"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={s.offBtnText}>Не присылать</Text>
          </TouchableOpacity>

          <View style={s.statusRow}>
            {savingHour ? (
              <>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={s.statusText}>Сохраняю…</Text>
              </>
            ) : (
              <Text style={s.statusText}>
                {hour === null
                  ? "Уведомления отключены"
                  : `Активно: каждый день в ${formatHour(hour)}`}
              </Text>
            )}
          </View>
        </View>

        {/* ── AI analysis (beta) ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>AI-анализ (бета)</Text>
          <Text style={s.sectionHint}>
            Конспекты статей с помощью твоего API ключа.
          </Text>

          {/* Provider */}
          <View style={s.providerRow}>
            {PROVIDERS.map((p) => {
              const active = aiProvider === p.value;
              return (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    s.providerCard,
                    {
                      backgroundColor: active
                        ? colors.accentSubtle
                        : colors.bgCard,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => handleProviderChoice(p.value)}
                >
                  <Text
                    style={[
                      s.providerLabel,
                      { color: active ? colors.accent : colors.foreground },
                    ]}
                  >
                    {p.label}
                  </Text>
                  <Text style={s.providerPricing}>{p.pricing}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* API key */}
          {aiProvider && currentProvider && (
            <View style={{ marginTop: 16 }}>
              <TextInput
                value={aiKeyDraft}
                onChangeText={(v) => {
                  setAiKeyDraft(v);
                  setKeyJustSaved(false);
                }}
                placeholder={currentProvider.placeholder}
                placeholderTextColor={colors.textMuted}
                style={s.apiKeyInput}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <TouchableOpacity
                style={s.saveKeyBtn}
                onPress={handleSaveApiKey}
              >
                <Text style={s.saveKeyBtnText}>Сохранить</Text>
              </TouchableOpacity>
              <Text style={s.keyStatus}>
                {keyJustSaved && aiApiKey ? "Ключ сохранён ✓" : ""}
              </Text>
              <Text style={s.keyHint}>{currentProvider.hint}</Text>
            </View>
          )}

          {/* Depth */}
          {aiProvider && (
            <View style={{ marginTop: 16, gap: 8 }}>
              <Text style={s.sectionHint}>Глубина анализа</Text>
              <View style={s.depthRow}>
                {DEPTH_OPTIONS.map((d) => {
                  const active = aiDepth === d.value;
                  return (
                    <TouchableOpacity
                      key={d.value}
                      style={[
                        s.depthChip,
                        {
                          backgroundColor: active
                            ? colors.accent
                            : colors.bgCard,
                          borderColor: active ? colors.accent : colors.border,
                        },
                      ]}
                      onPress={() => handleDepthChoice(d.value)}
                    >
                      <Text
                        style={[
                          s.depthChipText,
                          {
                            color: active
                              ? colors.primaryForeground
                              : colors.foreground,
                          },
                        ]}
                      >
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Modules */}
          {aiProvider && (
            <View style={{ marginTop: 16 }}>
              <Text style={[s.sectionHint, { marginBottom: 4 }]}>
                Что включать
              </Text>
              {MODULE_OPTIONS.map((m) => (
                <View key={m.key} style={s.moduleRow}>
                  <Text style={s.moduleLabel}>{m.label}</Text>
                  <Switch
                    value={aiModules[m.key]}
                    onValueChange={() => handleModuleToggle(m.key)}
                    trackColor={{
                      true: colors.accent,
                      false: colors.border,
                    }}
                    thumbColor={
                      Platform.OS === "android"
                        ? aiModules[m.key]
                          ? colors.accent
                          : colors.bgCard
                        : undefined
                    }
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Theme ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Внешний вид</Text>
          <Text style={s.sectionHint}>
            Системная тема меняется вместе с настройками устройства.
          </Text>

          <View style={s.themeRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = themeMode === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    s.themeChip,
                    {
                      backgroundColor: active
                        ? colors.accentSubtle
                        : colors.bgCard,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => handleThemeChoice(opt.value)}
                >
                  <Feather
                    name={opt.icon}
                    size={20}
                    color={active ? colors.accent : colors.textSecondary}
                  />
                  <Text
                    style={[
                      s.themeChipLabel,
                      {
                        color: active ? colors.accent : colors.foreground,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
