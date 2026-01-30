"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface WhatsAppInstance {
  id: string;
  name: string;
  instance_name: string;
}

interface WebhookForward {
  id: string;
  name: string;
  target_url: string;
  headers: Record<string, string> | null;
  events: string[] | null;
  is_active: boolean;
  instance_id: string;
  whatsapp_instances: WhatsAppInstance | null;
}

interface WebhookForwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forward: WebhookForward | null;
  instances: WhatsAppInstance[];
  onSuccess: () => void;
}

const AVAILABLE_EVENTS = [
  { value: "MESSAGES_UPSERT", label: "Mensagens recebidas/enviadas" },
  { value: "MESSAGES_UPDATE", label: "Status de mensagens" },
  { value: "CONNECTION_UPDATE", label: "Status de conexao" },
  { value: "QRCODE_UPDATED", label: "QR Code atualizado" },
  { value: "SEND_MESSAGE", label: "Mensagem enviada" },
];

export function WebhookForwardDialog({
  open,
  onOpenChange,
  forward,
  instances,
  onSuccess,
}: WebhookForwardDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
  ]);
  const [headerKey, setHeaderKey] = useState("");
  const [headerValue, setHeaderValue] = useState("");
  const [headers, setHeaders] = useState<Record<string, string>>({});

  const isEditing = !!forward;

  useEffect(() => {
    if (forward) {
      setName(forward.name);
      setTargetUrl(forward.target_url);
      setInstanceId(forward.instance_id);
      setIsActive(forward.is_active);
      setSelectedEvents(forward.events || ["MESSAGES_UPSERT", "MESSAGES_UPDATE"]);
      setHeaders(forward.headers || {});
    } else {
      setName("");
      setTargetUrl("");
      setInstanceId(instances[0]?.id || "");
      setIsActive(true);
      setSelectedEvents(["MESSAGES_UPSERT", "MESSAGES_UPDATE"]);
      setHeaders({});
    }
    setHeaderKey("");
    setHeaderValue("");
  }, [forward, instances, open]);

  const handleEventToggle = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  };

  const addHeader = () => {
    if (headerKey.trim() && headerValue.trim()) {
      setHeaders((prev) => ({ ...prev, [headerKey.trim()]: headerValue.trim() }));
      setHeaderKey("");
      setHeaderValue("");
    }
  };

  const removeHeader = (key: string) => {
    setHeaders((prev) => {
      const newHeaders = { ...prev };
      delete newHeaders[key];
      return newHeaders;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome e obrigatorio");
      return;
    }
    if (!targetUrl.trim()) {
      toast.error("URL de destino e obrigatoria");
      return;
    }
    if (!instanceId) {
      toast.error("Selecione uma instancia");
      return;
    }
    if (selectedEvents.length === 0) {
      toast.error("Selecione pelo menos um evento");
      return;
    }

    try {
      new URL(targetUrl);
    } catch {
      toast.error("URL invalida");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        target_url: targetUrl.trim(),
        instance_id: instanceId,
        is_active: isActive,
        events: selectedEvents,
        headers: Object.keys(headers).length > 0 ? headers : null,
      };

      const response = await fetch(
        isEditing ? `/api/webhook-forwards/${forward.id}` : "/api/webhook-forwards",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Falha ao salvar");
      }

      toast.success(isEditing ? "Webhook atualizado!" : "Webhook criado!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Webhook Forward" : "Novo Webhook Forward"}
          </DialogTitle>
          <DialogDescription>
            Configure para onde os eventos do WhatsApp serao encaminhados
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              placeholder="Ex: n8n Automacao"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instance">Instancia WhatsApp</Label>
            <Select value={instanceId} onValueChange={setInstanceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instancia" />
              </SelectTrigger>
              <SelectContent>
                {instances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetUrl">URL de Destino</Label>
            <Input
              id="targetUrl"
              type="url"
              placeholder="https://n8n.exemplo.com/webhook/xxx"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              URL que recebera os eventos (POST com JSON)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Eventos</Label>
            <div className="space-y-2">
              {AVAILABLE_EVENTS.map((event) => (
                <div key={event.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={event.value}
                    checked={selectedEvents.includes(event.value)}
                    onCheckedChange={() => handleEventToggle(event.value)}
                  />
                  <label
                    htmlFor={event.value}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {event.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Headers Personalizados (opcional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nome do header"
                value={headerKey}
                onChange={(e) => setHeaderKey(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Valor"
                value={headerValue}
                onChange={(e) => setHeaderValue(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addHeader}
                disabled={!headerKey.trim() || !headerValue.trim()}
              >
                +
              </Button>
            </div>
            {Object.entries(headers).length > 0 && (
              <div className="space-y-1 mt-2">
                {Object.entries(headers).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between text-sm bg-muted/50 px-2 py-1 rounded"
                  >
                    <span>
                      <span className="font-medium">{key}:</span> {value}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => removeHeader(key)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="isActive">Ativo</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
