"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  Plus,
  Megaphone,
  Play,
  Pause,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  message_template: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  scheduled_at: string | null;
  created_at: string;
  instance: {
    name: string;
    color: string;
  } | null;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadCampaigns = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      const { data } = await supabase
        .from("campaigns")
        .select(`
          id,
          name,
          status,
          message_template,
          total_recipients,
          sent_count,
          delivered_count,
          read_count,
          failed_count,
          scheduled_at,
          created_at,
          instance:whatsapp_instances(name, color)
        `)
        .eq("tenant_id", tenantUser.tenant_id)
        .order("created_at", { ascending: false });

      setCampaigns((data as unknown as Campaign[]) || []);
      setLoading(false);
    };

    loadCampaigns();
  }, [supabase]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft":
        return <Clock className="h-4 w-4 text-gray-500" />;
      case "scheduled":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "running":
        return <Play className="h-4 w-4 text-blue-500" />;
      case "paused":
        return <Pause className="h-4 w-4 text-orange-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "Rascunho",
      scheduled: "Agendada",
      running: "Em execução",
      paused: "Pausada",
      completed: "Concluída",
      failed: "Falhou",
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Campanhas</h1>
          <p className="text-muted-foreground">Envie mensagens em massa para seus leads</p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Campanha
          </Button>
        </Link>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-20 bg-surface-elevated rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Nenhuma campanha</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie sua primeira campanha para enviar mensagens em massa.
            </p>
            <Link href="/campaigns/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Criar Campanha
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Megaphone className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white truncate">{campaign.name}</h3>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {getStatusIcon(campaign.status || "draft")}
                          {getStatusLabel(campaign.status || "draft")}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{campaign.total_recipients} destinatários</span>
                        {campaign.status !== "draft" && (
                          <>
                            <span className="text-green-500">{campaign.sent_count} enviadas</span>
                            <span className="text-blue-500">{campaign.delivered_count} entregues</span>
                            <span className="text-primary">{campaign.read_count} lidas</span>
                          </>
                        )}
                      </div>
                      {campaign.status !== "draft" && campaign.total_recipients > 0 && (
                        <div className="mt-2 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{
                              width: `${(campaign.sent_count / campaign.total_recipients) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-right hidden sm:block">
                      {campaign.instance && (
                        <span
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                          style={{ backgroundColor: `${campaign.instance.color}20` }}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: campaign.instance.color }}
                          />
                          {campaign.instance.name}
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(campaign.created_at)}
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
