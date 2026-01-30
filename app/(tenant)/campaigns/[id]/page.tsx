"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Play,
  Pause,
  Trash2,
  Users,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
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
  estimated_cost: number;
  actual_cost: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  settings: Record<string, unknown>;
  whatsapp_instances: {
    instance_name: string;
    status: string;
  } | null;
}

interface CampaignSend {
  id: string;
  phone: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  leads: {
    name: string;
  } | null;
}

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sends, setSends] = useState<CampaignSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadCampaign();
    loadSends();

    // Real-time updates
    const channel = supabase
      .channel(`campaign-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_sends",
          filter: `campaign_id=eq.${id}`,
        },
        () => {
          loadCampaign();
          loadSends();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const loadCampaign = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) return;

    const { data, error } = await supabase
      .from("campaigns")
      .select(`
        *,
        whatsapp_instances(instance_name, status)
      `)
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !data) {
      toast.error("Campanha não encontrada");
      router.push("/campaigns");
      return;
    }

    setCampaign(data as unknown as Campaign);
    setLoading(false);
  };

  const loadSends = async () => {
    const { data } = await supabase
      .from("campaign_sends")
      .select(`
        id,
        phone,
        status,
        sent_at,
        delivered_at,
        read_at,
        error_message,
        leads(name)
      `)
      .eq("campaign_id", id)
      .order("created_at", { ascending: true })
      .limit(100);

    setSends((data as unknown as CampaignSend[]) || []);
  };

  const startCampaign = async () => {
    if (!campaign) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${id}/start`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start campaign");
      }

      toast.success("Campanha iniciada!");
      loadCampaign();
    } catch (error) {
      console.error("Error starting campaign:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar campanha");
    } finally {
      setActionLoading(false);
    }
  };

  const pauseCampaign = async () => {
    if (!campaign) return;

    setActionLoading(true);
    try {
      await supabase
        .from("campaigns")
        .update({ status: "paused" })
        .eq("id", campaign.id);

      toast.success("Campanha pausada");
      loadCampaign();
    } catch (error) {
      toast.error("Erro ao pausar campanha");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteCampaign = async () => {
    if (!campaign || !confirm("Tem certeza que deseja excluir esta campanha?")) return;

    setActionLoading(true);
    try {
      await supabase.from("campaign_sends").delete().eq("campaign_id", campaign.id);
      await supabase.from("campaigns").delete().eq("id", campaign.id);

      toast.success("Campanha excluída");
      router.push("/campaigns");
    } catch (error) {
      toast.error("Erro ao excluir campanha");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "success" | "destructive" | "warning"> = {
      draft: "secondary",
      scheduled: "warning",
      running: "default",
      paused: "warning",
      completed: "success",
      failed: "destructive",
    };

    const labels: Record<string, string> = {
      draft: "Rascunho",
      scheduled: "Agendada",
      running: "Em execução",
      paused: "Pausada",
      completed: "Concluída",
      failed: "Falhou",
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getSendStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <Send className="h-4 w-4 text-blue-500" />;
      case "delivered":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "read":
        return <Eye className="h-4 w-4 text-primary" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  const progress = campaign.total_recipients > 0
    ? (campaign.sent_count / campaign.total_recipients) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
              {getStatusBadge(campaign.status)}
            </div>
            <p className="text-muted-foreground">
              Criada em {formatDate(campaign.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === "draft" && (
            <Button onClick={startCampaign} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Iniciar
            </Button>
          )}
          {campaign.status === "running" && (
            <Button variant="outline" onClick={pauseCampaign} disabled={actionLoading}>
              <Pause className="h-4 w-4 mr-2" />
              Pausar
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button onClick={startCampaign} disabled={actionLoading}>
              <Play className="h-4 w-4 mr-2" />
              Continuar
            </Button>
          )}
          {["draft", "completed", "failed"].includes(campaign.status) && (
            <Button
              variant="ghost"
              onClick={deleteCampaign}
              disabled={actionLoading}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Destinatários</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">
              {campaign.total_recipients}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Enviadas</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">
              {campaign.sent_count}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Entregues</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">
              {campaign.delivered_count}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Lidas</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">
              {campaign.read_count}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      {campaign.status !== "draft" && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Progresso</span>
              <span className="text-sm font-medium text-white">
                {progress.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            {campaign.failed_count > 0 && (
              <p className="text-sm text-red-500 mt-2">
                {campaign.failed_count} mensagens falharam
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Message Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Mensagem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-white whitespace-pre-wrap">
                {campaign.message_template}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cost Info */}
        <Card>
          <CardHeader>
            <CardTitle>Custos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Custo estimado</span>
              <span className="text-white font-medium">
                {formatCurrency(campaign.estimated_cost || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Custo real</span>
              <span className="text-white font-medium">
                {formatCurrency(campaign.actual_cost || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Custo por mensagem</span>
              <span className="text-white font-medium">R$ 0,12</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recipients List */}
      <Card>
        <CardHeader>
          <CardTitle>Destinatários</CardTitle>
        </CardHeader>
        <CardContent>
          {sends.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum destinatário adicionado
            </p>
          ) : (
            <div className="space-y-2">
              {sends.map((send) => (
                <div
                  key={send.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    {getSendStatusIcon(send.status)}
                    <div>
                      <p className="text-white">
                        {send.leads?.name || send.phone}
                      </p>
                      {send.leads?.name && (
                        <p className="text-sm text-muted-foreground">
                          {send.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        send.status === "failed"
                          ? "destructive"
                          : send.status === "read"
                          ? "success"
                          : "secondary"
                      }
                    >
                      {send.status === "pending" && "Pendente"}
                      {send.status === "sent" && "Enviada"}
                      {send.status === "delivered" && "Entregue"}
                      {send.status === "read" && "Lida"}
                      {send.status === "failed" && "Falhou"}
                    </Badge>
                    {send.error_message && (
                      <p className="text-xs text-red-500 mt-1">
                        {send.error_message}
                      </p>
                    )}
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
