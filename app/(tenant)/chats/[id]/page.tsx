"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Loader2,
  User,
  Phone,
  MoreVertical,
  Image as ImageIcon,
  Paperclip,
  Check,
  CheckCheck,
  Archive,
} from "lucide-react";

interface Chat {
  id: string;
  remote_jid: string;
  contact_name: string | null;
  unread_count: number;
  archived: boolean;
  whatsapp_instances: {
    id: string;
    instance_name: string;
    status: string;
  } | null;
  leads: {
    id: string;
    name: string;
  } | null;
}

interface Message {
  id: string;
  message_id: string;
  from_me: boolean;
  content: string;
  message_type: string;
  media_url: string | null;
  status: string;
  timestamp: string;
}

export default function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadChat();
    loadMessages();

    // Set up real-time subscription for new messages
    const channel = supabase
      .channel(`messages-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${id}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChat = async () => {
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
        unread_count,
        archived,
        whatsapp_instances(id, instance_name, status),
        leads(id, name)
      `)
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !data) {
      toast.error("Conversa não encontrada");
      router.push("/chats");
      return;
    }

    setChat(data as unknown as Chat);

    // Mark as read
    if (data.unread_count > 0) {
      await supabase
        .from("chats")
        .update({ unread_count: 0 })
        .eq("id", id);
    }
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", id)
      .order("timestamp", { ascending: true })
      .limit(100);

    if (!error && data) {
      setMessages(data);
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chat || !chat.whatsapp_instances) return;

    const instance = chat.whatsapp_instances;
    if (instance.status !== "connected") {
      toast.error("WhatsApp não está conectado");
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`/api/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: instance.instance_name,
          to: chat.remote_jid,
          message: newMessage,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      setNewMessage("");
      // Message will appear via real-time subscription
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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

  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "read":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!chat) {
    return null;
  }

  const isConnected = chat.whatsapp_instances?.status === "connected";

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card rounded-t-lg">
        <div className="flex items-center gap-4">
          <Link href="/chats">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center text-white font-medium">
            {(chat.contact_name || chat.leads?.name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-medium text-white">
              {chat.contact_name || chat.leads?.name || formatPhoneNumber(chat.remote_jid)}
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
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
          <Badge variant={isConnected ? "success" : "secondary"}>
            {isConnected ? "Conectado" : "Desconectado"}
          </Badge>
          <Button variant="ghost" size="sm" onClick={toggleArchive}>
            <Archive className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Send className="h-8 w-8 text-primary" />
            </div>
            <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
            <p className="text-sm text-muted-foreground">
              Envie a primeira mensagem para iniciar a conversa
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.from_me ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[70%] rounded-lg px-4 py-2",
                    message.from_me
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border"
                  )}
                >
                  {message.message_type === "image" && message.media_url && (
                    <img
                      src={message.media_url}
                      alt="Image"
                      className="max-w-full rounded mb-2"
                    />
                  )}
                  {message.message_type === "video" && message.media_url && (
                    <video
                      src={message.media_url}
                      controls
                      className="max-w-full rounded mb-2"
                    />
                  )}
                  {message.message_type === "audio" && message.media_url && (
                    <audio
                      src={message.media_url}
                      controls
                      className="w-full mb-2"
                    />
                  )}
                  {message.content && (
                    <p className={cn(
                      "whitespace-pre-wrap break-words",
                      message.from_me ? "text-white" : "text-white"
                    )}>
                      {message.content}
                    </p>
                  )}
                  <div
                    className={cn(
                      "flex items-center gap-1 mt-1",
                      message.from_me ? "justify-end" : "justify-start"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs",
                        message.from_me
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      )}
                    >
                      {formatMessageTime(message.timestamp)}
                    </span>
                    {message.from_me && getStatusIcon(message.status)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card rounded-b-lg">
        {!isConnected ? (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <p>WhatsApp desconectado. </p>
            <Link href="/settings/integrations" className="text-primary ml-1 hover:underline">
              Conectar agora
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled>
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" disabled>
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Digite uma mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sending}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={sending || !newMessage.trim()}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
