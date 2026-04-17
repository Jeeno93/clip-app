import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
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
import { getSettings, saveSettings, ThemeMode } from "../src/storage/clips";

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

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setHour(s.notificationHour);
      setLoading(false);
    })();
  }, []);

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
