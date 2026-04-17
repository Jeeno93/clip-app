import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { daysCount } from "../utils/pluralize";

interface Props {
  count: number;
  active: boolean;
  onPress: () => void;
}

export default function StreakBadge({ count, active, onPress }: Props) {
  const colors = useColors();

  const s = StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: active ? colors.accentSubtle : colors.bgInput,
      borderWidth: 1,
      borderColor: active ? colors.accent : colors.border,
    },
    flame: {
      fontSize: 14,
      marginRight: 6,
      opacity: active ? 1 : 0.5,
    },
    text: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: active ? colors.accent : colors.textSecondary,
    },
    label: {
      fontFamily: "Inter_400Regular",
      color: active ? colors.accent : colors.textSecondary,
      opacity: 0.85,
    },
  });

  if (count <= 0) {
    return (
      <TouchableOpacity style={s.pill} onPress={onPress} activeOpacity={0.7}>
        <Text style={s.flame}>🔥</Text>
        <Text style={[s.text, s.label]}>Начни цепочку</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={s.pill} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.flame}>🔥</Text>
      <Text style={s.text}>{daysCount(count)}</Text>
    </TouchableOpacity>
  );
}
