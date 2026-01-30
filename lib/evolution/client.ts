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

// Chat Controller Types
export interface CheckWhatsAppParams {
  numbers: string[];
}

export interface ReadMessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
}

export interface MarkMessageAsReadParams {
  readMessages: ReadMessageKey[];
}

export interface ArchiveChatParams {
  lastMessage: { key: ReadMessageKey };
  chat: string;
  archive: boolean;
}

export interface MarkChatUnreadParams {
  lastMessage: { key: ReadMessageKey };
  chat: string;
}

export interface DeleteMessageParams {
  id: string;
  remoteJid: string;
  fromMe: boolean;
  participant?: string;
}

export interface UpdateMessageParams {
  number: string;
  key: ReadMessageKey;
  text: string;
}

export interface SendPresenceParams {
  number: string;
  delay?: number;
  presence: "composing" | "recording" | "paused";
}

export interface UpdateBlockStatusParams {
  number: string;
  status: "block" | "unblock";
}

export interface FindContactsParams {
  where?: { id?: string };
}

export interface FindMessagesParams {
  where: { key: { remoteJid: string } };
  page?: number;
  offset?: number;
}

export interface WhatsAppNumberResult {
  exists: boolean;
  jid: string;
  number: string;
}

export interface Contact {
  id: string;
  pushName?: string;
  profilePictureUrl?: string;
}

export interface ChatInfo {
  id: string;
  name?: string;
  unreadCount?: number;
  lastMessage?: object;
}

// Profile Settings Types
export interface ProfileData {
  wuid?: string;
  name?: string;
  picture?: string;
  status?: string;
  isBusiness?: boolean;
}

export interface BusinessProfileData {
  wuid?: string;
  name?: string;
  description?: string;
  website?: string[];
  email?: string;
  address?: string;
  category?: string;
}

export interface PrivacySettings {
  readreceipts: "all" | "none";
  profile: "all" | "contacts" | "contact_blacklist" | "none";
  status: "all" | "contacts" | "contact_blacklist" | "none";
  online: "all" | "match_last_seen";
  last: "all" | "contacts" | "contact_blacklist" | "none";
  groupadd: "all" | "contacts" | "contact_blacklist";
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
  getBase64FromMediaMessage(instanceName: string, messageId: string, convertToMp4?: boolean): Promise<EvolutionApiResponse<{ base64: string; mimetype: string }>>;

  // Chat Controller Methods
  checkIsWhatsApp(instanceName: string, params: CheckWhatsAppParams): Promise<EvolutionApiResponse<WhatsAppNumberResult[]>>;
  markMessageAsRead(instanceName: string, params: MarkMessageAsReadParams): Promise<EvolutionApiResponse<void>>;
  markChatUnread(instanceName: string, params: MarkChatUnreadParams): Promise<EvolutionApiResponse<void>>;
  archiveChat(instanceName: string, params: ArchiveChatParams): Promise<EvolutionApiResponse<void>>;
  deleteMessageForEveryone(instanceName: string, params: DeleteMessageParams): Promise<EvolutionApiResponse<void>>;
  updateMessage(instanceName: string, params: UpdateMessageParams): Promise<EvolutionApiResponse<void>>;
  sendPresence(instanceName: string, params: SendPresenceParams): Promise<EvolutionApiResponse<void>>;
  updateBlockStatus(instanceName: string, params: UpdateBlockStatusParams): Promise<EvolutionApiResponse<void>>;
  findContacts(instanceName: string, params?: FindContactsParams): Promise<EvolutionApiResponse<Contact[]>>;
  findMessages(instanceName: string, params: FindMessagesParams): Promise<EvolutionApiResponse<object[]>>;
  findStatusMessage(instanceName: string, params: FindMessagesParams): Promise<EvolutionApiResponse<object[]>>;
  findChats(instanceName: string): Promise<EvolutionApiResponse<ChatInfo[]>>;

  // Profile Settings Methods
  fetchProfile(instanceName: string, number?: string): Promise<EvolutionApiResponse<ProfileData>>;
  fetchBusinessProfile(instanceName: string, number: string): Promise<EvolutionApiResponse<BusinessProfileData>>;
  updateProfileName(instanceName: string, name: string): Promise<EvolutionApiResponse<void>>;
  updateProfileStatus(instanceName: string, status: string): Promise<EvolutionApiResponse<void>>;
  updateProfilePicture(instanceName: string, pictureUrl: string): Promise<EvolutionApiResponse<void>>;
  removeProfilePicture(instanceName: string): Promise<EvolutionApiResponse<void>>;
  fetchPrivacySettings(instanceName: string): Promise<EvolutionApiResponse<PrivacySettings>>;
  updatePrivacySettings(instanceName: string, settings: Partial<PrivacySettings>): Promise<EvolutionApiResponse<void>>;
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

    async getBase64FromMediaMessage(
      instanceName: string,
      messageId: string,
      convertToMp4: boolean = false
    ): Promise<EvolutionApiResponse<{ base64: string; mimetype: string }>> {
      return evolutionFetch<{ base64: string; mimetype: string }>(
        `/chat/getBase64FromMediaMessage/${instanceName}`,
        {
          method: "POST",
          body: JSON.stringify({
            message: {
              key: {
                id: messageId,
              },
            },
            convertToMp4,
          }),
        }
      );
    },

    // Chat Controller Methods

    async checkIsWhatsApp(
      instanceName: string,
      params: CheckWhatsAppParams
    ): Promise<EvolutionApiResponse<WhatsAppNumberResult[]>> {
      return evolutionFetch<WhatsAppNumberResult[]>(
        `/chat/whatsappNumbers/${instanceName}`,
        {
          method: "POST",
          body: JSON.stringify(params),
        }
      );
    },

    async markMessageAsRead(
      instanceName: string,
      params: MarkMessageAsReadParams
    ): Promise<EvolutionApiResponse<void>> {
      return evolutionFetch<void>(`/chat/markMessageAsRead/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    async markChatUnread(
      instanceName: string,
      params: MarkChatUnreadParams
    ): Promise<EvolutionApiResponse<void>> {
      return evolutionFetch<void>(`/chat/markChatUnread/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    async archiveChat(
      instanceName: string,
      params: ArchiveChatParams
    ): Promise<EvolutionApiResponse<void>> {
      return evolutionFetch<void>(`/chat/archiveChat/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    async deleteMessageForEveryone(
      instanceName: string,
      params: DeleteMessageParams
    ): Promise<EvolutionApiResponse<void>> {
      return evolutionFetch<void>(
        `/chat/deleteMessageForEveryone/${instanceName}`,
        {
          method: "DELETE",
          body: JSON.stringify(params),
        }
      );
    },

    async updateMessage(
      instanceName: string,
      params: UpdateMessageParams
    ): Promise<EvolutionApiResponse<void>> {
      return evolutionFetch<void>(`/chat/updateMessage/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    async sendPresence(
      instanceName: string,
      params: SendPresenceParams
    ): Promise<EvolutionApiResponse<void>> {
      return evolutionFetch<void>(`/chat/sendPresence/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    async updateBlockStatus(
      instanceName: string,
      params: UpdateBlockStatusParams
    ): Promise<EvolutionApiResponse<void>> {
      return evolutionFetch<void>(
        `/message/updateBlockStatus/${instanceName}`,
        {
          method: "POST",
          body: JSON.stringify(params),
        }
      );
    },

    async findContacts(
      instanceName: string,
      params?: FindContactsParams
    ): Promise<EvolutionApiResponse<Contact[]>> {
      return evolutionFetch<Contact[]>(`/chat/findContacts/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(params || {}),
      });
    },

    async findMessages(
      instanceName: string,
      params: FindMessagesParams
    ): Promise<EvolutionApiResponse<object[]>> {
      return evolutionFetch<object[]>(`/chat/findMessages/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    async findStatusMessage(
      instanceName: string,
      params: FindMessagesParams
    ): Promise<EvolutionApiResponse<object[]>> {
      return evolutionFetch<object[]>(
        `/chat/findStatusMessage/${instanceName}`,
        {
          method: "POST",
          body: JSON.stringify(params),
        }
      );
    },

    async findChats(
      instanceName: string
    ): Promise<EvolutionApiResponse<ChatInfo[]>> {
      return evolutionFetch<ChatInfo[]>(`/chat/findChats/${instanceName}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },

    // Profile Settings Methods

    async fetchProfile(
      instanceName: string,
      number?: string
    ): Promise<EvolutionApiResponse<ProfileData>> {
      return evolutionFetch<ProfileData>(`/chat/fetchProfile/${instanceName}`, {
        method: "POST",
        body: JSON.stringify({ number: number || "" }),
      });
    },

    async fetchBusinessProfile(
      instanceName: string,
      number: string
    ): Promise<EvolutionApiResponse<BusinessProfileData>> {
      return evolutionFetch<BusinessProfileData>(
        `/chat/fetchBusinessProfile/${instanceName}`,
        {
          method: "POST",
          body: JSON.stringify({ number }),
        }
      );
    },

    async updateProfileName(
      instanceName: string,
      name: string
    ): Promise<EvolutionApiResponse<void>> {
      return evolutionFetch<void>(`/chat/updateProfileName/${instanceName}`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
    },

    async updateProfileStatus(
      instanceName: string,
      status: string
    ): Promise<EvolutionApiResponse<void>> {
      return evolutionFetch<void>(`/chat/updateProfileStatus/${instanceName}`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
    },

    async updateProfilePicture(
      instanceName: string,
      pictureUrl: string
    ): Promise<EvolutionApiResponse<void>> {
      return evolutionFetch<void>(
        `/chat/updateProfilePicture/${instanceName}`,
        {
          method: "POST",
          body: JSON.stringify({ picture: pictureUrl }),
        }
      );
    },

    async removeProfilePicture(
      instanceName: string
    ): Promise<EvolutionApiResponse<void>> {
      return evolutionFetch<void>(
        `/chat/removeProfilePicture/${instanceName}`,
        {
          method: "DELETE",
        }
      );
    },

    async fetchPrivacySettings(
      instanceName: string
    ): Promise<EvolutionApiResponse<PrivacySettings>> {
      return evolutionFetch<PrivacySettings>(
        `/chat/fetchPrivacySettings/${instanceName}`,
        {
          method: "GET",
        }
      );
    },

    async updatePrivacySettings(
      instanceName: string,
      settings: Partial<PrivacySettings>
    ): Promise<EvolutionApiResponse<void>> {
      return evolutionFetch<void>(
        `/chat/updatePrivacySettings/${instanceName}`,
        {
          method: "POST",
          body: JSON.stringify(settings),
        }
      );
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
