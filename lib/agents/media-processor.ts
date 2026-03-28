import type { ContentPart } from "./openrouter";

async function loadPdfParse() {
  const mod = await import("pdf-parse");
  return (mod as any).default ?? mod; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const PDF_TEXT_LIMIT = 4000;

// Models known to support multimodal (vision + audio)
const MULTIMODAL_MODELS = [
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "google/gemini-2.0-flash-001",
  "google/gemini-2.5-flash-preview",
];

// Fallback model for media processing when agent's model doesn't support multimodal
const FALLBACK_MEDIA_MODEL = "openai/gpt-4o-mini";

export function isMultimodalModel(modelId: string): boolean {
  return MULTIMODAL_MODELS.some((m) => modelId.startsWith(m) || modelId === m);
}

export async function fetchMediaAsBase64(mediaUrl: string): Promise<string> {
  const response = await fetch(mediaUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}

export async function processInboundMedia(
  messageType: "audio" | "image" | "document",
  mediaUrl: string,
  caption?: string
): Promise<{ contentParts: ContentPart[]; fallbackText?: string }> {
  if (messageType === "audio") {
    const base64 = await fetchMediaAsBase64(mediaUrl);
    // Determine format from URL extension, default to ogg (WhatsApp standard)
    const format = mediaUrl.match(/\.(\w+)(?:\?|$)/)?.[1] || "ogg";
    return {
      contentParts: [
        {
          type: "text",
          text: "Transcreva esse audio e responda como parte da conversa.",
        },
        { type: "input_audio", input_audio: { data: base64, format } },
      ],
    };
  }

  if (messageType === "image") {
    const base64 = await fetchMediaAsBase64(mediaUrl);
    // Determine mimetype from URL extension
    const ext = mediaUrl.match(/\.(\w+)(?:\?|$)/)?.[1] || "jpeg";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
    };
    const mime = mimeMap[ext] || "image/jpeg";
    const textInstruction = caption
      ? `O lead enviou esta imagem com a legenda: "${caption}". Descreva a imagem e responda considerando a legenda.`
      : "O lead enviou esta imagem. Descreva o que voce ve e responda como parte da conversa.";
    return {
      contentParts: [
        { type: "text", text: textInstruction },
        {
          type: "image_url",
          image_url: { url: `data:${mime};base64,${base64}` },
        },
      ],
    };
  }

  if (messageType === "document") {
    // PDF extraction — text-only, no multimodal needed
    const response = await fetch(mediaUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const pdfParse = await loadPdfParse();
    const data = await pdfParse(buffer);
    let extractedText = data.text.trim();
    if (extractedText.length > PDF_TEXT_LIMIT) {
      extractedText =
        extractedText.substring(0, PDF_TEXT_LIMIT) + "... [texto truncado]";
    }
    if (!extractedText) {
      extractedText = "[PDF sem texto extraivel]";
    }
    return {
      contentParts: [
        {
          type: "text",
          text: `O lead enviou um documento PDF. Conteudo extraido:\n\n${extractedText}\n\nResponda com base no conteudo do documento.`,
        },
      ],
      fallbackText: `O lead enviou um documento PDF. Conteudo extraido:\n\n${extractedText}\n\nResponda com base no conteudo do documento.`,
    };
  }

  // Unsupported type — return empty
  return { contentParts: [{ type: "text", text: "[Midia nao suportada]" }] };
}

export { FALLBACK_MEDIA_MODEL };
