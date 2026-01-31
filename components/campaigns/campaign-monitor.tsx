"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Send,
  Check,
  CheckCheck,
  Eye,
  X,
  Pause,
  Play,
  Clock,
  AlertCircle,
  Users,
  TrendingUp,
  Loader2,
} from "lucide-react";

interface CampaignProgress {
  id: string;
  name: string;
  status: string;
  modal_job_id: string | null;
  modal_job_status: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  estimated_cost: number;
  actual_cost: number;
  delay_between_recipients: number;
  started_at: string | null;
  completed_at: string | null;
  error_log: string[] | null;
  progress_percent: number;
  processed_count: number;
  pending_count: number;
  estimated_time_remaining: number | null;
}

interface ActivityItem {
  id: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  lead_name: string | null;
  lead_phone: string | null;
}

interface CampaignMonitorProps {
  campaignId: string;
}

export function CampaignMonitor({ campaignId }: CampaignMonitorProps) {
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const supabase = createClient();

  // Fetch progress
  const fetchProgress = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/progress`);
      if (response.ok) {
        const data = await response.json();
        setProgress(data.campaign);
        setActivity(data.recent_activity || []);
      }
    } catch (error) {
      console.error("Error fetching progress:", error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchProgress();

    // Poll for updates when campaign is running
    const interval = setInterval(() => {
      if (progress?.status === "running") {
        fetchProgress();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [campaignId, progress?.status]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaigns",
          filter: `id=eq.${campaignId}`,
        },
        () => {
          fetchProgress();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaign_sends",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          fetchProgress();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, supabase]);

  const handlePause = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/pause`, {
        method: "POST",
      });
      if (response.ok) {
        fetchProgress();
      }
    } catch (error) {
      console.error("Error pausing campaign:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: "POST",
      });
      if (response.ok) {
        fetchProgress();
      }
    } catch (error) {
      console.error("Error resuming campaign:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`;
  };

  const formatTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <Check className="h-4 w-4 text-green-500" />;
      case "delivered":
        return <CheckCheck className="h-4 w-4 text-blue-500" />;
      case "read":
        return <Eye className="h-4 w-4 text-blue-600" />;
      case "failed":
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      running: "default",
      completed: "secondary",
      paused: "outline",
      failed: "destructive",
      draft: "outline",
    };

    return (
      <Badge variant={variants[status] || "outline"} className="capitalize">
        {status === "running" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Campanha não encontrada
      </div>
    );
  }

  const total = progress.total_recipients || 0;
  const sent = progress.sent_count || 0;
  const delivered = progress.delivered_count || 0;
  const read = progress.read_count || 0;
  const failed = progress.failed_count || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{progress.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            {getStatusBadge(progress.status)}
            {progress.modal_job_status && progress.modal_job_status !== progress.status && (
              <Badge variant="outline" className="text-xs">
                Worker: {progress.modal_job_status}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {progress.status === "running" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={actionLoading}>
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Pause className="h-4 w-4 mr-2" />
                  )}
                  Pausar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Pausar campanha?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A campanha será pausada após o envio da mensagem atual.
                    Você pode continuar a qualquer momento.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handlePause}>Pausar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {progress.status === "paused" && (
            <Button onClick={handleResume} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Continuar
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progresso</span>
              <span className="font-medium">
                {progress.processed_count} / {total} ({progress.progress_percent}%)
              </span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progress.progress_percent}%` }}
              />
            </div>
            {progress.estimated_time_remaining !== null && progress.status === "running" && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Tempo estimado: {formatTime(progress.estimated_time_remaining)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Send className="h-4 w-4 text-green-500" />
              Enviadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{sent}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCheck className="h-4 w-4 text-blue-500" />
              Entregues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{delivered}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Eye className="h-4 w-4 text-blue-600" />
              Lidas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{read}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <X className="h-4 w-4 text-red-500" />
              Falhas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Custo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Estimado</div>
              <div className="text-lg font-medium">
                R$ {(progress.estimated_cost || 0).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Atual</div>
              <div className="text-lg font-medium">
                R$ {(sent * 0.12).toFixed(2)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Atividade recente</CardTitle>
          <CardDescription>Últimos envios</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {activity.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Nenhuma atividade ainda
              </div>
            ) : (
              <div className="space-y-2">
                {activity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                  >
                    {getStatusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {item.lead_name || item.lead_phone || "Desconhecido"}
                      </div>
                      {item.error_message && (
                        <div className="text-xs text-red-500 truncate">
                          {item.error_message}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTimestamp(item.sent_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Error Log */}
      {progress.error_log && progress.error_log.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              Log de erros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2 font-mono text-xs">
                {progress.error_log.map((error, i) => (
                  <div key={i} className="p-2 bg-red-50 dark:bg-red-950/30 rounded">
                    {error}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
