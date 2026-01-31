"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Mic,
  Image,
  FileText,
  Video,
  Circle,
  Eye,
  Heart,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActionLog {
  id: string;
  action_type: string;
  content: string | null;
  status: string;
  error_message: string | null;
  ai_generated: boolean;
  executed_at: string;
  from_instance: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  to_instance: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  warming_configs: {
    id: string;
    name: string;
  } | null;
}

interface ActivityLogProps {
  configId?: string;
  limit?: number;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  text_message: <MessageSquare className="h-4 w-4" />,
  audio_message: <Mic className="h-4 w-4" />,
  image_message: <Image className="h-4 w-4" />,
  document_message: <FileText className="h-4 w-4" />,
  video_message: <Video className="h-4 w-4" />,
  status_post: <Circle className="h-4 w-4" />,
  status_view: <Eye className="h-4 w-4" />,
  reaction: <Heart className="h-4 w-4" />,
};

const ACTION_LABELS: Record<string, string> = {
  text_message: "Mensagem de texto",
  audio_message: "Audio",
  image_message: "Imagem",
  document_message: "Documento",
  video_message: "Video",
  status_post: "Status postado",
  status_view: "Status visualizado",
  reaction: "Reacao",
};

export function ActivityLog({ configId, limit = 20 }: ActivityLogProps) {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const params = new URLSearchParams({ limit: limit.toString() });
        if (configId) params.append("config_id", configId);

        const response = await fetch(`/api/warming/logs?${params}`);
        if (response.ok) {
          const data = await response.json();
          setLogs(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();

    // Refresh every 30 seconds
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [configId, limit]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-surface-elevated" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-surface-elevated rounded w-3/4" />
                  <div className="h-2 bg-surface-elevated rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma atividade ainda
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              As acoes de aquecimento aparecerao aqui
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Atividade Recente</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-elevated transition-colors"
              >
                {/* Action Icon */}
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    log.status === "success"
                      ? "bg-green-500/10 text-green-500"
                      : log.status === "failed"
                      ? "bg-red-500/10 text-red-500"
                      : "bg-yellow-500/10 text-yellow-500"
                  }`}
                >
                  {ACTION_ICONS[log.action_type] || (
                    <MessageSquare className="h-4 w-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {ACTION_LABELS[log.action_type] || log.action_type}
                    </span>
                    {log.ai_generated && (
                      <Badge variant="secondary" className="text-xs">
                        IA
                      </Badge>
                    )}
                    {log.status === "success" ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : log.status === "failed" ? (
                      <AlertCircle className="h-3 w-3 text-red-500" />
                    ) : null}
                  </div>

                  {/* From/To */}
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                    {log.from_instance && (
                      <>
                        <span
                          className="font-medium"
                          style={{ color: log.from_instance.color || "#22c55e" }}
                        >
                          {log.from_instance.name}
                        </span>
                        {log.to_instance && (
                          <>
                            <span>→</span>
                            <span
                              className="font-medium"
                              style={{ color: log.to_instance.color || "#22c55e" }}
                            >
                              {log.to_instance.name}
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* Content preview */}
                  {log.content && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {log.content}
                    </p>
                  )}

                  {/* Error message */}
                  {log.error_message && (
                    <p className="text-xs text-red-500 mt-1">
                      {log.error_message}
                    </p>
                  )}

                  {/* Time */}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(log.executed_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
