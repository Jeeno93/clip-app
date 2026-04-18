import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { Clip } from "../storage/clips";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function sourceLabel(source: string): string {
  if (source === "manual") return "Вручную";
  return source;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface ClipCardProps {
  clip: Clip;
  onPress?: () => void;
  onLongPress?: () => void;
  compact?: boolean;
}

export default function ClipCard({
  clip,
  onPress,
  onLongPress,
  compact = false,
}: ClipCardProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[styles.accentBar, { backgroundColor: colors.primary }]}
      />
      <View style={styles.content}>
        {clip.imageUri ? (
          <Image
            source={{ uri: clip.imageUri }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : null}
        {clip.linkPreview ? (
          <View style={styles.linkPreview}>
            {clip.linkPreview.imageUrl ? (
              <Image
                source={{ uri: clip.linkPreview.imageUrl }}
                style={styles.linkImage}
                resizeMode="cover"
              />
            ) : null}
            <Text
              style={[styles.linkTitle, { color: colors.foreground }]}
              numberOfLines={2}
            >
              {clip.linkPreview.title}
            </Text>
            {clip.linkPreview.description ? (
              <Text
                style={[styles.linkDescription, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {clip.linkPreview.description}
              </Text>
            ) : null}
            <Text style={[styles.linkDomain, { color: colors.textMuted }]}>
              {getDomain(clip.linkPreview.url)}
            </Text>
            {clip.text ? (
              <Text
                style={[styles.linkComment, { color: colors.textSecondary }]}
                numberOfLines={compact ? 2 : undefined}
              >
                {clip.text}
              </Text>
            ) : null}
          </View>
        ) : clip.text ? (
          <Text
            style={[styles.text, { color: colors.foreground }]}
            numberOfLines={compact ? 4 : undefined}
          >
            {clip.text}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {sourceLabel(clip.source)} · {formatDate(clip.createdAt)}
          </Text>
        </View>
        {clip.tags.length > 0 && (
          <View style={styles.tags}>
            {clip.tags.map((tag) => (
              <View
                key={tag}
                style={[
                  styles.tag,
                  { backgroundColor: colors.accentSubtle, borderColor: colors.accentDim },
                ]}
              >
                <Text style={[styles.tagText, { color: colors.accentDim }]}>
                  #{tag}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  accentBar: {
    width: 3,
    borderRadius: 2,
    margin: 4,
    marginLeft: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  content: {
    flex: 1,
    padding: 14,
    paddingLeft: 12,
    gap: 8,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  image: {
    width: "100%",
    height: 120,
    borderRadius: 6,
  },
  linkPreview: {
    gap: 4,
  },
  linkImage: {
    width: "100%",
    height: 100,
    borderRadius: 8,
    marginBottom: 8,
  },
  linkTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Inter_600SemiBold",
  },
  linkDescription: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  linkDomain: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  linkComment: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    fontStyle: "italic",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
