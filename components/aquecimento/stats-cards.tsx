"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Zap,
  CheckCircle,
  AlertCircle,
  Bot,
  TrendingUp,
  Activity,
} from "lucide-react";

interface Stats {
  total_actions: number;
  successful_actions: number;
  failed_actions: number;
  ai_generated_count: number;
  ai_tokens_used: number;
  ai_cost_cents: number;
  active_configs: number;
  running_sessions: number;
  actions_by_type: Record<string, number>;
}

interface StatsCardsProps {
  period?: "today" | "week" | "month";
}

export function StatsCards({ period = "today" }: StatsCardsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/warming/stats?period=${period}`);
        if (response.ok) {
          const data = await response.json();
          setStats(data.data);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Refresh every minute
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [period]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-surface-elevated rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const successRate = stats?.total_actions
    ? Math.round((stats.successful_actions / stats.total_actions) * 100)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total de Acoes</p>
              <p className="text-2xl font-bold text-white">
                {stats?.total_actions || 0}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Activity className="h-3 w-3" />
            {stats?.running_sessions || 0} sessao(oes) ativa(s)
          </div>
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
              <p className="text-2xl font-bold text-white">{successRate}%</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="text-green-500">
              {stats?.successful_actions || 0} sucesso
            </span>
            <span className="text-red-500">
              {stats?.failed_actions || 0} falhas
            </span>
          </div>
        </CardContent>
      </Card>

      {/* AI Usage */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Mensagens com IA</p>
              <p className="text-2xl font-bold text-white">
                {stats?.ai_generated_count || 0}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-blue-500" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            {stats?.ai_cost_cents
              ? `R$ ${(stats.ai_cost_cents / 100).toFixed(2)} gasto com IA`
              : "Sem custo de IA"}
          </div>
        </CardContent>
      </Card>

      {/* Active Configs */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Configs Ativas</p>
              <p className="text-2xl font-bold text-white">
                {stats?.active_configs || 0}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            Aquecimento em execucao
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
