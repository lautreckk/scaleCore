"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { DateSeparator } from "./date-separator";
import { SystemMessage } from "./system-message";
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
  Users,
  Bot,
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
  participant_jid?: string | null;
  participant_name?: string | null;
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

interface Assignment {
  id: string;
  tenant_user_id: string;
  user_name: string;
  avatar_url: string | null;
  assigned_at: string;
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
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignment, setLoadingAssignment] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);
  const activeChatIdRef = useRef<string | null>(chatId);
  const instanceNameRef = useRef<string | null>(null);
  const supabase = createClient();

  const scrollToBottom = useCallback((instant = false) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: instant ? "instant" : "smooth"
        });
      });
    });
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
    if (!chatId || !instanceNameRef.current) return;

    const currentChatId = chatId;
    const currentInstanceName = instanceNameRef.current;

    // Update locally IMMEDIATELY
    setChat(prev => prev ? { ...prev, unread_count: 0 } : null);

    try {
      const response = await fetch("/api/whatsapp/chat/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: currentInstanceName,
          chatId: currentChatId,
        }),
      });

      if (!response.ok) {
        // API failed - update DB directly as fallback
        await supabase
          .from("chats")
          .update({ unread_count: 0 })
          .eq("id", currentChatId);
      }
    } catch (error) {
      // Network error - update DB directly as fallback
      await supabase
        .from("chats")
        .update({ unread_count: 0 })
        .eq("id", currentChatId);
    }
  }, [chatId, supabase]);

  // Load assignments for the chat
  const loadAssignments = useCallback(async () => {
    if (!chatId) return;

    try {
      const response = await fetch(`/api/chats/${chatId}/assign`);
      if (response.ok) {
        const data = await response.json();
        setAssignments(data.assignments || []);
      }
    } catch (error) {
      console.error("Error loading assignments:", error);
    }
  }, [chatId]);

  // Handle attend (assign current user to chat)
  const handleAttend = async () => {
    if (!chatId || loadingAssignment) return;

    setLoadingAssignment(true);
    try {
      const response = await fetch(`/api/chats/${chatId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to assign");
      }

      const data = await response.json();
      setAssignments(data.assignments || []);
      loadMessages(); // Reload to show system message
      toast.success("Você está atendendo esta conversa");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atender");
    } finally {
      setLoadingAssignment(false);
    }
  };

  // Handle leave (remove assignment)
  const handleLeaveChat = async () => {
    if (!chatId || loadingAssignment) return;

    setLoadingAssignment(true);
    try {
      const response = await fetch(`/api/chats/${chatId}/assign`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to leave");
      }

      const data = await response.json();
      setAssignments(data.assignments || []);
      loadMessages(); // Reload to show system message
      toast.success("Você saiu do atendimento");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao sair");
    } finally {
      setLoadingAssignment(false);
    }
  };

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

    // Ignore stale response if user already switched chats
    if (activeChatIdRef.current !== chatId) return;

    const chatData = data as unknown as Chat;
    setChat(chatData);
    instanceNameRef.current = chatData.whatsapp_instances?.instance_name || null;
    setAvatarError(false);
  }, [chatId, supabase]);

  // Mark as read when chat loads or unread count changes
  useEffect(() => {
    if (chat && chat.unread_count > 0) {
      markAsRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id, chat?.unread_count]);

  const loadMessages = useCallback(async () => {
    if (!chatId) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("timestamp", { ascending: true })
      .limit(200);

    // Ignore stale response if user already switched chats
    if (activeChatIdRef.current !== chatId) return;

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
    // Track the active chatId to ignore stale async responses
    activeChatIdRef.current = chatId;

    if (!chatId) {
      setChat(null);
      setMessages([]);
      setAssignments([]);
      instanceNameRef.current = null;
      return;
    }

    setLoading(true);
    setChat(null);
    setMessages([]);
    setAssignments([]);
    instanceNameRef.current = null;
    loadChat();
    loadMessages();
    loadAssignments();

    // Set up real-time subscription for messages
    const messagesChannel = supabase
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

    // Set up real-time subscription for chat updates (unread_count, etc.)
    const chatChannel = supabase
      .channel(`chat-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chats",
          filter: `id=eq.${chatId}`,
        },
        (payload) => {
          console.log("Chat realtime update:", payload);
          setChat(prev => prev ? { ...prev, ...payload.new } : null);
        }
      )
      .subscribe();

    // Set up real-time subscription for assignments
    const assignmentsChannel = supabase
      .channel(`assignments-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_assignments",
          filter: `chat_id=eq.${chatId}`,
        },
        () => {
          loadAssignments();
          loadMessages(); // Reload to show system message
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(assignmentsChannel);
    };
  }, [chatId, loadChat, loadMessages, loadAssignments, supabase]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      const timer = setTimeout(() => {
        scrollToBottom(isInitialLoadRef.current);
        isInitialLoadRef.current = false;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages, loading, scrollToBottom]);

  // Reset initial load ref when chat changes
  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [chatId]);

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

    // Capture the chatId at send time to prevent stale updates
    const sentFromChatId = chatId;

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
      // Ignore if user already switched to a different chat
      if (activeChatIdRef.current !== sentFromChatId) return;

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
      // Ignore if user already switched to a different chat
      if (activeChatIdRef.current !== sentFromChatId) return;

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

    // Capture the chatId at send time to prevent stale updates
    const sentFromChatId = chatId;

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

        // Ignore if user already switched to a different chat
        if (activeChatIdRef.current !== sentFromChatId) return;

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
        // Only update state if still on the same chat
        if (activeChatIdRef.current === sentFromChatId) {
          // Remove optimistic message on error
          setMessages(prev => prev.filter(m => m.id !== tempId));
          toast.error("Erro ao enviar arquivo");
        }
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
  const isGroup = chat.remote_jid.endsWith("@g.us");
  const displayName = chat.contact_name || chat.leads?.name || formatPhoneNumber(chat.remote_jid);

  // Check if current user is assigned
  const isAssigned = assignments.some(a => a.tenant_user_id === currentUserId);
  const canSendMessages = isConnected && assignments.length > 0 && isAssigned;

  // Helper to determine if date separator should be shown
  const shouldShowDateSeparator = (current: Message, previous?: Message) => {
    if (!previous) return true;
    const d1 = new Date(current.timestamp);
    const d2 = new Date(previous.timestamp);
    return d1.getDate() !== d2.getDate() ||
           d1.getMonth() !== d2.getMonth() ||
           d1.getFullYear() !== d2.getFullYear();
  };

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
            ) : isGroup ? (
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
                <Users className="h-5 w-5" />
              </div>
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
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-white truncate">{displayName}</h3>
              {isGroup && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  Grupo
                </Badge>
              )}
              {/* Show assigned attendants avatars */}
              {assignments.length > 0 && (
                <div className="flex items-center gap-1.5 ml-1">
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">Atendendo:</span>
                  <div className="flex -space-x-1.5">
                    {assignments.map((a) => (
                      <div
                        key={a.id}
                        className="h-5 w-5 rounded-full border-2 border-background bg-primary flex items-center justify-center text-[9px] text-white font-medium"
                        title={a.user_name}
                      >
                        {a.avatar_url ? (
                          <img src={a.avatar_url} alt={a.user_name} className="h-full w-full rounded-full object-cover" />
                        ) : (
                          a.user_name.charAt(0).toUpperCase()
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              {isGroup ? chat.remote_jid.replace("@g.us", "") : formatPhoneNumber(chat.remote_jid)}
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
              {isAssigned ? (
                <DropdownMenuItem onClick={handleLeaveChat} disabled={loadingAssignment}>
                  <UserMinus className="h-4 w-4 mr-2" />
                  Sair do atendimento
                </DropdownMenuItem>
              ) : assignments.length < 3 ? (
                <DropdownMenuItem onClick={handleAttend} disabled={loadingAssignment}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {assignments.length === 0 ? "Atender conversa" : "Participar do atendimento"}
                </DropdownMenuItem>
              ) : null}
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
                {messages.map((message, index) => {
                  const isGroupChat = chat?.remote_jid?.endsWith("@g.us") ?? false;
                  const showDateSeparator = shouldShowDateSeparator(message, messages[index - 1]);

                  // Render handoff summary notes (HAND-02)
                  if (message.message_type === "system_note") {
                    const rawContent = message.content || "";
                    const isFallback = rawContent.startsWith("[Handoff IA]");
                    const displayContent = rawContent
                      .replace(/^\[Resumo IA\]\s*/, "")
                      .replace(/^\[Handoff IA\]\s*/, "");

                    return (
                      <React.Fragment key={message.id}>
                        {showDateSeparator && (
                          <DateSeparator date={message.timestamp} />
                        )}
                        <div className="flex justify-center my-3">
                          <div className="mx-auto max-w-[85%] bg-muted/40 border border-border rounded-lg px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs font-medium text-muted-foreground">
                                Resumo da conversa
                              </span>
                            </div>
                            <p className={`text-sm mt-2 whitespace-pre-wrap ${
                              isFallback ? "text-muted-foreground/50" : "text-muted-foreground"
                            }`}>
                              {displayContent}
                            </p>
                            {message.timestamp && (
                              <p className="text-[10px] text-muted-foreground/70 mt-1 text-right">
                                {new Date(message.timestamp).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  }

                  // Render system messages differently
                  if (message.message_type === "system") {
                    return (
                      <React.Fragment key={message.id}>
                        {showDateSeparator && (
                          <DateSeparator date={message.timestamp} />
                        )}
                        <SystemMessage
                          content={message.content || ""}
                          timestamp={message.timestamp}
                        />
                      </React.Fragment>
                    );
                  }

                  return (
                    <React.Fragment key={message.id}>
                      {showDateSeparator && (
                        <DateSeparator date={message.timestamp} />
                      )}
                      <MessageBubble
                        messageId={message.message_id}
                        content={message.content}
                        messageType={message.message_type}
                        mediaUrl={message.media_url}
                        fromMe={message.from_me}
                        status={message.status}
                        timestamp={message.timestamp}
                        onDelete={message.from_me && !message.isOptimistic ? deleteMessage : undefined}
                        onEdit={message.from_me && message.message_type === "text" && !message.isOptimistic ? editMessage : undefined}
                        participantName={message.participant_name}
                        isGroup={isGroupChat}
                      />
                    </React.Fragment>
                  );
                })}
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
      ) : assignments.length === 0 ? (
        // No one assigned - show attend button
        <div className="p-4 border-t border-border bg-card">
          <Button
            onClick={handleAttend}
            className="w-full"
            size="lg"
            disabled={loadingAssignment}
          >
            {loadingAssignment ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Atender Conversa
          </Button>
        </div>
      ) : !isAssigned ? (
        // Others assigned but not me - option to join
        <div className="p-4 border-t border-border bg-card">
          <div className="text-center text-sm text-muted-foreground mb-2">
            Este chat está sendo atendido por outros usuários
          </div>
          {assignments.length < 3 && (
            <Button
              onClick={handleAttend}
              variant="outline"
              className="w-full"
              disabled={loadingAssignment}
            >
              {loadingAssignment ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Participar do Atendimento
            </Button>
          )}
        </div>
      ) : (
        // I'm assigned - show normal input
        <MessageInput
          onSendText={sendTextMessage}
          onSendMedia={sendMediaMessage}
          onTyping={handleTyping}
          disabled={!canSendMessages}
        />
      )}
    </div>
  );
}
