import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { useColors } from "@/hooks/useColors";
import CreateContentTypeModal from "../src/components/CreateContentTypeModal";
import {
  ContentType,
  deleteCustomContentType,
  getAllContentTypes,
} from "../src/storage/clips";

export default function ContentTypesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [types, setTypes] = useState<ContentType[]>([]);
  const [createVisible, setCreateVisible] = useState(false);

  const load = useCallback(async () => {
    setTypes(await getAllContentTypes());
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const handleDelete = (type: ContentType) => {
    if (type.isBuiltIn) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Удалить тип?",
      `"${type.name}" будет удалён. Карточки с этим типом не пострадают.`,
      [
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            await deleteCustomContentType(type.id);
            await load();
          },
        },
        { text: "Отмена", style: "cancel" },
      ]
    );
  };

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
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
    backBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    list: {
      padding: 16,
      gap: 8,
      paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.bgCard,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    icon: { fontSize: 22, width: 32, textAlign: "center" },
    name: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    builtInBadge: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.textMuted,
    },
    deleteBtn: {
      padding: 6,
    },
    addBtn: {
      margin: 16,
      marginTop: 8,
      backgroundColor: colors.accentSubtle,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.accent,
      paddingVertical: 14,
      alignItems: "center",
    },
    addBtnText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.accent,
    },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Типы контента</Text>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {types.map((type) => (
          <View key={type.id} style={s.row}>
            <Text style={s.icon}>{type.icon}</Text>
            <Text style={s.name}>{type.name}</Text>
            {type.isBuiltIn ? (
              <Text style={s.builtInBadge}>встроенный</Text>
            ) : (
              <TouchableOpacity
                style={s.deleteBtn}
                onPress={() => handleDelete(type)}
              >
                <Feather name="trash-2" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={s.addBtn} onPress={() => setCreateVisible(true)}>
        <Text style={s.addBtnText}>+ Добавить свой тип</Text>
      </TouchableOpacity>

      <CreateContentTypeModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={async () => {
          setCreateVisible(false);
          await load();
        }}
      />
    </View>
  );
}
