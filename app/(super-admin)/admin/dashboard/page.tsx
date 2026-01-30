"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  Building2,
  Users,
  MessageSquare,
  DollarSign,
  TrendingUp,
} from "lucide-react";

interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  totalLeads: number;
  totalMessages: number;
  mrr: number;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics>({
    totalTenants: 0,
    activeTenants: 0,
    totalLeads: 0,
    totalMessages: 0,
    mrr: 0,
  });
  const [recentTenants, setRecentTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadMetrics = async () => {
      // Get counts
      const [tenantsResult, activeTenantsResult, leadsResult] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }),
        supabase.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("leads").select("id", { count: "exact", head: true }),
      ]);

      // Calculate MRR
      const { data: tenantsWithPrices } = await supabase
        .from("tenants")
        .select("monthly_price")
        .eq("status", "active");

      const mrr = tenantsWithPrices?.reduce((acc, t) => acc + (t.monthly_price || 0), 0) || 0;

      // Get recent tenants
      const { data: recent } = await supabase
        .from("tenants")
        .select("id, name, slug, plan, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      setMetrics({
        totalTenants: tenantsResult.count || 0,
        activeTenants: activeTenantsResult.count || 0,
        totalLeads: leadsResult.count || 0,
        totalMessages: 0,
        mrr,
      });

      setRecentTenants(recent || []);
      setLoading(false);
    };

    loadMetrics();
  }, [supabase]);

  const cards = [
    {
      title: "Total de Tenants",
      value: metrics.totalTenants,
      icon: Building2,
      description: `${metrics.activeTenants} ativos`,
    },
    {
      title: "Total de Leads",
      value: metrics.totalLeads,
      icon: Users,
      description: "Todos os tenants",
    },
    {
      title: "Mensagens Enviadas",
      value: metrics.totalMessages,
      icon: MessageSquare,
      description: "Este mês",
    },
    {
      title: "MRR",
      value: formatCurrency(metrics.mrr),
      icon: DollarSign,
      description: "Receita mensal recorrente",
      isFormatted: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard Admin</h1>
        <p className="text-muted-foreground">Visão geral da plataforma</p>
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
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Tenants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tenants Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-surface-elevated rounded animate-pulse" />
              ))}
            </div>
          ) : recentTenants.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Nenhum tenant cadastrado ainda
            </div>
          ) : (
            <div className="space-y-3">
              {recentTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-medium">
                      {tenant.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{tenant.name}</p>
                      <p className="text-sm text-muted-foreground">{tenant.slug}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        tenant.status === "active"
                          ? "bg-green-500/10 text-green-500"
                          : tenant.status === "trial"
                          ? "bg-yellow-500/10 text-yellow-500"
                          : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {tenant.status}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tenant.plan}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
