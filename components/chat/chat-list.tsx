"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ChatListItem } from "./chat-list-item";
import { InstanceDropdown, type InstanceWithUnread } from "./instance-dropdown";
import {
  Search,
  Archive,
  MessageSquare,
  Loader2,
  Inbox,
  Clock,
  User,
  CheckCircle,
} from "lucide-react";
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
  status: string | null;
  assigned_to: string | null;
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

type FilterTab = "all" | "new" | "waiting" | "mine" | "closed" | "archived";

interface FilterTabConfig {
  id: FilterTab;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const FILTER_TABS: FilterTabConfig[] = [
  { id: "all", label: "Todos", icon: <Inbox className="h-4 w-4" />, description: "Todas as conversas" },
  { id: "new", label: "Novos", icon: <MessageSquare className="h-4 w-4" />, description: "Chats não atribuídos" },
  { id: "waiting", label: "Aguardando", icon: <Clock className="h-4 w-4" />, description: "Aguardando resposta" },
  { id: "mine", label: "Meus", icon: <User className="h-4 w-4" />, description: "Atribuídos a você" },
  { id: "closed", label: "Finalizados", icon: <CheckCircle className="h-4 w-4" />, description: "Conversas encerradas" },
  { id: "archived", label: "Arquivados", icon: <Archive className="h-4 w-4" />, description: "Conversas arquivadas" },
];

export function ChatList({ selectedChatId, onSelectChat, instances }: ChatListProps) {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter") as FilterTab | null;

  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>(filterParam || "all");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [instancesWithUnread, setInstancesWithUnread] = useState<InstanceWithUnread[]>([]);
  const [tabCounts, setTabCounts] = useState<Record<FilterTab, number>>({
    all: 0,
    new: 0,
    waiting: 0,
    mine: 0,
    closed: 0,
    archived: 0,
  });
  const supabase = createClient();

  // Sync activeTab with URL filter parameter
  useEffect(() => {
    const validFilters: FilterTab[] = ["all", "new", "waiting", "mine", "closed", "archived"];
    if (filterParam && validFilters.includes(filterParam)) {
      setActiveTab(filterParam);
    } else if (!filterParam) {
      setActiveTab("all");
    }
  }, [filterParam]);

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

  const loadTabCounts = useCallback(async () => {
    if (!tenantId || !currentUserId) return;

    // Get counts for each filter
    const [allResult, newResult, waitingResult, mineResult, closedResult, archivedResult] = await Promise.all([
      // All (non-archived, non-closed)
      supabase
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("archived", false)
        .or("status.is.null,status.neq.closed"),
      // New (unassigned)
      supabase
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("archived", false)
        .is("assigned_to", null)
        .or("status.is.null,status.neq.closed"),
      // Waiting (has unread messages)
      supabase
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("archived", false)
        .gt("unread_count", 0)
        .or("status.is.null,status.neq.closed"),
      // Mine (assigned to current user)
      supabase
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("archived", false)
        .eq("assigned_to", currentUserId)
        .or("status.is.null,status.neq.closed"),
      // Closed
      supabase
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("archived", false)
        .eq("status", "closed"),
      // Archived
      supabase
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("archived", true),
    ]);

    setTabCounts({
      all: allResult.count || 0,
      new: newResult.count || 0,
      waiting: waitingResult.count || 0,
      mine: mineResult.count || 0,
      closed: closedResult.count || 0,
      archived: archivedResult.count || 0,
    });
  }, [tenantId, currentUserId, supabase]);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id, id")
        .eq("user_id", user.id)
        .single();

      if (tenantUser) {
        setTenantId(tenantUser.tenant_id);
        setCurrentUserId(tenantUser.id);
      }
    };

    loadUser();
  }, [supabase]);

  // Load unread counts and tab counts when tenant or instances change
  useEffect(() => {
    if (tenantId && instances.length > 0) {
      loadUnreadCounts();
    }
  }, [tenantId, instances, loadUnreadCounts]);

  useEffect(() => {
    if (tenantId && currentUserId) {
      loadTabCounts();
    }
  }, [tenantId, currentUserId, loadTabCounts]);

  useEffect(() => {
    if (!tenantId) return;

    const loadChats = async () => {
      setLoading(true);

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
          status,
          assigned_to,
          instance_id,
          whatsapp_instances(id, name, color),
          leads(id, name)
        `)
        .eq("tenant_id", tenantId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(100);

      // Apply filter based on active tab
      switch (activeTab) {
        case "all":
          query = query.eq("archived", false).or("status.is.null,status.neq.closed");
          break;
        case "new":
          query = query.eq("archived", false).is("assigned_to", null).or("status.is.null,status.neq.closed");
          break;
        case "waiting":
          query = query.eq("archived", false).gt("unread_count", 0).or("status.is.null,status.neq.closed");
          break;
        case "mine":
          query = query.eq("archived", false).eq("assigned_to", currentUserId).or("status.is.null,status.neq.closed");
          break;
        case "closed":
          query = query.eq("archived", false).eq("status", "closed");
          break;
        case "archived":
          query = query.eq("archived", true);
          break;
      }

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
          loadTabCounts();
        }
      )
      .subscribe((status) => {
        console.log("Chat subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, tenantId, currentUserId, search, activeTab, selectedInstanceId, loadUnreadCounts, loadTabCounts]);

  const totalUnread = instancesWithUnread.reduce((sum, instance) => sum + instance.unreadCount, 0);

  const getEmptyMessage = () => {
    if (search) return "Nenhuma conversa encontrada";
    switch (activeTab) {
      case "new": return "Nenhum chat novo";
      case "waiting": return "Nenhum chat aguardando";
      case "mine": return "Nenhum chat atribuído a você";
      case "closed": return "Nenhum chat finalizado";
      case "archived": return "Nenhum chat arquivado";
      default: return "Nenhuma conversa";
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
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

        {/* Instance Dropdown */}
        {instances.length > 1 && (
          <InstanceDropdown
            instances={instancesWithUnread}
            selectedInstanceId={selectedInstanceId}
            onSelect={setSelectedInstanceId}
            totalUnread={totalUnread}
          />
        )}
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-border overflow-x-auto scrollbar-hide">
        <div className="flex p-2 gap-1 min-w-max">
            {FILTER_TABS.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap",
                  activeTab === tab.id && "bg-primary text-primary-foreground"
                )}
                title={tab.description}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                {tabCounts[tab.id] > 0 && (
                  <Badge
                    variant={activeTab === tab.id ? "secondary" : "outline"}
                    className="ml-1 h-5 min-w-[20px] px-1.5 text-xs"
                  >
                    {tabCounts[tab.id] > 99 ? "99+" : tabCounts[tab.id]}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
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
            <p className="text-muted-foreground">{getEmptyMessage()}</p>
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
                status={chat.status}
                isAssigned={!!chat.assigned_to}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
