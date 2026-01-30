"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Server,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface EvolutionServerCardProps {
  server: {
    id: string;
    name: string;
    url: string;
    api_key_masked: string;
    is_active: boolean;
    instance_count: number;
  };
  onEdit: () => void;
  onDelete: () => void;
}

export function EvolutionServerCard({
  server,
  onEdit,
  onDelete,
}: EvolutionServerCardProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(
        `/api/settings/integrations/evolution/${server.id}/test`,
        { method: "POST" }
      );

      const data = await response.json();

      if (data.success) {
        setTestResult("success");
        toast.success("Conexao bem-sucedida!");
      } else {
        setTestResult("error");
        toast.error(data.error || "Falha na conexao");
      }
    } catch {
      setTestResult("error");
      toast.error("Erro ao testar conexao");
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = () => {
    if (server.instance_count > 0) {
      toast.error(
        `Nao e possivel excluir. Este servidor possui ${server.instance_count} instancia(s) conectada(s).`
      );
      return;
    }

    if (!confirm("Tem certeza que deseja excluir este servidor?")) return;
    onDelete();
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Server className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-white">{server.name}</p>
            {!server.is_active && (
              <Badge variant="secondary">Inativo</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{server.url}</p>
          <p className="text-xs text-muted-foreground">
            API Key: {server.api_key_masked}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right mr-4">
          <p className="text-sm text-muted-foreground">
            {server.instance_count} instancia(s)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testConnection}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : testResult === "success" ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : testResult === "error" ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              "Testar"
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={server.instance_count > 0}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
