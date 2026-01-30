"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import {
  Loader2,
  Trash2,
  Pencil,
  Play,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";

interface WebhookForward {
  id: string;
  name: string;
  target_url: string;
  events: string[] | null;
  is_active: boolean;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  whatsapp_instances: {
    id: string;
    name: string;
    instance_name: string;
  } | null;
}

interface WebhookForwardCardProps {
  forward: WebhookForward;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  testing?: boolean;
}

export function WebhookForwardCard({
  forward,
  onEdit,
  onDelete,
  onTest,
  testing,
}: WebhookForwardCardProps) {
  const getLastStatus = () => {
    if (!forward.last_success_at && !forward.last_error_at) {
      return { type: "none", text: "Nunca executado" };
    }

    const lastSuccess = forward.last_success_at ? new Date(forward.last_success_at) : null;
    const lastError = forward.last_error_at ? new Date(forward.last_error_at) : null;

    if (lastSuccess && (!lastError || lastSuccess > lastError)) {
      return {
        type: "success",
        text: `Sucesso ${formatRelativeTime(forward.last_success_at!)}`,
      };
    }

    return {
      type: "error",
      text: `Erro ${formatRelativeTime(forward.last_error_at!)}`,
      message: forward.last_error_message,
    };
  };

  const lastStatus = getLastStatus();

  return (
    <div className="p-4 rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-white truncate">{forward.name}</h4>
            <Badge variant={forward.is_active ? "success" : "secondary"}>
              {forward.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </div>

          {forward.whatsapp_instances && (
            <p className="text-sm text-muted-foreground mb-1">
              Instancia: {forward.whatsapp_instances.name}
            </p>
          )}

          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
            <span className="truncate max-w-[300px]">{forward.target_url}</span>
            <a
              href={forward.target_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {forward.events && forward.events.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {forward.events.map((event) => (
                <Badge key={event} variant="outline" className="text-xs">
                  {event}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            {lastStatus.type === "success" && (
              <span className="flex items-center gap-1 text-green-500">
                <CheckCircle className="h-3 w-3" />
                {lastStatus.text}
              </span>
            )}
            {lastStatus.type === "error" && (
              <span
                className="flex items-center gap-1 text-red-500"
                title={lastStatus.message || undefined}
              >
                <XCircle className="h-3 w-3" />
                {lastStatus.text}
              </span>
            )}
            {lastStatus.type === "none" && (
              <span className="text-muted-foreground">{lastStatus.text}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 ml-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onTest}
            disabled={testing}
            title="Testar webhook"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} title="Excluir">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
