"use server";

const ACCESS_TOKEN =
  "EAASGQbyRkg4BQnLo5bxcsPz378Glto29gUi1LgfBZBupcVGR1ZAZAmwl74w8jRu8fPYF1ZBg7AoWQ9HhJnDNx2P76hoOGDeWCsnH7tqtcGZAvd47i0LGEfu0BVrecOo7dROHgohuEwD0yGgwsR9nmiuxTMLW0cG1OEDxvDc2u4mMPZC5qOqfgAAVb7Q5rInBkEuZCy7ZCd3rGrZB8tE219dokq18ar1voJXqmt8KF2Y1kcF966m9YP2oJNB4xzunyrx298ygZATSBbbMQkA6HyQSquvBhKPfFendCWpJ3mygZDZD";
const PHONE_ID = "1010369195487470";
const WABA_ID = "1928262594724434";

const API_BASE = "https://graph.facebook.com/v21.0";

export async function sendTestMessage(to: string, text: string) {
  try {
    const response = await fetch(`${API_BASE}/${PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || "Erro ao enviar mensagem",
      };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro de rede",
    };
  }
}

export async function createTestTemplate(name: string, content: string) {
  try {
    const response = await fetch(
      `${API_BASE}/${WABA_ID}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          language: "pt_BR",
          category: "UTILITY",
          components: [
            {
              type: "BODY",
              text: content,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || "Erro ao criar template",
      };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro de rede",
    };
  }
}
