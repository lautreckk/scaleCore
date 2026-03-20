export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function chatCompletion(
  modelId: string,
  messages: ChatMessage[]
): Promise<{ content: string; usage: OpenRouterResponse["usage"] }> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "",
        "X-OpenRouter-Title": "ScaleCore AI Agents",
      },
      body: JSON.stringify({ model: modelId, messages }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${error}`);
  }

  const data: OpenRouterResponse = await response.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage,
  };
}
