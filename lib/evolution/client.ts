const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";

interface EvolutionApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function evolutionFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<EvolutionApiResponse<T>> {
  try {
    const response = await fetch(`${EVOLUTION_API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || "Unknown error",
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface CreateInstanceParams {
  instanceName: string;
  token: string;
  qrcode?: boolean;
  integration?: string;
}

export interface InstanceData {
  instance: {
    instanceName: string;
    status: string;
  };
  hash: string;
  settings: {
    rejectCall: boolean;
    msgCall: string;
    groupsIgnore: boolean;
    alwaysOnline: boolean;
    readMessages: boolean;
    readStatus: boolean;
    syncFullHistory: boolean;
  };
}

export interface QRCodeData {
  pairingCode?: string;
  code?: string;
  base64?: string;
  count?: number;
}

export interface ConnectionState {
  instance: {
    instanceName: string;
    state: "open" | "close" | "connecting";
  };
}

export interface SendTextParams {
  number: string;
  text: string;
  delay?: number;
}

export interface SendMessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
  };
  messageTimestamp: string;
  status: string;
}

export const evolutionApi = {
  // Instance Management
  async createInstance(params: CreateInstanceParams): Promise<EvolutionApiResponse<InstanceData>> {
    return evolutionFetch<InstanceData>("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName: params.instanceName,
        token: params.token,
        qrcode: params.qrcode ?? true,
        integration: params.integration ?? "WHATSAPP-BAILEYS",
      }),
    });
  },

  async deleteInstance(instanceName: string): Promise<EvolutionApiResponse<void>> {
    return evolutionFetch(`/instance/delete/${instanceName}`, {
      method: "DELETE",
    });
  },

  async getQRCode(instanceName: string): Promise<EvolutionApiResponse<QRCodeData>> {
    return evolutionFetch<QRCodeData>(`/instance/connect/${instanceName}`);
  },

  async connect(instanceName: string): Promise<EvolutionApiResponse<{ qrcode?: string; base64?: string }>> {
    return evolutionFetch(`/instance/connect/${instanceName}`, {
      method: "GET",
    });
  },

  async getConnectionState(instanceName: string): Promise<EvolutionApiResponse<ConnectionState>> {
    return evolutionFetch<ConnectionState>(`/instance/connectionState/${instanceName}`);
  },

  async logout(instanceName: string): Promise<EvolutionApiResponse<void>> {
    return evolutionFetch(`/instance/logout/${instanceName}`, {
      method: "DELETE",
    });
  },

  async restart(instanceName: string): Promise<EvolutionApiResponse<void>> {
    return evolutionFetch(`/instance/restart/${instanceName}`, {
      method: "PUT",
    });
  },

  // Messaging
  async sendText(
    instanceName: string,
    params: SendTextParams
  ): Promise<EvolutionApiResponse<SendMessageResponse>> {
    return evolutionFetch<SendMessageResponse>(`/message/sendText/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        number: params.number,
        text: params.text,
        delay: params.delay,
      }),
    });
  },

  async sendMedia(
    instanceName: string,
    params: {
      number: string;
      mediatype: "image" | "video" | "audio" | "document";
      mimetype: string;
      caption?: string;
      media: string; // base64 or URL
      fileName?: string;
    }
  ): Promise<EvolutionApiResponse<SendMessageResponse>> {
    return evolutionFetch<SendMessageResponse>(`/message/sendMedia/${instanceName}`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  // Webhook Configuration
  async setWebhook(
    instanceName: string,
    params: {
      url: string;
      webhook_by_events?: boolean;
      webhook_base64?: boolean;
      events?: string[];
    }
  ): Promise<EvolutionApiResponse<void>> {
    return evolutionFetch(`/webhook/set/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        url: params.url,
        webhook_by_events: params.webhook_by_events ?? false,
        webhook_base64: params.webhook_base64 ?? true,
        events: params.events ?? [
          "QRCODE_UPDATED",
          "CONNECTION_UPDATE",
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "SEND_MESSAGE",
        ],
      }),
    });
  },

  async getWebhook(instanceName: string): Promise<EvolutionApiResponse<{ url: string; events: string[] }>> {
    return evolutionFetch(`/webhook/find/${instanceName}`);
  },
};

export default evolutionApi;
