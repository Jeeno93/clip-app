import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import ClipCard from "../../src/components/ClipCard";
import CreateDomainModal from "../../src/components/CreateDomainModal";
import DomainPickerModal from "../../src/components/DomainPickerModal";
import Sidebar, { ActiveDomain } from "../../src/components/Sidebar";
import TagPicker from "../../src/components/TagPicker";
import { useClips } from "../../src/context/ClipsContext";
import { deleteClip, updateClip } from "../../src/storage/clips";
import { clipsCount } from "../../src/utils/pluralize";

export default function ArchiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { clips, allTags, removeClip, domains, refresh } = useClips();
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeDomainId, setActiveDomainId] = useState<ActiveDomain>("all");
  const [createDomainOpen, setCreateDomainOpen] = useState(false);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDomainPickerOpen, setBulkDomainPickerOpen] = useState(false);
  const [bulkTagModalOpen, setBulkTagModalOpen] = useState(false);
  const [bulkSelectedTags, setBulkSelectedTags] = useState<string[]>([]);

  // Honour deeplink ?domain=inbox|all|<id> from Home etc.
  // We only consume the param ONCE per distinct value — otherwise re-focusing
  // the tab would override a manual selection by the user.
  const params = useLocalSearchParams<{ domain?: string }>();
  const lastAppliedParamRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const d = params.domain;
    if (!d || d === lastAppliedParamRef.current) return;
    lastAppliedParamRef.current = d;
    if (d === "inbox") setActiveDomainId(null);
    else if (d === "all") setActiveDomainId("all");
    else setActiveDomainId(d);
  }, [params.domain]);

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

  const toggleTag = (tag: string) => {
    Haptics.selectionAsync();
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const filtered = useMemo(() => {
    let result = clips;

    // Domain filter (always applied first).
    if (activeDomainId === null) {
      result = result.filter((c) => !c.domainId);
    } else if (activeDomainId !== "all") {
      result = result.filter((c) => c.domainId === activeDomainId);
    }

    if (activeTags.length > 0) {
      result = result.filter((c) =>
        activeTags.every((t) => c.tags.includes(t))
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.text.toLowerCase().includes(q) ||
          (c.title?.toLowerCase().includes(q) ?? false) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [clips, search, activeTags, activeDomainId]);

  const hasActiveFilter = search.trim().length > 0 || activeTags.length > 0;

  const totalForDomain = useMemo(() => {
    if (activeDomainId === "all") return clips.length;
    if (activeDomainId === null) return clips.filter((c) => !c.domainId).length;
    return clips.filter((c) => c.domainId === activeDomainId).length;
  }, [clips, activeDomainId]);

  const headerTitle = useMemo(() => {
    if (activeDomainId === "all") return "Твоя база знаний";
    if (activeDomainId === null) return "📥 Входящие";
    const d = domains.find((x) => x.id === activeDomainId);
    if (!d) return "Твоя база знаний";
    return `${d.icon || "📁"} ${d.name}`;
  }, [activeDomainId, domains]);

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Удалить идею?",
      "Это действие нельзя отменить.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: () => removeClip(id),
        },
      ]
    );
  };

  const enterSelection = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    Haptics.selectionAsync();
    setSelectedIds(new Set(filtered.map((c) => c.id)));
  };

  const handleBulkMove = async (domainId: string | null) => {
    const count = selectedIds.size;
    for (const id of selectedIds) {
      await updateClip(id, { domainId: domainId ?? undefined });
    }
    await refresh();
    setBulkDomainPickerOpen(false);
    cancelSelection();
    Alert.alert("Готово", `${count} идей перемещено`);
  };

  const handleBulkTag = async () => {
    if (bulkSelectedTags.length === 0) return;
    const count = selectedIds.size;
    for (const id of selectedIds) {
      const clip = clips.find((c) => c.id === id);
      if (clip) {
        const newTags = [...new Set([...clip.tags, ...bulkSelectedTags])];
        await updateClip(id, { tags: newTags });
      }
    }
    await refresh();
    setBulkTagModalOpen(false);
    setBulkSelectedTags([]);
    cancelSelection();
    Alert.alert("Готово", `Теги добавлены к ${count} идеям`);
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Удалить идеи?",
      `Удалить ${count} идей? Это действие нельзя отменить.`,
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            for (const id of selectedIds) {
              await deleteClip(id);
            }
            await refresh();
            cancelSelection();
          },
        },
      ]
    );
  };

  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 16,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    menuBtn: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: -8,
    },
    titleCol: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    count: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bgInput,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 42,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    tagsScroll: {
      marginTop: 4,
    },
    tagsContent: {
      gap: 8,
      paddingRight: 4,
    },
    tagChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
    },
    tagText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 20,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      textAlign: "center",
    },
    selectionHeader: {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    selectionCancel: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
      paddingVertical: 4,
    },
    selectionCount: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    selectionAll: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.accent,
      paddingVertical: 4,
    },
    actionBar: {
      backgroundColor: colors.bgCard,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexDirection: "row",
      justifyContent: "space-around",
      paddingVertical: 12,
      paddingBottom: (Platform.OS === "web" ? 12 : insets.bottom) + 12,
    },
    actionBtn: {
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 16,
    },
    actionBtnEmoji: {
      fontSize: 22,
    },
    actionBtnText: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    tagModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    tagModalSheet: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 18,
      paddingHorizontal: 20,
      paddingBottom: (Platform.OS === "web" ? 24 : insets.bottom) + 18,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      maxHeight: "70%",
    },
    tagModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    tagModalTitle: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    tagModalCancel: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.textSecondary,
    },
    addTagsBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 16,
    },
    addTagsBtnText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
  });

  const tags = ["Все", ...allTags];

  return (
    <View style={s.container}>
      {selectionMode ? (
        <View style={s.selectionHeader}>
          <TouchableOpacity onPress={cancelSelection}>
            <Text style={s.selectionCancel}>Отмена</Text>
          </TouchableOpacity>
          <Text style={s.selectionCount}>Выбрано: {selectedIds.size}</Text>
          <TouchableOpacity onPress={selectAll}>
            <Text style={s.selectionAll}>Выбрать все</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <View style={s.header}>
        <View style={s.titleRow}>
          <TouchableOpacity
            style={s.menuBtn}
            onPress={() => {
              Haptics.selectionAsync();
              setSidebarOpen(true);
            }}
            hitSlop={8}
          >
            <Feather name="menu" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={s.titleCol}>
            <Text style={s.title} numberOfLines={1}>
              {headerTitle}
            </Text>
            <Text style={s.count}>
              {hasActiveFilter
                ? `${filtered.length} из ${clipsCount(totalForDomain)}`
                : clipsCount(totalForDomain)}
            </Text>
          </View>
        </View>
        <View style={s.searchRow}>
          <Feather name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск по тексту или тегу..."
            placeholderTextColor={colors.textMuted}
            style={s.searchInput}
            clearButtonMode="while-editing"
          />
          {search.length > 0 && Platform.OS !== "ios" && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {allTags.length > 0 && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.tagsScroll}
              contentContainerStyle={s.tagsContent}
            >
              {tags.map((tag) => {
                const isAll = tag === "Все";
                const isActive = isAll
                  ? activeTags.length === 0
                  : activeTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => {
                      if (isAll) {
                        Haptics.selectionAsync();
                        setActiveTags([]);
                      } else {
                        toggleTag(tag);
                      }
                    }}
                    style={[
                      s.tagChip,
                      {
                        backgroundColor: isActive
                          ? colors.accent
                          : colors.bgCard,
                        borderColor: isActive
                          ? colors.accent
                          : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.tagText,
                        {
                          color: isActive
                            ? colors.primaryForeground
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {isAll ? tag : `#${tag}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              onPress={() => router.push("/tags")}
              hitSlop={8}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                  color: colors.textMuted,
                  textAlign: "right",
                }}
              >
                Управление тегами →
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      )}

      {filtered.length === 0 ? (
        <View style={s.emptyContainer}>
          <Feather name="inbox" size={36} color={colors.textMuted} />
          <Text style={s.emptyText}>
            {clips.length === 0
              ? "Архив пуст. Начни сохранять идеи!"
              : "Ничего не найдено"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ClipCard
              clip={item}
              onPress={() => {
                if (selectionMode) {
                  toggleSelected(item.id);
                } else {
                  router.push({ pathname: "/clip/[id]", params: { id: item.id } });
                }
              }}
              onLongPress={() => {
                if (!selectionMode) enterSelection(item.id);
              }}
              selectionMode={selectionMode}
              selected={selectedIds.has(item.id)}
              compact
            />
          )}
          contentContainerStyle={[
            s.listContent,
            selectionMode && selectedIds.size > 0 && { paddingBottom: 100 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {selectionMode && selectedIds.size > 0 && (
        <View style={s.actionBar}>
          <TouchableOpacity style={s.actionBtn} onPress={() => setBulkDomainPickerOpen(true)}>
            <Text style={s.actionBtnEmoji}>📁</Text>
            <Text style={s.actionBtnText}>В домен</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => {
            setBulkSelectedTags([]);
            setBulkTagModalOpen(true);
          }}>
            <Text style={s.actionBtnEmoji}>#</Text>
            <Text style={s.actionBtnText}>Теги</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={handleBulkDelete}>
            <Text style={s.actionBtnEmoji}>🗑</Text>
            <Text style={s.actionBtnText}>Удалить</Text>
          </TouchableOpacity>
        </View>
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeDomainId={activeDomainId}
        onSelectDomain={(id) => {
          setActiveDomainId(id);
          setSidebarOpen(false);
        }}
        onCreateDomain={() => {
          setSidebarOpen(false);
          setCreateDomainOpen(true);
        }}
      />

      <CreateDomainModal
        visible={createDomainOpen}
        onClose={() => setCreateDomainOpen(false)}
        onCreated={(d) => setActiveDomainId(d.id)}
      />

      <DomainPickerModal
        visible={bulkDomainPickerOpen}
        onClose={() => setBulkDomainPickerOpen(false)}
        currentDomainId={undefined}
        onSelect={handleBulkMove}
        onCreateNew={() => {
          setBulkDomainPickerOpen(false);
          setCreateDomainOpen(true);
        }}
      />

      <Modal
        visible={bulkTagModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setBulkTagModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={s.tagModalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setBulkTagModalOpen(false)} activeOpacity={1} />
          <View style={s.tagModalSheet}>
            <View style={s.tagModalHeader}>
              <Text style={s.tagModalTitle}>Добавить теги к выбранным идеям</Text>
              <TouchableOpacity onPress={() => setBulkTagModalOpen(false)}>
                <Text style={s.tagModalCancel}>Отмена</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TagPicker
                selected={bulkSelectedTags}
                existingTags={allTags}
                onChange={setBulkSelectedTags}
              />
            </ScrollView>
            <TouchableOpacity
              style={[s.addTagsBtn, bulkSelectedTags.length === 0 && { opacity: 0.5 }]}
              onPress={handleBulkTag}
              disabled={bulkSelectedTags.length === 0}
            >
              <Text style={s.addTagsBtnText}>Добавить</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
