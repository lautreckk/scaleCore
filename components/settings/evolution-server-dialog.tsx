"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface EvolutionServer {
  id: string;
  name: string;
  url: string;
  api_key_masked: string;
  is_active: boolean;
}

interface EvolutionServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server?: EvolutionServer | null;
  onSuccess: () => void;
}

export function EvolutionServerDialog({
  open,
  onOpenChange,
  server,
  onSuccess,
}: EvolutionServerDialogProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditing = !!server;

  useEffect(() => {
    if (open) {
      if (server) {
        setName(server.name);
        setUrl(server.url);
        setApiKey("");
      } else {
        setName("");
        setUrl("");
        setApiKey("");
      }
      setShowApiKey(false);
    }
  }, [open, server]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nome e obrigatorio");
      return;
    }

    if (!url.trim()) {
      toast.error("URL e obrigatoria");
      return;
    }

    if (!isEditing && !apiKey.trim()) {
      toast.error("API Key e obrigatoria");
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      toast.error("URL invalida");
      return;
    }

    setSaving(true);

    try {
      const endpoint = isEditing
        ? `/api/settings/integrations/evolution/${server.id}`
        : "/api/settings/integrations/evolution";

      const method = isEditing ? "PUT" : "POST";

      const body: Record<string, string> = { name, url };
      if (apiKey) {
        body.apiKey = apiKey;
      }

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao salvar servidor");
      }

      toast.success(isEditing ? "Servidor atualizado!" : "Servidor adicionado!");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar servidor"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Servidor" : "Adicionar Servidor Evolution API"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informacoes do servidor Evolution API"
              : "Configure um novo servidor Evolution API para criar instancias WhatsApp"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Servidor</Label>
            <Input
              id="name"
              placeholder="Ex: Servidor Principal"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Um nome para identificar este servidor
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL da API</Label>
            <Input
              id="url"
              placeholder="https://evolution-api.exemplo.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              URL completa do servidor Evolution API
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">
              API Key
              {isEditing && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  (deixe em branco para manter a atual)
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                placeholder={isEditing ? "••••••••" : "Sua API Key"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Chave de autenticacao do Evolution API
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
