"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import {
  Plus,
  Zap,
  Play,
  Pause,
  ChevronRight,
  Webhook,
  Clock,
} from "lucide-react";

interface Automation {
  id: string;
  name: string;
  status: string;
  trigger_type: string;
  total_executions: number;
  created_at: string;
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadAutomations = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      const { data } = await supabase
        .from("automations")
        .select("*")
        .eq("tenant_id", tenantUser.tenant_id)
        .order("created_at", { ascending: false });

      setAutomations(data || []);
      setLoading(false);
    };

    loadAutomations();
  }, [supabase]);

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case "webhook":
        return <Webhook className="h-4 w-4" />;
      case "schedule":
        return <Clock className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const getTriggerLabel = (type: string) => {
    const labels: Record<string, string> = {
      webhook: "Evento de webhook",
      schedule: "Agendamento",
      lead_created: "Lead criado",
      lead_status_changed: "Status alterado",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Automações</h1>
          <p className="text-muted-foreground">Automatize ações com base em eventos</p>
        </div>
        <Link href="/automations/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Automação
          </Button>
        </Link>
      </div>

      {/* Automations List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-surface-elevated rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : automations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Nenhuma automação</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie automações para executar ações automaticamente quando eventos ocorrem.
            </p>
            <Link href="/automations/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Criar Automação
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {automations.map((automation) => (
            <Link key={automation.id} href={`/automations/${automation.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white truncate">
                          {automation.name}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            automation.status === "active"
                              ? "bg-green-500/10 text-green-500"
                              : "bg-gray-500/10 text-gray-500"
                          }`}
                        >
                          {automation.status === "active" ? (
                            <Play className="h-3 w-3" />
                          ) : (
                            <Pause className="h-3 w-3" />
                          )}
                          {automation.status === "active" ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {getTriggerIcon(automation.trigger_type)}
                          {getTriggerLabel(automation.trigger_type)}
                        </span>
                        <span>{automation.total_executions} execuções</span>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(automation.created_at)}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
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
