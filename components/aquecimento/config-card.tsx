"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Play,
  Pause,
  Square,
  MoreVertical,
  Edit,
  Trash2,
  Clock,
  MessageSquare,
  Zap,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WarmingConfigInstance {
  id: string;
  instance_id: string;
  is_active: boolean;
  messages_sent_today: number;
  whatsapp_instances: {
    id: string;
    name: string;
    phone_number: string | null;
    color: string | null;
    status: string | null;
  };
}

interface WarmingSession {
  id: string;
  status: string;
  started_at: string;
  actions_executed: number;
  errors_count: number;
  next_action_at: string | null;
}

interface WarmingConfig {
  id: string;
  name: string;
  description: string | null;
  status: string;
  total_actions_executed: number;
  total_messages_sent: number;
  last_action_at: string | null;
  warming_config_instances: WarmingConfigInstance[];
  active_session: WarmingSession | null;
}

interface ConfigCardProps {
  config: WarmingConfig;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
}

export function ConfigCard({
  config,
  onEdit,
  onDelete,
  onStart,
  onStop,
  onPause,
}: ConfigCardProps) {
  const isRunning = config.active_session?.status === "running";
  const isPaused = config.active_session?.status === "paused";
  const hasSession = isRunning || isPaused;

  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    inactive: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    paused: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  };

  const statusLabels: Record<string, string> = {
    active: "Ativo",
    inactive: "Inativo",
    paused: "Pausado",
  };

  const connectedInstances = config.warming_config_instances?.filter(
    (ci) => ci.whatsapp_instances?.status === "connected"
  );

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-white truncate">{config.name}</h3>
              <Badge
                variant="outline"
                className={`text-xs ${statusColors[config.status]}`}
              >
                {statusLabels[config.status]}
              </Badge>
            </div>
            {config.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                {config.description}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Instances */}
        <div className="flex items-center gap-1 mt-3">
          {config.warming_config_instances?.slice(0, 4).map((ci) => (
            <div
              key={ci.id}
              className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium border"
              style={{
                backgroundColor: ci.whatsapp_instances?.color + "20" || "#22c55e20",
                borderColor: ci.whatsapp_instances?.color || "#22c55e",
                color: ci.whatsapp_instances?.color || "#22c55e",
              }}
              title={ci.whatsapp_instances?.name}
            >
              {ci.whatsapp_instances?.name?.charAt(0).toUpperCase()}
            </div>
          ))}
          {(config.warming_config_instances?.length || 0) > 4 && (
            <span className="text-xs text-muted-foreground ml-1">
              +{config.warming_config_instances.length - 4}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-2">
            {connectedInstances?.length || 0} conectada(s)
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="text-center p-2 rounded bg-surface-elevated">
            <p className="text-lg font-bold text-white">
              {config.total_actions_executed}
            </p>
            <p className="text-xs text-muted-foreground">Acoes</p>
          </div>
          <div className="text-center p-2 rounded bg-surface-elevated">
            <p className="text-lg font-bold text-white">
              {config.total_messages_sent}
            </p>
            <p className="text-xs text-muted-foreground">Mensagens</p>
          </div>
          <div className="text-center p-2 rounded bg-surface-elevated">
            <p className="text-lg font-bold text-white">
              {config.active_session?.errors_count || 0}
            </p>
            <p className="text-xs text-muted-foreground">Erros</p>
          </div>
        </div>

        {/* Session Info */}
        {hasSession && (
          <div className="mt-3 p-2 rounded bg-surface-elevated text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {config.active_session?.next_action_at ? (
                <span>
                  Proxima acao{" "}
                  {formatDistanceToNow(
                    new Date(config.active_session.next_action_at),
                    { addSuffix: true, locale: ptBR }
                  )}
                </span>
              ) : isPaused ? (
                <span>Sessao pausada</span>
              ) : (
                <span>Aguardando...</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <Zap className="h-3 w-3" />
              <span>
                {config.active_session?.actions_executed || 0} acoes nesta sessao
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          {!hasSession ? (
            <Button
              onClick={onStart}
              className="flex-1"
              disabled={(connectedInstances?.length || 0) < 2}
            >
              <Play className="h-4 w-4 mr-2" />
              Iniciar
            </Button>
          ) : (
            <>
              <Button
                onClick={onPause}
                variant="outline"
                className="flex-1"
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Retomar
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pausar
                  </>
                )}
              </Button>
              <Button
                onClick={onStop}
                variant="destructive"
                className="flex-1"
              >
                <Square className="h-4 w-4 mr-2" />
                Parar
              </Button>
            </>
          )}
        </div>

        {/* Warning if not enough instances */}
        {(connectedInstances?.length || 0) < 2 && (
          <div className="flex items-center gap-2 mt-3 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <p className="text-xs text-yellow-500">
              Conecte pelo menos 2 instancias para iniciar
            </p>
          </div>
        )}

        {/* Last activity */}
        {config.last_action_at && (
          <p className="text-xs text-muted-foreground mt-3">
            Ultima acao:{" "}
            {formatDistanceToNow(new Date(config.last_action_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
