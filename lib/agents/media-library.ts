import { SupabaseClient } from "@supabase/supabase-js";
import type { EvolutionApiClient } from "@/lib/evolution/client";
import type { AiAgentMediaRow } from "@/types/database";

const MEDIA_MARKER_REGEX = /\[MEDIA:([a-f0-9-]+)\]/gi;

export function buildSystemPromptWithMedia(
  basePrompt: string,
  mediaItems: AiAgentMediaRow[]
): string {
  const activeItems = mediaItems.filter((m) => m.is_active);
  if (activeItems.length === 0) return basePrompt;

  const catalog = activeItems
    .map((m) => `- [MEDIA:${m.id}] ${m.name}: ${m.description}`)
    .join("\n");

  return `${basePrompt}

---
MIDIAS DISPONIVEIS:
Quando for contextualmente apropriado, inclua o marcador [MEDIA:id] na sua resposta para enviar a midia ao lead. Nao envie midia se nao for relevante para a conversa.
${catalog}`;
}

export function extractMediaMarkers(text: string): string[] {
  const matches = [...text.matchAll(MEDIA_MARKER_REGEX)];
  return matches.map((m) => m[1]);
}

export function stripMediaMarkers(text: string): string {
  return text
    .replace(MEDIA_MARKER_REGEX, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function sendMediaFromLibrary(
  mediaIds: string[],
  agentId: string,
  supabase: SupabaseClient,
  evolutionClient: EvolutionApiClient,
  instanceName: string,
  phoneNumber: string
): Promise<void> {
  if (mediaIds.length === 0) return;

  // Fetch media records
  const { data: mediaItems } = await supabase
    .from("ai_agent_media")
    .select("*")
    .eq("agent_id", agentId)
    .in("id", mediaIds)
    .eq("is_active", true);

  if (!mediaItems || mediaItems.length === 0) return;

  // Send each media file via Evolution API
  for (const item of mediaItems) {
    try {
      await evolutionClient.sendMedia(instanceName, {
        number: phoneNumber,
        mediatype: item.media_type as "image" | "video" | "audio" | "document",
        mimetype: item.mime_type,
        caption: item.name,
        media: item.file_url,
        fileName: item.name,
      });
    } catch (err) {
      console.error(`[AI Agent] Failed to send media ${item.id}:`, err);
    }
  }
}
