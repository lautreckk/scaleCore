"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatListItem } from "./chat-list-item";
import { InstanceDropdown, type InstanceWithUnread } from "./instance-dropdown";
import { Search, Archive, MessageSquare, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Chat {
  id: string;
  remote_jid: string;
  contact_name: string | null;
  profile_picture_url: string | null;
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
  const [instancesWithUnread, setInstancesWithUnread] = useState<InstanceWithUnread[]>([]);
  const supabase = createClient();

  const loadUnreadCounts = useCallback(async () => {
    if (!tenantId) return;

    const { data: unreadChats } = await supabase
      .from("chats")
      .select("instance_id, unread_count")
      .eq("tenant_id", tenantId)
      .eq("archived", false)
      .gt("unread_count", 0);

    const countByInstance = (unreadChats || []).reduce((acc, chat) => {
      if (chat.instance_id) {
        acc[chat.instance_id] = (acc[chat.instance_id] || 0) + chat.unread_count;
      }
      return acc;
    }, {} as Record<string, number>);

    const instancesData: InstanceWithUnread[] = instances.map((instance) => ({
      ...instance,
      unreadCount: countByInstance[instance.id] || 0,
    }));

    setInstancesWithUnread(instancesData);
  }, [tenantId, instances, supabase]);

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

  // Load unread counts when tenant or instances change
  useEffect(() => {
    if (tenantId && instances.length > 0) {
      loadUnreadCounts();
    }
  }, [tenantId, instances, loadUnreadCounts]);

  useEffect(() => {
    if (!tenantId) return;

    const loadChats = async () => {
      let query = supabase
        .from("chats")
        .select(`
          id,
          remote_jid,
          contact_name,
          profile_picture_url,
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
        {
          event: "*",
          schema: "public",
          table: "chats",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log("Chat realtime event:", payload);
          loadChats();
          loadUnreadCounts();
        }
      )
      .subscribe((status) => {
        console.log("Chat subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, tenantId, search, showArchived, selectedInstanceId, loadUnreadCounts]);

  const totalUnread = instancesWithUnread.reduce((sum, instance) => sum + instance.unreadCount, 0);
  const filteredUnread = chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Conversas</h2>
          {filteredUnread > 0 && (
            <span className="h-6 min-w-[24px] rounded-full bg-primary text-white text-xs font-medium flex items-center justify-center px-2">
              {filteredUnread > 99 ? "99+" : filteredUnread}
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

        {/* Instance Dropdown */}
        {instances.length > 1 && (
          <InstanceDropdown
            instances={instancesWithUnread}
            selectedInstanceId={selectedInstanceId}
            onSelect={setSelectedInstanceId}
            totalUnread={totalUnread}
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
                profilePictureUrl={chat.profile_picture_url}
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
