import React from "react";
import { Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  text: string;
}

const spacing = { xs: 4, sm: 8, md: 16 };
const fontSize = { base: 14, md: 15, lg: 17 };

function renderInlineBold(
  line: string,
  baseStyle: object,
  key: number
): React.ReactElement {
  const parts = line.split(/(\*\*[^*]+\*\*)/);
  if (parts.length === 1) {
    return (
      <Text key={key} style={baseStyle}>
        {line}
      </Text>
    );
  }
  return (
    <Text key={key} style={baseStyle}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <Text key={i} style={{ fontFamily: "Inter_700Bold" }}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

export default function MarkdownText({ text }: Props) {
  const colors = useColors();

  const paragraph = {
    color: colors.foreground,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.6,
    fontFamily: "Inter_400Regular",
  };

  return (
    <View>
      {text.split("\n").map((line, idx) => {
        const trimmed = line.trimEnd();

        if (trimmed.trim() === "") {
          return <View key={idx} style={{ marginBottom: spacing.xs }} />;
        }

        if (trimmed.startsWith("### ")) {
          return (
            <Text
              key={idx}
              style={{
                fontSize: fontSize.md,
                fontFamily: "Inter_700Bold",
                color: colors.foreground,
                marginTop: spacing.sm,
                marginBottom: 4,
              }}
            >
              {trimmed.slice(4)}
            </Text>
          );
        }

        if (trimmed.startsWith("## ")) {
          return (
            <Text
              key={idx}
              style={{
                fontSize: fontSize.lg,
                fontFamily: "Inter_700Bold",
                color: colors.foreground,
                marginTop: spacing.md,
                marginBottom: 4,
              }}
            >
              {trimmed.slice(3)}
            </Text>
          );
        }

        if (
          trimmed.startsWith("**") &&
          trimmed.endsWith("**") &&
          trimmed.length > 4
        ) {
          return (
            <Text
              key={idx}
              style={{
                fontFamily: "Inter_700Bold",
                color: colors.foreground,
                fontSize: fontSize.base,
                lineHeight: fontSize.base * 1.6,
              }}
            >
              {trimmed.slice(2, -2)}
            </Text>
          );
        }

        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          return renderInlineBold(
            "• " + trimmed.slice(2),
            { ...paragraph, paddingLeft: spacing.sm },
            idx
          );
        }

        return renderInlineBold(trimmed, paragraph, idx);
      })}
    </View>
  );
}
