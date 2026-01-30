export interface EvolutionCredentials {
  url: string;
  apiKey: string;
}

interface EvolutionApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
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

export interface InstanceSettings {
  rejectCall: boolean;
  msgCall: string;
  groupsIgnore: boolean;
  alwaysOnline: boolean;
  readMessages: boolean;
  syncFullHistory: boolean;
  readStatus: boolean;
}

export interface ProfilePictureResponse {
  wuid?: string;
  profilePictureUrl?: string;
  wpiUrl?: string;
  url?: string;
}

export interface EvolutionApiClient {
  testConnection(): Promise<EvolutionApiResponse<{ status: string }>>;
  createInstance(params: CreateInstanceParams): Promise<EvolutionApiResponse<InstanceData>>;
  deleteInstance(instanceName: string): Promise<EvolutionApiResponse<void>>;
  getQRCode(instanceName: string): Promise<EvolutionApiResponse<QRCodeData>>;
  connect(instanceName: string): Promise<EvolutionApiResponse<{ qrcode?: string; base64?: string }>>;
  getConnectionState(instanceName: string): Promise<EvolutionApiResponse<ConnectionState>>;
  logout(instanceName: string): Promise<EvolutionApiResponse<void>>;
  restart(instanceName: string): Promise<EvolutionApiResponse<void>>;
  sendText(instanceName: string, params: SendTextParams): Promise<EvolutionApiResponse<SendMessageResponse>>;
  sendMedia(
    instanceName: string,
    params: {
      number: string;
      mediatype: "image" | "video" | "audio" | "document";
      mimetype: string;
      caption?: string;
      media: string;
      fileName?: string;
    }
  ): Promise<EvolutionApiResponse<SendMessageResponse>>;
  setWebhook(
    instanceName: string,
    params: {
      url: string;
      enabled?: boolean;
      webhook_by_events?: boolean;
      webhook_base64?: boolean;
      events?: string[];
    }
  ): Promise<EvolutionApiResponse<void>>;
  getWebhook(instanceName: string): Promise<EvolutionApiResponse<{ url: string; events: string[] }>>;
  getSettings(instanceName: string): Promise<EvolutionApiResponse<InstanceSettings>>;
  setSettings(instanceName: string, settings: Partial<InstanceSettings>): Promise<EvolutionApiResponse<InstanceSettings>>;
  fetchProfilePictureUrl(instanceName: string, number: string): Promise<EvolutionApiResponse<ProfilePictureResponse>>;
}

export function createEvolutionClient(credentials: EvolutionCredentials): EvolutionApiClient {
  const { url, apiKey } = credentials;

  async function evolutionFetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<EvolutionApiResponse<T>> {
    try {
      const response = await fetch(`${url}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || "Unknown error",
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

  return {
    async testConnection(): Promise<EvolutionApiResponse<{ status: string }>> {
      try {
        const response = await fetch(`${url}/instance/fetchInstances`, {
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey,
          },
        });

        if (response.ok) {
          return { success: true, data: { status: "connected" } };
        }

        const data = await response.json().catch(() => ({}));
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Connection failed",
        };
      }
    },

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
        media: string;
        fileName?: string;
      }
    ): Promise<EvolutionApiResponse<SendMessageResponse>> {
      return evolutionFetch<SendMessageResponse>(`/message/sendMedia/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    async setWebhook(
      instanceName: string,
      params: {
        url: string;
        enabled?: boolean;
        webhook_by_events?: boolean;
        webhook_base64?: boolean;
        events?: string[];
      }
    ): Promise<EvolutionApiResponse<void>> {
      // Evolution API v2.3 format - requires "webhook" wrapper object
      const webhookData = {
        webhook: {
          enabled: params.enabled ?? true,
          url: params.url,
          byEvents: params.webhook_by_events ?? false,
          base64: params.webhook_base64 ?? true,
          events: params.events ?? [
            "QRCODE_UPDATED",
            "CONNECTION_UPDATE",
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "SEND_MESSAGE",
          ],
        },
      };

      console.log(`Setting webhook for ${instanceName}:`, JSON.stringify(webhookData, null, 2));

      return evolutionFetch(`/webhook/set/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(webhookData),
      });
    },

    async getWebhook(instanceName: string): Promise<EvolutionApiResponse<{ url: string; events: string[] }>> {
      return evolutionFetch(`/webhook/find/${instanceName}`);
    },

    async getSettings(instanceName: string): Promise<EvolutionApiResponse<InstanceSettings>> {
      return evolutionFetch<InstanceSettings>(`/settings/find/${instanceName}`);
    },

    async setSettings(instanceName: string, settings: Partial<InstanceSettings>): Promise<EvolutionApiResponse<InstanceSettings>> {
      return evolutionFetch<InstanceSettings>(`/settings/set/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(settings),
      });
    },

    async fetchProfilePictureUrl(instanceName: string, number: string): Promise<EvolutionApiResponse<ProfilePictureResponse>> {
      return evolutionFetch<ProfilePictureResponse>(`/chat/fetchProfilePictureUrl/${instanceName}`, {
        method: "POST",
        body: JSON.stringify({ number }),
      });
    },
  };
}

// Legacy default client using environment variables (for backward compatibility)
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";

export const evolutionApi = createEvolutionClient({
  url: EVOLUTION_API_URL,
  apiKey: EVOLUTION_API_KEY,
});

export default evolutionApi;
