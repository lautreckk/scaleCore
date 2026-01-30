"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  Archive,
  ArchiveRestore,
  MoreVertical,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  message_id: string;
  from_me: boolean;
  content: string | null;
  message_type: string;
  media_url: string | null;
  status: string;
  timestamp: string;
}

interface Chat {
  id: string;
  remote_jid: string;
  contact_name: string | null;
  profile_picture_url: string | null;
  unread_count: number;
  archived: boolean;
  whatsapp_instances: {
    id: string;
    instance_name: string;
    name: string;
    status: string;
    color: string | null;
  } | null;
  leads: {
    id: string;
    name: string;
  } | null;
}

interface ChatWindowProps {
  chatId: string | null;
  onTogglePanel?: () => void;
  showPanelButton?: boolean;
}

export function ChatWindow({ chatId, onTogglePanel, showPanelButton }: ChatWindowProps) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!chatId) {
      setChat(null);
      setMessages([]);
      return;
    }

    setLoading(true);
    loadChat();
    loadMessages();

    // Set up real-time subscription for messages
    const channel = supabase
      .channel(`messages-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          console.log("Message realtime event:", payload);
          loadMessages();
        }
      )
      .subscribe((status) => {
        console.log("Message subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChat = async () => {
    if (!chatId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) return;

    const { data, error } = await supabase
      .from("chats")
      .select(`
        id,
        remote_jid,
        contact_name,
        profile_picture_url,
        unread_count,
        archived,
        whatsapp_instances(id, instance_name, name, status, color),
        leads(id, name)
      `)
      .eq("id", chatId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !data) {
      toast.error("Conversa nao encontrada");
      return;
    }

    setChat(data as unknown as Chat);
    setAvatarError(false);

    // Mark as read
    if (data.unread_count > 0) {
      await supabase
        .from("chats")
        .update({ unread_count: 0 })
        .eq("id", chatId);
    }
  };

  const loadMessages = async () => {
    if (!chatId) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("timestamp", { ascending: true })
      .limit(200);

    if (!error && data) {
      setMessages(data);
    }
    setLoading(false);
  };

  const sendTextMessage = async (message: string) => {
    if (!chat || !chat.whatsapp_instances) {
      toast.error("Instancia nao encontrada");
      return;
    }

    const instance = chat.whatsapp_instances;
    if (instance.status !== "connected") {
      toast.error("WhatsApp nao esta conectado");
      throw new Error("WhatsApp not connected");
    }

    const response = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceName: instance.instance_name,
        to: chat.remote_jid,
        message,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to send message");
    }
  };

  const sendMediaMessage = async (file: File, type: "image" | "video" | "audio" | "document") => {
    if (!chat || !chat.whatsapp_instances) {
      toast.error("Instancia nao encontrada");
      return;
    }

    const instance = chat.whatsapp_instances;
    if (instance.status !== "connected") {
      toast.error("WhatsApp nao esta conectado");
      throw new Error("WhatsApp not connected");
    }

    // First upload the file
    const formData = new FormData();
    formData.append("file", file);

    const uploadResponse = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload file");
    }

    const { url } = await uploadResponse.json();

    // Then send the media message
    const response = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceName: instance.instance_name,
        to: chat.remote_jid,
        mediaUrl: url,
        mediaType: type,
        fileName: file.name,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to send media");
    }
  };

  const toggleArchive = async () => {
    if (!chat) return;

    try {
      await supabase
        .from("chats")
        .update({ archived: !chat.archived })
        .eq("id", chat.id);

      toast.success(chat.archived ? "Conversa desarquivada" : "Conversa arquivada");
      setChat({ ...chat, archived: !chat.archived });
    } catch (error) {
      toast.error("Erro ao atualizar conversa");
    }
  };

  const formatPhoneNumber = (jid: string) => {
    const phone = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    if (phone.length === 13 && phone.startsWith("55")) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    return phone;
  };

  // Empty state when no chat is selected
  if (!chatId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <MessageSquare className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-xl font-medium text-white mb-2">
          Selecione uma conversa
        </h3>
        <p className="text-muted-foreground max-w-sm">
          Escolha uma conversa na lista ao lado para comecar a enviar mensagens
        </p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Chat not found
  if (!chat) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-muted-foreground">Conversa nao encontrada</p>
      </div>
    );
  }

  const isConnected = chat.whatsapp_instances?.status === "connected";
  const displayName = chat.contact_name || chat.leads?.name || formatPhoneNumber(chat.remote_jid);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pl-12 md:pl-14 pr-12 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {chat.profile_picture_url && !avatarError ? (
              <img
                src={chat.profile_picture_url}
                alt={displayName}
                className="h-10 w-10 rounded-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center text-white font-medium">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            {chat.whatsapp_instances?.color && (
              <div
                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background"
                style={{ backgroundColor: chat.whatsapp_instances.color }}
              />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="font-medium text-white truncate">{displayName}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              {formatPhoneNumber(chat.remote_jid)}
              {chat.leads && (
                <Link
                  href={`/leads/${chat.leads.id}`}
                  className="text-primary hover:underline"
                >
                  Ver lead
                </Link>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? "success" : "secondary"} className="hidden sm:flex">
            {isConnected ? "Conectado" : "Desconectado"}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleArchive}
            title={chat.archived ? "Desarquivar" : "Arquivar"}
          >
            {chat.archived ? (
              <ArchiveRestore className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
          </Button>
          {showPanelButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onTogglePanel}
              className="xl:hidden"
              title="Detalhes do contato"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="p-4 overflow-x-hidden">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center min-h-[300px]">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Send className="h-8 w-8 text-primary" />
                </div>
                <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
                <p className="text-sm text-muted-foreground">
                  Envie a primeira mensagem para iniciar a conversa
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    content={message.content}
                    messageType={message.message_type}
                    mediaUrl={message.media_url}
                    fromMe={message.from_me}
                    status={message.status}
                    timestamp={message.timestamp}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      {!isConnected ? (
        <div className="p-4 border-t border-border bg-card">
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <p>WhatsApp desconectado.</p>
            <Link href="/settings/integrations" className="text-primary ml-1 hover:underline">
              Conectar agora
            </Link>
          </div>
        </div>
      ) : (
        <MessageInput
          onSendText={sendTextMessage}
          onSendMedia={sendMediaMessage}
          disabled={!isConnected}
        />
      )}
    </div>
  );
}
