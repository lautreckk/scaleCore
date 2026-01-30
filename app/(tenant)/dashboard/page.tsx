"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  Users,
  MessageSquare,
  Megaphone,
  Wallet,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Send,
} from "lucide-react";

interface DashboardMetrics {
  totalLeads: number;
  newLeadsToday: number;
  totalChats: number;
  unreadChats: number;
  activeCampaigns: number;
  walletBalance: number;
  messagesSentToday: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalLeads: 0,
    newLeadsToday: 0,
    totalChats: 0,
    unreadChats: 0,
    activeCampaigns: 0,
    walletBalance: 0,
    messagesSentToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadMetrics = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      const tenantId = tenantUser.tenant_id;
      const today = new Date().toISOString().split("T")[0];

      // Fetch all metrics in parallel
      const [
        leadsResult,
        newLeadsResult,
        chatsResult,
        unreadChatsResult,
        campaignsResult,
        walletResult,
      ] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", today),
        supabase.from("chats").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("chats").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gt("unread_count", 0),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "running"),
        supabase.from("wallets").select("balance").eq("tenant_id", tenantId).single(),
      ]);

      setMetrics({
        totalLeads: leadsResult.count || 0,
        newLeadsToday: newLeadsResult.count || 0,
        totalChats: chatsResult.count || 0,
        unreadChats: unreadChatsResult.count || 0,
        activeCampaigns: campaignsResult.count || 0,
        walletBalance: walletResult.data?.balance || 0,
        messagesSentToday: 0,
      });

      setLoading(false);
    };

    loadMetrics();
  }, [supabase]);

  const cards = [
    {
      title: "Total de Leads",
      value: metrics.totalLeads,
      change: metrics.newLeadsToday,
      changeLabel: "novos hoje",
      icon: Users,
      trend: "up" as const,
    },
    {
      title: "Conversas",
      value: metrics.totalChats,
      change: metrics.unreadChats,
      changeLabel: "não lidas",
      icon: MessageSquare,
      trend: metrics.unreadChats > 0 ? ("up" as "up" | "down" | "neutral") : ("neutral" as "up" | "down" | "neutral"),
    },
    {
      title: "Campanhas Ativas",
      value: metrics.activeCampaigns,
      change: 0,
      changeLabel: "em execução",
      icon: Megaphone,
      trend: "neutral" as "up" | "down" | "neutral",
    },
    {
      title: "Saldo Disponível",
      value: formatCurrency(metrics.walletBalance),
      change: 0,
      changeLabel: "",
      icon: Wallet,
      trend: "neutral" as "up" | "down" | "neutral",
      isFormatted: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu negócio</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {card.isFormatted ? card.value : card.value.toLocaleString("pt-BR")}
              </div>
              {card.changeLabel && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  {card.trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
                  {card.trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
                  <span className={card.trend === "up" ? "text-green-500" : ""}>
                    +{card.change}
                  </span>
                  {card.changeLabel}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-white">Adicionar Lead</p>
              <p className="text-sm text-muted-foreground">Cadastrar novo lead</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Send className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-white">Nova Campanha</p>
              <p className="text-sm text-muted-foreground">Criar campanha</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-white">Ver Conversas</p>
              <p className="text-sm text-muted-foreground">{metrics.unreadChats} não lidas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-white">Adicionar Créditos</p>
              <p className="text-sm text-muted-foreground">Recarregar saldo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Leads Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Nenhum lead cadastrado ainda
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimas Mensagens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Nenhuma mensagem ainda
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
