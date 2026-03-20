import type { EvolutionApiClient } from "@/lib/evolution/client";

/**
 * Split AI response into natural message parts.
 * Splits by paragraph first (double newline), then by sentence boundaries.
 */
export function splitResponse(text: string): string[] {
  // Split by double newline (paragraphs) first
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs.map((p) => p.trim());

  // If single paragraph, split by sentence-ending punctuation
  // Keeps punctuation with the sentence. Handles Portuguese punctuation.
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.map((s) => s.trim()).filter(Boolean);
}

/**
 * Send AI response split into multiple WhatsApp messages with
 * typing indicators and natural delays between each part.
 */
export async function sendSplitResponse(
  client: EvolutionApiClient,
  instanceName: string,
  remoteJid: string,
  response: string
): Promise<void> {
  const parts = splitResponse(response);
  const phoneNumber = remoteJid.replace("@s.whatsapp.net", "");

  for (let i = 0; i < parts.length; i++) {
    // Send typing indicator ("composing")
    await client.sendPresence(instanceName, {
      number: phoneNumber,
      presence: "composing",
      delay: 1000 + Math.random() * 2000, // 1-3s typing indicator
    });

    // Natural delay based on message length (simulates typing speed)
    // ~30ms per character, capped at 3 seconds
    const charDelay = Math.min(parts[i].length * 30, 3000);
    await new Promise((r) => setTimeout(r, charDelay));

    // Send the message part
    await client.sendText(instanceName, {
      number: phoneNumber,
      text: parts[i],
    });

    // Small pause between messages (not after the last one)
    if (i < parts.length - 1) {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
    }
  }
}
