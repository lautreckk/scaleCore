"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Users,
  Inbox,
  Megaphone,
  Zap,
  Wallet,
  Settings,
  UsersRound,
  Link2,
  X,
  Kanban,
  ChevronDown,
  MessageSquare,
  Clock,
  User,
  CheckCircle,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  plan?: string;
}

interface InboxCounts {
  all: number;
  new: number;
  waiting: number;
  mine: number;
  closed: number;
  archived: number;
}

const inboxFilters = [
  { id: "all", name: "Todos", icon: Inbox, query: "" },
  { id: "new", name: "Novos", icon: MessageSquare, query: "?filter=new" },
  { id: "waiting", name: "Aguardando", icon: Clock, query: "?filter=waiting" },
  { id: "mine", name: "Meus", icon: User, query: "?filter=mine" },
  { id: "closed", name: "Finalizados", icon: CheckCircle, query: "?filter=closed" },
  { id: "archived", name: "Arquivados", icon: Archive, query: "?filter=archived" },
];

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Users },
  // Inbox is handled separately with dropdown
  { name: "Kanban", href: "/kanban", icon: Kanban },
  { name: "Campanhas", href: "/campaigns", icon: Megaphone },
  { name: "Automações", href: "/automations", icon: Zap },
  { name: "Créditos", href: "/credits", icon: Wallet },
  { name: "Equipe", href: "/team", icon: UsersRound },
  { name: "Integrações", href: "/settings/integrations", icon: Link2 },
  { name: "Configurações", href: "/settings", icon: Settings },
];

export function Sidebar({ open, onClose, plan = "Starter" }: SidebarProps) {
  const pathname = usePathname();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxCounts, setInboxCounts] = useState<InboxCounts>({
    all: 0,
    new: 0,
    waiting: 0,
    mine: 0,
    closed: 0,
    archived: 0,
  });
  const supabase = createClient();

  // Auto-expand inbox when on chats page
  useEffect(() => {
    if (pathname.startsWith("/chats")) {
      setInboxOpen(true);
    }
  }, [pathname]);

  // Load inbox counts
  useEffect(() => {
    const loadCounts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id, id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      const tenantId = tenantUser.tenant_id;
      const currentUserId = tenantUser.id;

      // Get counts for each filter (using unread_count > 0 for badges)
      const [allResult, newResult, waitingResult, mineResult, closedResult, archivedResult] = await Promise.all([
        // All unread
        supabase
          .from("chats")
          .select("unread_count")
          .eq("tenant_id", tenantId)
          .eq("archived", false)
          .or("status.is.null,status.neq.closed")
          .gt("unread_count", 0),
        // New (unassigned with unread)
        supabase
          .from("chats")
          .select("unread_count")
          .eq("tenant_id", tenantId)
          .eq("archived", false)
          .is("assigned_to", null)
          .or("status.is.null,status.neq.closed")
          .gt("unread_count", 0),
        // Waiting (all with unread)
        supabase
          .from("chats")
          .select("unread_count")
          .eq("tenant_id", tenantId)
          .eq("archived", false)
          .gt("unread_count", 0)
          .or("status.is.null,status.neq.closed"),
        // Mine (assigned to me with unread)
        supabase
          .from("chats")
          .select("unread_count")
          .eq("tenant_id", tenantId)
          .eq("archived", false)
          .eq("assigned_to", currentUserId)
          .or("status.is.null,status.neq.closed")
          .gt("unread_count", 0),
        // Closed with unread
        supabase
          .from("chats")
          .select("unread_count")
          .eq("tenant_id", tenantId)
          .eq("archived", false)
          .eq("status", "closed")
          .gt("unread_count", 0),
        // Archived with unread
        supabase
          .from("chats")
          .select("unread_count")
          .eq("tenant_id", tenantId)
          .eq("archived", true)
          .gt("unread_count", 0),
      ]);

      // Sum up unread counts
      const sumUnread = (data: { unread_count: number }[] | null) =>
        (data || []).reduce((sum, c) => sum + (c.unread_count || 0), 0);

      setInboxCounts({
        all: sumUnread(allResult.data),
        new: sumUnread(newResult.data),
        waiting: sumUnread(waitingResult.data),
        mine: sumUnread(mineResult.data),
        closed: sumUnread(closedResult.data),
        archived: sumUnread(archivedResult.data),
      });
    };

    loadCounts();

    // Set up real-time subscription for chat updates
    const channel = supabase
      .channel("sidebar-inbox-counts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chats",
        },
        () => {
          loadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const isActiveRoute = (href: string) => {
    if (pathname === href) return true;
    if (href === "/settings") {
      return pathname.startsWith("/settings/") &&
             !pathname.startsWith("/settings/integrations");
    }
    return pathname.startsWith(href + "/");
  };

  const isInboxActive = pathname.startsWith("/chats");
  const totalUnread = inboxCounts.all;

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/80 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-surface transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-border">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">S</span>
              </div>
              <span className="text-lg font-bold text-white">ScaleForce</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {/* Dashboard */}
              <li>
                <Link
                  href="/dashboard"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActiveRoute("/dashboard")
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-surface-elevated hover:text-white"
                  )}
                >
                  <LayoutDashboard className="h-5 w-5" />
                  Dashboard
                </Link>
              </li>

              {/* Leads */}
              <li>
                <Link
                  href="/leads"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActiveRoute("/leads")
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-surface-elevated hover:text-white"
                  )}
                >
                  <Users className="h-5 w-5" />
                  Leads
                </Link>
              </li>

              {/* Inbox with dropdown */}
              <li>
                <Collapsible open={inboxOpen} onOpenChange={setInboxOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center justify-between w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isInboxActive
                          ? "bg-primary text-white"
                          : "text-muted-foreground hover:bg-surface-elevated hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Inbox className="h-5 w-5" />
                        Inbox
                        {totalUnread > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-xs">
                            {totalUnread > 99 ? "99+" : totalUnread}
                          </Badge>
                        )}
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          inboxOpen && "rotate-180"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1 ml-4 space-y-1">
                    {inboxFilters.map((filter) => {
                      const count = inboxCounts[filter.id as keyof InboxCounts];
                      const filterPath = `/chats${filter.query}`;
                      const isActive = pathname === "/chats" && filter.id === "all" ||
                                       pathname.includes(`filter=${filter.id}`);

                      return (
                        <Link
                          key={filter.id}
                          href={filterPath}
                          onClick={onClose}
                          className={cn(
                            "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                            isActive
                              ? "bg-primary/20 text-white"
                              : "text-muted-foreground hover:bg-surface-elevated hover:text-white"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <filter.icon className="h-4 w-4" />
                            {filter.name}
                          </div>
                          {count > 0 && (
                            <Badge
                              variant={filter.id === "waiting" ? "destructive" : "secondary"}
                              className="h-5 min-w-[20px] px-1.5 text-xs"
                            >
                              {count > 99 ? "99+" : count}
                            </Badge>
                          )}
                        </Link>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              </li>

              {/* Rest of navigation */}
              {navigation.slice(2).map((item) => {
                const isActive = isActiveRoute(item.href);
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-white"
                          : "text-muted-foreground hover:bg-surface-elevated hover:text-white"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3 rounded-lg bg-surface-elevated p-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Seu plano</p>
                <p className="text-sm font-medium text-white truncate capitalize">{plan}</p>
              </div>
              <Link href="/settings/billing">
                <Button size="sm" variant="outline" className="text-xs">
                  Upgrade
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
