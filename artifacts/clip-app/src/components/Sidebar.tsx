import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useClips } from "../context/ClipsContext";
import type { Domain } from "../storage/clips";
import EditDomainModal from "./EditDomainModal";

export type ActiveDomain = string | null | "all";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeDomainId: ActiveDomain;
  onSelectDomain: (id: ActiveDomain) => void;
  onCreateDomain: () => void;
}

const SCREEN_W = Dimensions.get("window").width;
const SIDEBAR_W = Math.min(300, SCREEN_W * 0.72);

export default function Sidebar({
  isOpen,
  onClose,
  activeDomainId,
  onSelectDomain,
  onCreateDomain,
}: SidebarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { domains, inboxCount, removeDomain, deleteDomainWithClips } =
    useClips();

  const translateX = useRef(new Animated.Value(-SIDEBAR_W)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -SIDEBAR_W,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, translateX, overlayOpacity]);

  // Swipe-left to close on the sidebar itself.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => {
        if (g.dx < 0) {
          translateX.setValue(Math.max(-SIDEBAR_W, g.dx));
        }
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -50) {
          onClose();
        } else {
          Animated.timing(translateX, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const openEditModal = (domain: Domain) => {
    setEditingDomain(domain);
    setEditModalVisible(true);
  };

  const confirmDelete = (domain: Domain) => {
    Alert.alert("Куда переместить идеи из этого домена?", "", [
      {
        text: "Во входящие",
        onPress: () => {
          removeDomain(domain.id);
          if (activeDomainId === domain.id) onSelectDomain(null);
        },
      },
      {
        text: "Удалить вместе с доменом",
        style: "destructive",
        onPress: () => {
          deleteDomainWithClips(domain.id);
          if (activeDomainId === domain.id) onSelectDomain(null);
        },
      },
      { text: "Отмена", style: "cancel" },
    ]);
  };

  const topPad = (Platform.OS === "web" ? insets.top + 67 : insets.top) + 14;

  const s = StyleSheet.create({
    overlay: {
      flex: 1,
      flexDirection: "row",
    },
    overlayBg: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: SIDEBAR_W,
      right: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    sidebar: {
      width: SIDEBAR_W,
      backgroundColor: colors.bgCard,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      paddingTop: topPad,
      paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 14,
    },
    appName: {
      paddingHorizontal: 20,
      paddingBottom: 18,
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.accent,
    },
    item: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderLeftWidth: 3,
      borderLeftColor: "transparent",
    },
    itemActive: {
      backgroundColor: colors.accentSubtle,
      borderLeftColor: colors.accent,
    },
    itemIcon: {
      fontSize: 18,
      width: 22,
      textAlign: "center",
    },
    itemText: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.textSecondary,
    },
    itemTextActive: {
      color: colors.accent,
    },
    itemBadge: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.accent,
    },
    sectionLabel: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 8,
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1.4,
    },
    addBtn: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    addText: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.accent,
    },
  });

  const renderStaticItem = (
    iconStr: string,
    label: string,
    isActive: boolean,
    onPress: () => void,
    badge?: number | null
  ) => (
    <TouchableOpacity
      style={[s.item, isActive && s.itemActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={s.itemIcon}>{iconStr}</Text>
      <Text style={[s.itemText, isActive && s.itemTextActive]} numberOfLines={1}>
        {label}
      </Text>
      {badge !== undefined && badge !== null && badge > 0 ? (
        <Text style={s.itemBadge}>{badge}</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <>
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={s.overlay}>
          <Animated.View
            style={[s.overlayBg, { opacity: overlayOpacity }]}
            pointerEvents={isOpen ? "auto" : "none"}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={onClose}
            />
          </Animated.View>

          <Animated.View
            style={[s.sidebar, { transform: [{ translateX }] }]}
            {...panResponder.panHandlers}
          >
            <Text style={s.appName}>✦ Clip</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {renderStaticItem(
                "📥",
                "Входящие",
                activeDomainId === null,
                () => onSelectDomain(null),
                inboxCount
              )}
              {renderStaticItem(
                "📚",
                "Все идеи",
                activeDomainId === "all",
                () => onSelectDomain("all")
              )}

              <Text style={s.sectionLabel}>Мои домены</Text>

              {domains.length === 0 ? (
                <Text
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 8,
                    fontSize: 13,
                    fontFamily: "Inter_400Regular",
                    color: colors.textMuted,
                  }}
                >
                  Пока нет доменов
                </Text>
              ) : (
                domains.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[s.item, activeDomainId === d.id && s.itemActive]}
                    onPress={() => onSelectDomain(d.id)}
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      Alert.alert(d.name, "", [
                        {
                          text: "Переименовать",
                          onPress: () => openEditModal(d),
                        },
                        {
                          text: "Удалить",
                          style: "destructive",
                          onPress: () => confirmDelete(d),
                        },
                        { text: "Отмена", style: "cancel" },
                      ]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={s.itemIcon}>{d.icon || "📁"}</Text>
                    <Text
                      style={[
                        s.itemText,
                        activeDomainId === d.id && s.itemTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {d.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}

              <TouchableOpacity style={s.addBtn} onPress={onCreateDomain}>
                <Text style={s.addText}>+ Новый домен</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <EditDomainModal
        visible={editModalVisible}
        domain={editingDomain}
        onClose={() => setEditModalVisible(false)}
      />
    </>
  );
}
