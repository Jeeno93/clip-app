import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
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

interface DomainPickerModalProps {
  visible: boolean;
  onClose: () => void;
  currentDomainId: string | null | undefined;
  onSelect: (domainId: string | null) => void | Promise<void>;
  onCreateNew: () => void;
}

export default function DomainPickerModal({
  visible,
  onClose,
  currentDomainId,
  onSelect,
  onCreateNew,
}: DomainPickerModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { domains } = useClips();

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
      paddingBottom: (Platform.OS === "web" ? 24 : insets.bottom) + 14,
      maxHeight: "70%",
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      fontSize: 17,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    cancelText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
    },
    item: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    itemActive: {
      backgroundColor: colors.accentSubtle,
    },
    itemIcon: {
      fontSize: 20,
      width: 26,
      textAlign: "center",
    },
    itemText: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    check: {
      color: colors.accent,
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 6,
    },
    addText: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.accent,
    },
  });

  const handleSelect = async (id: string | null) => {
    Haptics.selectionAsync();
    // Wait for the move to commit so the underlying screen re-renders with
    // the new domainId before we close — avoids a flash of stale data.
    try {
      await onSelect(id);
    } finally {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={s.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={s.sheet}>
            <View style={s.header}>
              <Text style={s.title}>Переместить в домен</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={s.cancelText}>Отмена</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  s.item,
                  (currentDomainId === null || currentDomainId === undefined) &&
                    s.itemActive,
                ]}
                onPress={() => handleSelect(null)}
              >
                <Text style={s.itemIcon}>📥</Text>
                <Text style={s.itemText}>Входящие</Text>
                {(currentDomainId === null ||
                  currentDomainId === undefined) && (
                  <Text style={s.check}>✓</Text>
                )}
              </TouchableOpacity>

              {domains.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[s.item, currentDomainId === d.id && s.itemActive]}
                  onPress={() => handleSelect(d.id)}
                >
                  <Text style={s.itemIcon}>{d.icon || "📁"}</Text>
                  <Text style={s.itemText}>{d.name}</Text>
                  {currentDomainId === d.id && (
                    <Text style={s.check}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}

              <View style={s.divider} />

              <TouchableOpacity
                style={s.item}
                onPress={() => {
                  onClose();
                  onCreateNew();
                }}
              >
                <Text style={s.itemIcon}>+</Text>
                <Text style={s.addText}>Создать домен</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
