"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  MessageSquare,
  User,
  Phone,
  Mail,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { KanbanCardItem } from "./kanban-card";
import Link from "next/link";
import { cn, formatPhone } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface Message {
  id: string;
  content: string | null;
  message_type: string;
  from_me: boolean;
  timestamp: string;
}

interface KanbanSidePanelProps {
  item: KanbanCardItem;
  stages: Stage[];
  onClose: () => void;
  onStageChange: (stageId: string) => void;
}

export function KanbanSidePanel({
  item,
  stages,
  onClose,
  onStageChange,
}: KanbanSidePanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const isChat = item.type === "chat";

  useEffect(() => {
    if (isChat) {
      loadMessages();
    }
  }, [item.id]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("messages")
        .select("id, content, message_type, from_me, timestamp")
        .eq("chat_id", item.id)
        .order("timestamp", { ascending: false })
        .limit(20);

      setMessages(data || []);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (jid: string) => {
    const phone = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    if (phone.length === 13 && phone.startsWith("55")) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    return phone;
  };

  const displayName = isChat
    ? item.contact_name || formatPhoneNumber(item.remote_jid || "")
    : item.name || "Sem nome";

  const currentStage = stages.find(
    (s) => s.id === item.stage_id
  );

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-surface border-l border-border z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          {isChat && item.profile_picture_url ? (
            <img
              src={item.profile_picture_url}
              alt={displayName}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center text-white font-medium",
                isChat ? "bg-green-600" : "bg-primary"
              )}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="font-medium text-white">{displayName}</h3>
            <p className="text-sm text-muted-foreground">
              {isChat ? "Conversa" : "Lead"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Stage Selector */}
      <div className="p-4 border-b border-border">
        <label className="text-sm text-muted-foreground block mb-2">
          Etapa
        </label>
        <Select
          value={item.stage_id || ""}
          onValueChange={onStageChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma etapa" />
          </SelectTrigger>
          <SelectContent>
            {stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contact Info */}
      <div className="p-4 border-b border-border space-y-3">
        {isChat && item.remote_jid && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{formatPhoneNumber(item.remote_jid)}</span>
          </div>
        )}
        {!isChat && item.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{formatPhone(item.phone)}</span>
          </div>
        )}
        {!isChat && item.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{item.email}</span>
          </div>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        {isChat ? (
          <>
            <h4 className="text-sm font-medium text-white mb-3">
              Ultimas mensagens
            </h4>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length > 0 ? (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "p-2 rounded-lg text-sm",
                      message.from_me
                        ? "bg-primary/20 ml-4"
                        : "bg-surface-elevated mr-4"
                    )}
                  >
                    <p className="text-white">
                      {message.content || `[${message.message_type}]`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(message.timestamp).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhuma mensagem
              </p>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white">
              Informacoes do Lead
            </h4>
            {item.status && (
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <p className="text-white capitalize">{item.status}</p>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Link
          href={isChat ? `/chats?id=${item.id}` : `/leads/${item.id}`}
          className="block"
        >
          <Button className="w-full">
            <ExternalLink className="h-4 w-4 mr-2" />
            {isChat ? "Abrir Conversa" : "Ver Lead"}
          </Button>
        </Link>
      </div>
    </div>
  );
}
