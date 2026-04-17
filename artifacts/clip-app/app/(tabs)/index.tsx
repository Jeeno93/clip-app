import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import ClipCard from "../../src/components/ClipCard";
import { useClips } from "../../src/context/ClipsContext";
import { Clip } from "../../src/storage/clips";
import { clipsCount, daysCount } from "../../src/utils/pluralize";

function formatHeaderDate(): string {
  const d = new Date();
  const days = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { clips, dailyCards, streak, loading, reachedLimit, addClip, refresh } =
    useClips();
  const [quickText, setQuickText] = useState("");
  const [adding, setAdding] = useState(false);
  const [surpriseClip, setSurpriseClip] = useState<Clip | null>(null);
  const [showSurprise, setShowSurprise] = useState(false);
  const surpriseAnim = useRef(new Animated.Value(0)).current;

  const todayStr = new Date().toDateString();
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toDateString();
  })();
  const showStreak =
    streak.count >= 1 &&
    (streak.lastDate === todayStr || streak.lastDate === yesterdayStr);

  useEffect(() => {
    refresh();
  }, []);

  const handleSurprise = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (clips.length === 0) return;
    const clip = clips[Math.floor(Math.random() * clips.length)];
    setSurpriseClip(clip);
    setShowSurprise(true);
    Animated.spring(surpriseAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 8,
    }).start();
  };

  const closeSurprise = () => {
    Animated.timing(surpriseAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowSurprise(false);
      setSurpriseClip(null);
    });
  };

  const handleQuickAdd = async () => {
    const t = quickText.trim();
    if (!t) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAdding(true);
    await addClip(t, [], "manual");
    setQuickText("");
    setAdding(false);
  };

  const isEmpty = !loading && clips.length === 0;
  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    headerTextCol: {
      flex: 1,
    },
    settingsBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginTop: -2,
    },
    streakLine: {
      marginTop: 4,
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.textMuted,
    },
    streakFlame: {
      fontSize: 12,
    },
    streakNumber: {
      color: colors.accent,
      fontFamily: "Inter_600SemiBold",
    },
    dateText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 4,
    },
    titleText: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    accentDot: {
      color: colors.accent,
    },
    archiveCount: {
      marginTop: 6,
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.textMuted,
    },
    archiveCountNumber: {
      color: colors.accent,
      fontFamily: "Inter_500Medium",
    },
    section: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    sectionLabel: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: 14,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
      gap: 16,
      paddingBottom: 40,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accentSubtle,
      borderWidth: 1,
      borderColor: colors.accentDim,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      textAlign: "center",
    },
    emptySubtitle: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    emptyBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 28,
      marginTop: 8,
    },
    emptyBtnText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    surpriseRow: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
    },
    surpriseBtn: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.accentDim,
      backgroundColor: colors.accentSubtle,
      paddingVertical: 13,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    surpriseBtnText: {
      color: colors.accent,
      fontSize: 15,
      fontFamily: "Inter_500Medium",
    },
    quickAdd: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 10,
    },
    quickInput: {
      flex: 1,
      height: 42,
      backgroundColor: colors.bgInput,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    quickBtn: {
      width: 42,
      height: 42,
      backgroundColor: colors.primary,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    surpriseCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      width: "100%",
      maxWidth: 400,
    },
    surpriseLabel: {
      fontSize: 10,
      fontFamily: "Inter_500Medium",
      color: colors.accent,
      textTransform: "uppercase",
      letterSpacing: 2,
      marginBottom: 16,
    },
    surpriseText: {
      fontSize: 18,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      lineHeight: 28,
      marginBottom: 20,
    },
    surpriseClose: {
      alignSelf: "flex-end",
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    surpriseCloseText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    fab: {
      position: "absolute",
      right: 20,
      bottom:
        (Platform.OS === "web" ? 34 : insets.bottom) + 80,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
  });

  if (loading) {
    return (
      <View style={[s.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTopRow}>
          <View style={s.headerTextCol}>
            <Text style={s.dateText}>{formatHeaderDate()}</Text>
            <Text style={s.titleText}>
              Сегодняшние <Text style={s.accentDot}>открытия</Text>
            </Text>
            {clips.length > 0 && (
              <Text style={s.archiveCount}>
                <Text style={s.archiveCountNumber}>{clips.length}</Text>
                {` ${clipsCount(clips.length).split(" ")[1]} в архиве`}
              </Text>
            )}
            {showStreak && (
              <Text style={s.streakLine}>
                <Text style={s.streakFlame}>🔥 </Text>
                <Text style={s.streakNumber}>{streak.count}</Text>
                {` ${daysCount(streak.count).split(" ")[1]} подряд`}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={s.settingsBtn}
            onPress={() => router.push("/settings")}
            hitSlop={8}
          >
            <Feather name="settings" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {isEmpty ? (
        <View style={s.emptyContainer}>
          <View style={s.emptyIcon}>
            <Feather name="bookmark" size={28} color={colors.accent} />
          </View>
          <Text style={s.emptyTitle}>Архив пуст</Text>
          <Text style={s.emptySubtitle}>
            Сохрани первую идею — и каждый день она будет возвращаться к тебе
          </Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={() => router.push("/add")}
          >
            <Text style={s.emptyBtnText}>Сохранить первую идею</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={dailyCards}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ClipCard
                clip={item}
                onPress={() =>
                  router.push({ pathname: "/clip/[id]", params: { id: item.id } })
                }
                compact
              />
            )}
            ListHeaderComponent={
              <View style={{ paddingTop: 20, marginBottom: 4 }}>
                <Text style={s.sectionLabel}>Сегодня</Text>
              </View>
            }
            ListFooterComponent={
              <View style={s.surpriseRow}>
                <TouchableOpacity
                  style={s.surpriseBtn}
                  onPress={handleSurprise}
                >
                  <Text style={{ color: colors.accent }}>✦</Text>
                  <Text style={s.surpriseBtnText}>Удиви меня</Text>
                </TouchableOpacity>
              </View>
            }
            contentContainerStyle={s.listContent}
            scrollEnabled={dailyCards.length > 0}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      <View style={s.quickAdd}>
        <TextInput
          value={quickText}
          onChangeText={setQuickText}
          placeholder="Быстро добавить идею..."
          placeholderTextColor={colors.textMuted}
          style={s.quickInput}
          onSubmitEditing={handleQuickAdd}
          returnKeyType="done"
          editable={!reachedLimit}
        />
        <TouchableOpacity
          style={[s.quickBtn, (!quickText.trim() || reachedLimit) && { opacity: 0.5 }]}
          onPress={handleQuickAdd}
          disabled={!quickText.trim() || reachedLimit || adding}
        >
          {adding ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Feather name="check" size={20} color={colors.primaryForeground} />
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push("/add")}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color={colors.primaryForeground} />
      </TouchableOpacity>

      <Modal
        visible={showSurprise}
        transparent
        animationType="none"
        onRequestClose={closeSurprise}
      >
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={closeSurprise}
        >
          <Animated.View
            style={[
              s.surpriseCard,
              {
                opacity: surpriseAnim,
                transform: [
                  {
                    scale: surpriseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.85, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={s.surpriseLabel}>✦ Из архива</Text>
            {surpriseClip && (
              <>
                <Text style={s.surpriseText}>{surpriseClip.text}</Text>
                {surpriseClip.tags.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                    {surpriseClip.tags.map((t) => (
                      <View
                        key={t}
                        style={{
                          backgroundColor: colors.accentSubtle,
                          borderRadius: 20,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ color: colors.accentDim, fontSize: 12 }}>#{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
            <TouchableOpacity style={s.surpriseClose} onPress={closeSurprise}>
              <Text style={s.surpriseCloseText}>Закрыть</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
