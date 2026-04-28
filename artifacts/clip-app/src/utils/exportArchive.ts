import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { getAllClips, getAllDomains } from "../storage/clips";

export async function exportArchive(): Promise<void> {
  const [clips, domains] = await Promise.all([
    getAllClips(),
    getAllDomains(),
  ]);

  const lines: string[] = [];

  lines.push("CLIP — МОЙ АРХИВ ИДЕЙ");
  lines.push(`Экспорт: ${format(new Date(), "d MMMM yyyy", { locale: ru })}`);
  lines.push(`Всего идей: ${clips.length}`);
  lines.push("═".repeat(50));
  lines.push("");

  const inbox = clips.filter((c) => !c.domainId);
  const byDomain = domains.map((d) => ({
    domain: d,
    clips: clips.filter((c) => c.domainId === d.id),
  }));

  if (inbox.length > 0) {
    lines.push("📥 ВХОДЯЩИЕ");
    lines.push("─".repeat(30));
    inbox.forEach((clip) => {
      lines.push("");
      if (clip.title) lines.push(`▸ ${clip.title}`);
      if (clip.linkPreview) {
        lines.push(`🔗 ${clip.linkPreview.title || clip.linkPreview.url}`);
        lines.push(`   ${clip.linkPreview.url}`);
      }
      if (clip.text) lines.push(clip.text);
      if (clip.summary) {
        lines.push("");
        lines.push("AI-анализ:");
        lines.push(clip.summary);
      }
      if (clip.tags.length > 0) {
        lines.push(`Теги: ${clip.tags.map((t) => "#" + t).join(" ")}`);
      }
      lines.push(
        `Дата: ${format(new Date(clip.createdAt), "d MMM yyyy", { locale: ru })}`
      );
      lines.push("─".repeat(30));
    });
    lines.push("");
  }

  byDomain.forEach(({ domain, clips: domainClips }) => {
    if (domainClips.length === 0) return;
    lines.push(`${domain.icon} ${domain.name.toUpperCase()}`);
    lines.push("─".repeat(30));
    domainClips.forEach((clip) => {
      lines.push("");
      if (clip.title) lines.push(`▸ ${clip.title}`);
      if (clip.linkPreview) {
        lines.push(`🔗 ${clip.linkPreview.title || clip.linkPreview.url}`);
        lines.push(`   ${clip.linkPreview.url}`);
      }
      if (clip.text) lines.push(clip.text);
      if (clip.summary) {
        lines.push("");
        lines.push("AI-анализ:");
        lines.push(clip.summary);
      }
      if (clip.tags.length > 0) {
        lines.push(`Теги: ${clip.tags.map((t) => "#" + t).join(" ")}`);
      }
      lines.push(
        `Дата: ${format(new Date(clip.createdAt), "d MMM yyyy", { locale: ru })}`
      );
      lines.push("─".repeat(30));
    });
    lines.push("");
  });

  const content = lines.join("\n");
  const filename = `clip-export-${format(new Date(), "yyyy-MM-dd")}.txt`;

  // expo-file-system v19 uses class-based API.
  // File.write() creates or overwrites the file synchronously.
  const file = new File(Paths.document, filename);
  file.write(content);

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/plain",
      dialogTitle: "Экспорт архива Clip",
    });
  }
}
