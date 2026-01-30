"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatListItem } from "./chat-list-item";
import { InstanceFilter } from "./instance-filter";
import { Search, Archive, MessageSquare, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Chat {
  id: string;
  remote_jid: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  archived: boolean;
  instance_id: string | null;
  whatsapp_instances: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  leads: {
    id: string;
    name: string;
  } | null;
}

interface Instance {
  id: string;
  name: string;
  color: string | null;
}

interface ChatListProps {
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  instances: Instance[];
}

export function ChatList({ selectedChatId, onSelectChat, instances }: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const loadTenant = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (tenantUser) {
        setTenantId(tenantUser.tenant_id);
      }
    };

    loadTenant();
  }, [supabase]);

  useEffect(() => {
    if (!tenantId) return;

    const loadChats = async () => {
      let query = supabase
        .from("chats")
        .select(`
          id,
          remote_jid,
          contact_name,
          last_message,
          last_message_at,
          unread_count,
          archived,
          instance_id,
          whatsapp_instances(id, name, color),
          leads(id, name)
        `)
        .eq("tenant_id", tenantId)
        .eq("archived", showArchived)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(100);

      if (selectedInstanceId) {
        query = query.eq("instance_id", selectedInstanceId);
      }

      if (search) {
        query = query.or(`contact_name.ilike.%${search}%,remote_jid.ilike.%${search}%`);
      }

      const { data } = await query;
      setChats((data as unknown as Chat[]) || []);
      setLoading(false);
    };

    loadChats();

    // Set up real-time subscription
    const channel = supabase
      .channel("chats-list-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chats" },
        () => {
          loadChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, tenantId, search, showArchived, selectedInstanceId]);

  const totalUnread = chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Conversas</h2>
          {totalUnread > 0 && (
            <span className="h-6 min-w-[24px] rounded-full bg-primary text-white text-xs font-medium flex items-center justify-center px-2">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Instance Filter */}
        {instances.length > 1 && (
          <InstanceFilter
            instances={instances}
            selectedInstanceId={selectedInstanceId}
            onSelect={setSelectedInstanceId}
          />
        )}

        {/* Archived Toggle */}
        <Button
          variant={showArchived ? "default" : "outline"}
          size="sm"
          className="w-full"
          onClick={() => setShowArchived(!showArchived)}
        >
          <Archive className="h-4 w-4 mr-2" />
          {showArchived ? "Ver conversas ativas" : "Ver arquivadas"}
        </Button>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {search
                ? "Nenhuma conversa encontrada"
                : showArchived
                ? "Nenhuma conversa arquivada"
                : "Nenhuma conversa ativa"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {chats.map((chat) => (
              <ChatListItem
                key={chat.id}
                id={chat.id}
                contactName={chat.contact_name}
                remoteJid={chat.remote_jid}
                lastMessage={chat.last_message}
                lastMessageAt={chat.last_message_at}
                unreadCount={chat.unread_count}
                instanceName={chat.whatsapp_instances?.name || null}
                instanceColor={chat.whatsapp_instances?.color || null}
                leadName={chat.leads?.name || null}
                isSelected={selectedChatId === chat.id}
                onClick={() => onSelectChat(chat.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
