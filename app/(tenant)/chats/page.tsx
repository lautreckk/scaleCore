"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatRelativeTime, cn } from "@/lib/utils";
import {
  Search,
  MessageSquare,
  Phone,
  Archive,
  Filter,
} from "lucide-react";

interface Chat {
  id: string;
  remote_jid: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  archived: boolean;
  instance: {
    name: string;
    color: string;
  } | null;
  lead: {
    id: string;
    name: string;
  } | null;
}

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const loadChats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

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
          instance:whatsapp_instances(name, color),
          lead:leads(id, name)
        `)
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("archived", showArchived)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(50);

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
      .channel("chats-changes")
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
  }, [supabase, search, showArchived]);

  const formatPhoneNumber = (jid: string) => {
    const phone = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    if (phone.length === 13 && phone.startsWith("55")) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    return phone;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Conversas</h1>
          <p className="text-muted-foreground">Gerencie suas conversas do WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="h-4 w-4 mr-2" />
            {showArchived ? "Ver ativas" : "Arquivadas"}
          </Button>
        </div>
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

      {/* Chats List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-surface-elevated rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : chats.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Nenhuma conversa</h3>
            <p className="text-muted-foreground text-center mb-4">
              {showArchived
                ? "Você não tem conversas arquivadas."
                : "Conecte seu WhatsApp para começar a receber mensagens."}
            </p>
            {!showArchived && (
              <Link href="/settings/integrations">
                <Button>
                  <Phone className="h-4 w-4 mr-2" />
                  Conectar WhatsApp
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <Link key={chat.id} href={`/chats/${chat.id}`}>
              <Card
                className={cn(
                  "hover:border-primary transition-colors cursor-pointer",
                  chat.unread_count > 0 && "border-primary/50"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full bg-green-600 flex items-center justify-center text-white font-medium">
                        {(chat.contact_name || chat.lead?.name || "?").charAt(0).toUpperCase()}
                      </div>
                      {chat.instance && (
                        <div
                          className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background"
                          style={{ backgroundColor: chat.instance.color || "#DC2626" }}
                          title={chat.instance.name}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-white truncate">
                          {chat.contact_name || chat.lead?.name || formatPhoneNumber(chat.remote_jid)}
                        </h3>
                        {chat.last_message_at && (
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(chat.last_message_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-muted-foreground truncate">
                          {chat.last_message || "Sem mensagens"}
                        </p>
                        {chat.unread_count > 0 && (
                          <span className="ml-2 h-5 min-w-[20px] rounded-full bg-primary text-white text-xs font-medium flex items-center justify-center px-1.5">
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
