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
  Ban,
  UserPlus,
  UserMinus,
  CheckCircle,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StageSelector } from "@/components/kanban";

interface Message {
  id: string;
  message_id: string;
  from_me: boolean;
  content: string | null;
  message_type: string;
  media_url: string | null;
  status: string;
  timestamp: string;
  isOptimistic?: boolean; // For optimistic updates
}

interface Chat {
  id: string;
  remote_jid: string;
  contact_name: string | null;
  profile_picture_url: string | null;
  unread_count: number;
  archived: boolean;
  status: string | null;
  assigned_to: string | null;
  board_id: string | null;
  stage_id: string | null;
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
  const [avatarError, setAvatarError] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Send typing presence with debounce
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<number>(0);

  const sendTypingPresence = useCallback(async () => {
    if (!chat || !chat.whatsapp_instances) return;

    const now = Date.now();
    // Only send typing every 3 seconds
    if (now - lastTypingRef.current < 3000) return;
    lastTypingRef.current = now;

    try {
      await fetch("/api/whatsapp/chat/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: chat.whatsapp_instances.instance_name,
          to: chat.remote_jid,
          presence: "composing",
        }),
      });
    } catch (error) {
      // Silently fail - not critical
    }
  }, [chat]);

  const sendStopTypingPresence = useCallback(async () => {
    if (!chat || !chat.whatsapp_instances) return;

    try {
      await fetch("/api/whatsapp/chat/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: chat.whatsapp_instances.instance_name,
          to: chat.remote_jid,
          presence: "paused",
        }),
      });
    } catch (error) {
      // Silently fail
    }
  }, [chat]);

  const handleTyping = useCallback(() => {
    sendTypingPresence();

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing after 5 seconds
    typingTimeoutRef.current = setTimeout(() => {
      sendStopTypingPresence();
    }, 5000);
  }, [sendTypingPresence, sendStopTypingPresence]);

  // Mark messages as read via API
  const markAsRead = useCallback(async () => {
    if (!chat || !chat.whatsapp_instances) return;

    try {
      await fetch("/api/whatsapp/chat/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: chat.whatsapp_instances.instance_name,
          chatId: chat.id,
        }),
      });
    } catch (error) {
      // Fallback to local update only
      await supabase
        .from("chats")
        .update({ unread_count: 0 })
        .eq("id", chat.id);
    }
  }, [chat, supabase]);

  const loadChat = useCallback(async () => {
    if (!chatId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) return;

    // Store current user ID for assignment checks
    setCurrentUserId(tenantUser.id);

    const { data, error } = await supabase
      .from("chats")
      .select(`
        id,
        remote_jid,
        contact_name,
        profile_picture_url,
        unread_count,
        archived,
        status,
        assigned_to,
        board_id,
        stage_id,
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
  }, [chatId, supabase]);

  // Mark as read when chat loads or when messages update
  useEffect(() => {
    if (chat && chat.unread_count > 0) {
      markAsRead();
    }
  }, [chat?.id, chat?.unread_count, markAsRead]);

  const loadMessages = useCallback(async () => {
    if (!chatId) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("timestamp", { ascending: true })
      .limit(200);

    if (!error && data) {
      setMessages(prev => {
        // Get current messages that are not from DB (optimistic or updated)
        const localMessages = prev.filter(m => m.isOptimistic || m.id.startsWith("temp-"));
        const dbMessageIds = new Set(data.map(m => m.message_id));

        // Keep only local messages that don't have a DB counterpart
        const stillPendingLocal = localMessages.filter(
          m => !dbMessageIds.has(m.message_id)
        );

        // Merge: DB messages + still pending local ones (sorted by timestamp)
        const merged = [...data, ...stillPendingLocal];
        merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return merged;
      });
    }
    setLoading(false);
  }, [chatId, supabase]);

  // Load chat and messages when chatId changes
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
  }, [chatId, loadChat, loadMessages, supabase]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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

    // Create optimistic message immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      message_id: tempId,
      from_me: true,
      content: message,
      message_type: "text",
      media_url: null,
      status: "sending",
      timestamp: new Date().toISOString(),
      isOptimistic: true,
    };

    // Add to messages immediately (optimistic update)
    setMessages(prev => [...prev, optimisticMessage]);

    // Send to API in background (don't await - let it complete async)
    fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceName: instance.instance_name,
        to: chat.remote_jid,
        message,
      }),
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) {
        // Remove optimistic message and show error
        setMessages(prev => prev.filter(m => m.id !== tempId));
        toast.error(data.error || "Erro ao enviar mensagem");
      } else {
        // Update optimistic message with real message_id and status
        setMessages(prev => prev.map(m =>
          m.id === tempId
            ? { ...m, message_id: data.messageId, status: "sent", isOptimistic: false }
            : m
        ));
      }
    }).catch((error) => {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error("Erro ao enviar mensagem");
      console.error("Send error:", error);
    });
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

    // Create optimistic message immediately
    const tempId = `temp-${Date.now()}`;
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    const optimisticMessage: Message = {
      id: tempId,
      message_id: tempId,
      from_me: true,
      content: file.name,
      message_type: type,
      media_url: previewUrl,
      status: "sending",
      timestamp: new Date().toISOString(),
      isOptimistic: true,
    };

    // Add to messages immediately (optimistic update)
    setMessages(prev => [...prev, optimisticMessage]);

    // Upload and send in background
    (async () => {
      try {
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

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to send media");
        }

        // Update optimistic message with real message_id and status
        setMessages(prev => prev.map(m =>
          m.id === tempId
            ? { ...m, message_id: data.messageId, status: "sent", isOptimistic: false, media_url: url }
            : m
        ));
      } catch (error) {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempId));
        toast.error("Erro ao enviar arquivo");
        console.error("Send media error:", error);
      } finally {
        // Revoke preview URL
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      }
    })();
  };

  const toggleArchive = async () => {
    if (!chat || !chat.whatsapp_instances) return;

    try {
      const response = await fetch("/api/whatsapp/chat/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: chat.whatsapp_instances.instance_name,
          chatId: chat.id,
          archive: !chat.archived,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to archive");
      }

      toast.success(chat.archived ? "Conversa desarquivada" : "Conversa arquivada");
      setChat({ ...chat, archived: !chat.archived });
    } catch (error) {
      toast.error("Erro ao atualizar conversa");
    }
  };

  const toggleAssign = async () => {
    if (!chat) return;

    const isAssignedToMe = chat.assigned_to === currentUserId;
    const newAssignedTo = isAssignedToMe ? null : currentUserId;

    try {
      const { error } = await supabase
        .from("chats")
        .update({ assigned_to: newAssignedTo })
        .eq("id", chat.id);

      if (error) throw error;

      toast.success(isAssignedToMe ? "Conversa desatribuída" : "Conversa atribuída a você");
      setChat({ ...chat, assigned_to: newAssignedTo });
    } catch (error) {
      toast.error("Erro ao atualizar atribuição");
    }
  };

  const toggleStatus = async () => {
    if (!chat) return;

    const isClosed = chat.status === "closed";
    const newStatus = isClosed ? "open" : "closed";

    try {
      const { error } = await supabase
        .from("chats")
        .update({ status: newStatus })
        .eq("id", chat.id);

      if (error) throw error;

      toast.success(isClosed ? "Conversa reaberta" : "Conversa finalizada");
      setChat({ ...chat, status: newStatus });
    } catch (error) {
      toast.error("Erro ao atualizar status");
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!chat || !chat.whatsapp_instances) return;

    try {
      const response = await fetch(
        `/api/whatsapp/messages/${messageId}?instanceName=${chat.whatsapp_instances.instance_name}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }

      toast.success("Mensagem apagada");
      loadMessages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao apagar mensagem");
    }
  };

  const editMessage = async (messageId: string, newText: string) => {
    if (!chat || !chat.whatsapp_instances) return;

    try {
      const response = await fetch(`/api/whatsapp/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: chat.whatsapp_instances.instance_name,
          text: newText,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to edit");
      }

      toast.success("Mensagem editada");
      loadMessages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao editar mensagem");
    }
  };

  const toggleBlock = async () => {
    if (!chat || !chat.whatsapp_instances) return;

    // For now, we don't track blocked status locally
    // Just show a confirmation dialog
    const confirmBlock = window.confirm(
      "Tem certeza que deseja bloquear este contato?"
    );

    if (!confirmBlock) return;

    try {
      const response = await fetch("/api/whatsapp/chat/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: chat.whatsapp_instances.instance_name,
          number: chat.remote_jid,
          status: "block",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to block");
      }

      toast.success("Contato bloqueado");
    } catch (error) {
      toast.error("Erro ao bloquear contato");
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
          <div className="hidden md:block">
            <StageSelector
              itemType="chat"
              itemId={chat.id}
              currentStageId={chat.stage_id}
              currentBoardId={chat.board_id}
              onStageChange={(stageId, boardId) => {
                setChat({ ...chat, stage_id: stageId, board_id: boardId });
              }}
              compact
            />
          </div>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={toggleAssign}>
                {chat.assigned_to === currentUserId ? (
                  <>
                    <UserMinus className="h-4 w-4 mr-2" />
                    Desatribuir de mim
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Atribuir a mim
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleStatus}>
                {chat.status === "closed" ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reabrir conversa
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Finalizar conversa
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleArchive}>
                {chat.archived ? (
                  <>
                    <ArchiveRestore className="h-4 w-4 mr-2" />
                    Desarquivar
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4 mr-2" />
                    Arquivar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleBlock} className="text-destructive">
                <Ban className="h-4 w-4 mr-2" />
                Bloquear contato
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                    messageId={message.message_id}
                    content={message.content}
                    messageType={message.message_type}
                    mediaUrl={message.media_url}
                    fromMe={message.from_me}
                    status={message.status}
                    timestamp={message.timestamp}
                    onDelete={message.from_me && !message.isOptimistic ? deleteMessage : undefined}
                    onEdit={message.from_me && message.message_type === "text" && !message.isOptimistic ? editMessage : undefined}
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
          onTyping={handleTyping}
          disabled={!isConnected}
        />
      )}
    </div>
  );
}
