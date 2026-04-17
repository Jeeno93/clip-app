import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { Clip } from "../storage/clips";
import { daysCount } from "../utils/pluralize";

interface Props {
  visible: boolean;
  onClose: () => void;
  clips: Clip[];
  streakCount: number;
}

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function StreakModal({
  visible,
  onClose,
  clips,
  streakCount,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const activeDays = useMemo(() => {
    const set = new Set<string>();
    clips.forEach((c) => {
      const d = new Date(c.createdAt);
      set.add(localDateKey(d));
    });
    return set;
  }, [clips]);

  const monthStats = useMemo(() => {
    let count = 0;
    activeDays.forEach((key) => {
      const [y, m] = key.split("-").map(Number);
      if (y === viewYear && m - 1 === viewMonth) count += 1;
    });
    return count;
  }, [activeDays, viewYear, viewMonth]);

  const grid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const jsWeekday = first.getDay();
    const leading = jsWeekday === 0 ? 6 : jsWeekday - 1;
    const cells: ({ day: number; key: string } | null)[] = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const key = localDateKey(new Date(viewYear, viewMonth, d));
      cells.push({ day: d, key });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const goNext = () => {
    const isCurrent =
      viewYear === today.getFullYear() && viewMonth === today.getMonth();
    if (isCurrent) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };
  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const todayKey = localDateKey(today);
  const cellSize = 38;
  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

  const s = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: insets.bottom + 24,
      maxHeight: "85%",
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 10,
      marginBottom: 8,
    },
    closeBtn: {
      position: "absolute",
      top: 14,
      right: 14,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bgInput,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2,
    },
    headerWrap: {
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 16,
      alignItems: "center",
    },
    flameRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    flame: {
      fontSize: 28,
      marginRight: 8,
    },
    bigCount: {
      fontSize: 36,
      fontFamily: "Inter_700Bold",
      color: colors.accent,
    },
    bigLabel: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      marginTop: 2,
    },
    monthHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 24,
      paddingVertical: 10,
    },
    monthTitle: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bgInput,
    },
    navBtnDisabled: {
      opacity: 0.3,
    },
    weekRow: {
      flexDirection: "row",
      paddingHorizontal: 20,
      marginBottom: 6,
    },
    weekday: {
      flex: 1,
      textAlign: "center",
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    grid: {
      paddingHorizontal: 20,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    cell: {
      width: cellSize,
      height: cellSize,
      borderRadius: cellSize / 2,
      alignItems: "center",
      justifyContent: "center",
    },
    cellEmpty: {
      backgroundColor: "transparent",
    },
    cellInactive: {
      backgroundColor: colors.bgInput,
    },
    cellActive: {
      backgroundColor: colors.accent,
    },
    cellToday: {
      borderWidth: 2,
      borderColor: colors.accent,
    },
    cellText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.textSecondary,
    },
    cellTextActive: {
      color: colors.background,
      fontFamily: "Inter_600SemiBold",
    },
    cellTextToday: {
      color: colors.accent,
      fontFamily: "Inter_600SemiBold",
    },
    statsRow: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 8,
      alignItems: "center",
    },
    statsText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
    },
    statsAccent: {
      color: colors.accent,
      fontFamily: "Inter_600SemiBold",
    },
    motivation: {
      paddingHorizontal: 24,
      paddingTop: 8,
      alignItems: "center",
    },
    motivationText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 18,
    },
  });

  const motivation =
    streakCount === 0
      ? "Сохрани цитату сегодня, чтобы начать цепочку."
      : streakCount < 3
        ? "Хорошее начало. Продолжай!"
        : streakCount < 7
          ? "Привычка формируется. Не останавливайся."
          : streakCount < 30
            ? "Впечатляюще. Цепочка крепнет с каждым днём."
            : "Это уже стиль жизни. Так держать.";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={s.handle} />
          <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={8}>
            <Feather name="x" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 4 }}
          >
            <View style={s.headerWrap}>
              <View style={s.flameRow}>
                <Text style={s.flame}>🔥</Text>
                <Text style={s.bigCount}>{streakCount}</Text>
              </View>
              <Text style={s.bigLabel}>
                {streakCount === 0
                  ? "цепочки пока нет"
                  : `${daysCount(streakCount)} подряд`}
              </Text>
            </View>

            <View style={s.monthHeader}>
              <TouchableOpacity style={s.navBtn} onPress={goPrev} hitSlop={8}>
                <Feather
                  name="chevron-left"
                  size={20}
                  color={colors.foreground}
                />
              </TouchableOpacity>
              <Text style={s.monthTitle}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity
                style={[s.navBtn, isCurrentMonth && s.navBtnDisabled]}
                onPress={goNext}
                disabled={isCurrentMonth}
                hitSlop={8}
              >
                <Feather
                  name="chevron-right"
                  size={20}
                  color={colors.foreground}
                />
              </TouchableOpacity>
            </View>

            <View style={s.weekRow}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={s.weekday}>
                  {w}
                </Text>
              ))}
            </View>

            <View style={s.grid}>
              {Array.from({ length: grid.length / 7 }).map((_, rowIdx) => (
                <View key={rowIdx} style={s.row}>
                  {grid
                    .slice(rowIdx * 7, rowIdx * 7 + 7)
                    .map((cell, colIdx) => {
                      if (!cell) {
                        return (
                          <View
                            key={`e-${rowIdx}-${colIdx}`}
                            style={[s.cell, s.cellEmpty]}
                          />
                        );
                      }
                      const isActive = activeDays.has(cell.key);
                      const isToday = cell.key === todayKey;
                      return (
                        <View
                          key={cell.key}
                          style={[
                            s.cell,
                            isActive ? s.cellActive : s.cellInactive,
                            isToday && !isActive && s.cellToday,
                          ]}
                        >
                          <Text
                            style={[
                              s.cellText,
                              isActive && s.cellTextActive,
                              isToday && !isActive && s.cellTextToday,
                            ]}
                          >
                            {cell.day}
                          </Text>
                        </View>
                      );
                    })}
                </View>
              ))}
            </View>

            <View style={s.statsRow}>
              <Text style={s.statsText}>
                В этом месяце:{" "}
                <Text style={s.statsAccent}>{daysCount(monthStats)}</Text> с
                цитатами
              </Text>
            </View>

            <View style={s.motivation}>
              <Text style={s.motivationText}>{motivation}</Text>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
