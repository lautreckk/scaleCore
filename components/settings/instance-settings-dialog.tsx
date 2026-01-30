"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Webhook, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface InstanceSettings {
  rejectCall: boolean;
  msgCall: string;
  groupsIgnore: boolean;
  alwaysOnline: boolean;
  readMessages: boolean;
  syncFullHistory: boolean;
  readStatus: boolean;
}

interface WebhookInfo {
  enabled?: boolean;
  url?: string;
  webhookByEvents?: boolean;
  webhookBase64?: boolean;
  events?: string[];
}

interface InstanceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceName: string;
  onSuccess?: () => void;
}

export function InstanceSettingsDialog({
  open,
  onOpenChange,
  instanceName,
  onSuccess,
}: InstanceSettingsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<InstanceSettings>({
    rejectCall: false,
    msgCall: "",
    groupsIgnore: false,
    alwaysOnline: false,
    readMessages: false,
    syncFullHistory: false,
    readStatus: false,
  });

  // Webhook state
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [loadingWebhook, setLoadingWebhook] = useState(false);
  const [configuringWebhook, setConfiguringWebhook] = useState(false);

  useEffect(() => {
    if (open && instanceName) {
      loadSettings();
      loadWebhook();
    }
  }, [open, instanceName]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/whatsapp/instances/${instanceName}/settings`
      );
      const data = await response.json();

      if (data.success && data.settings) {
        setSettings({
          rejectCall: data.settings.rejectCall ?? false,
          msgCall: data.settings.msgCall ?? "",
          groupsIgnore: data.settings.groupsIgnore ?? false,
          alwaysOnline: data.settings.alwaysOnline ?? false,
          readMessages: data.settings.readMessages ?? false,
          syncFullHistory: data.settings.syncFullHistory ?? false,
          readStatus: data.settings.readStatus ?? false,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Erro ao carregar configuracoes");
    } finally {
      setLoading(false);
    }
  };

  const loadWebhook = async () => {
    setLoadingWebhook(true);
    try {
      const response = await fetch(
        `/api/whatsapp/instances/${instanceName}/webhook`
      );
      const data = await response.json();

      if (data.success && data.webhook) {
        setWebhookInfo(data.webhook);
      } else {
        setWebhookInfo(null);
      }
    } catch (error) {
      console.error("Error loading webhook:", error);
    } finally {
      setLoadingWebhook(false);
    }
  };

  const configureWebhook = async () => {
    setConfiguringWebhook(true);
    try {
      const response = await fetch(
        `/api/whatsapp/instances/${instanceName}/webhook`,
        { method: "POST" }
      );
      const data = await response.json();

      if (data.success) {
        toast.success("Webhook configurado com sucesso!");
        loadWebhook();
      } else {
        throw new Error(data.error || "Erro ao configurar webhook");
      }
    } catch (error) {
      console.error("Error configuring webhook:", error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao configurar webhook"
      );
    } finally {
      setConfiguringWebhook(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/whatsapp/instances/${instanceName}/settings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao salvar configuracoes");
      }

      toast.success("Configuracoes salvas com sucesso!");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar configuracoes"
      );
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof InstanceSettings>(
    key: K,
    value: InstanceSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const expectedWebhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/evolution`
    : "";

  const isWebhookConfigured = webhookInfo?.enabled &&
    webhookInfo?.url &&
    webhookInfo.url.includes("/api/webhooks/evolution");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuracoes da Instancia</DialogTitle>
          <DialogDescription>
            Configure o comportamento da sua instancia WhatsApp
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="webhook" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="webhook" className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Webhook
            </TabsTrigger>
            <TabsTrigger value="settings">Comportamento</TabsTrigger>
          </TabsList>

          {/* Webhook Tab */}
          <TabsContent value="webhook" className="space-y-4 mt-4">
            {loadingWebhook ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Status do Webhook */}
                <div className="p-4 rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-3">
                    {isWebhookConfigured ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    <span className="font-medium">
                      {isWebhookConfigured
                        ? "Webhook Configurado"
                        : "Webhook Nao Configurado"}
                    </span>
                  </div>

                  {webhookInfo?.url ? (
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">URL atual:</span>
                        <p className="font-mono text-xs break-all bg-muted/50 p-2 rounded mt-1">
                          {webhookInfo.url}
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-muted-foreground">
                          Ativo: {webhookInfo.enabled ? "Sim" : "Nao"}
                        </span>
                        <span className="text-muted-foreground">
                          Base64: {webhookInfo.webhookBase64 ? "Sim" : "Nao"}
                        </span>
                      </div>
                      {webhookInfo.events && webhookInfo.events.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Eventos:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {webhookInfo.events.map((event) => (
                              <span
                                key={event}
                                className="text-xs bg-muted px-2 py-0.5 rounded"
                              >
                                {event}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      O webhook nao esta configurado. Configure para receber mensagens no sistema.
                    </p>
                  )}
                </div>

                {/* URL esperada */}
                <div className="space-y-2">
                  <Label>URL do Webhook (Sistema)</Label>
                  <p className="font-mono text-xs break-all bg-muted/50 p-2 rounded">
                    {expectedWebhookUrl}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Esta e a URL que sera configurada no Evolution API
                  </p>
                </div>

                {/* Botao de configurar */}
                <Button
                  onClick={configureWebhook}
                  disabled={configuringWebhook}
                  className="w-full"
                >
                  {configuringWebhook ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {isWebhookConfigured ? "Reconfigurar Webhook" : "Configurar Webhook"}
                </Button>

                {!isWebhookConfigured && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm text-yellow-500">
                      O webhook precisa estar configurado para que as mensagens do WhatsApp
                      aparecam no sistema de chat.
                    </p>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Always Online */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="alwaysOnline">Sempre Online</Label>
                    <p className="text-xs text-muted-foreground">
                      Manter o status como online o tempo todo
                    </p>
                  </div>
                  <Switch
                    id="alwaysOnline"
                    checked={settings.alwaysOnline}
                    onCheckedChange={(checked) =>
                      updateSetting("alwaysOnline", checked)
                    }
                  />
                </div>

                {/* Read Messages */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="readMessages">Marcar como Lido</Label>
                    <p className="text-xs text-muted-foreground">
                      Marcar mensagens recebidas como lidas automaticamente
                    </p>
                  </div>
                  <Switch
                    id="readMessages"
                    checked={settings.readMessages}
                    onCheckedChange={(checked) =>
                      updateSetting("readMessages", checked)
                    }
                  />
                </div>

                {/* Read Status */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="readStatus">Visualizar Status</Label>
                    <p className="text-xs text-muted-foreground">
                      Marcar status como visualizados automaticamente
                    </p>
                  </div>
                  <Switch
                    id="readStatus"
                    checked={settings.readStatus}
                    onCheckedChange={(checked) =>
                      updateSetting("readStatus", checked)
                    }
                  />
                </div>

                {/* Groups Ignore */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="groupsIgnore">Ignorar Grupos</Label>
                    <p className="text-xs text-muted-foreground">
                      Nao receber mensagens de grupos
                    </p>
                  </div>
                  <Switch
                    id="groupsIgnore"
                    checked={settings.groupsIgnore}
                    onCheckedChange={(checked) =>
                      updateSetting("groupsIgnore", checked)
                    }
                  />
                </div>

                {/* Sync Full History */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="syncFullHistory">Sincronizar Historico</Label>
                    <p className="text-xs text-muted-foreground">
                      Sincronizar historico completo de mensagens
                    </p>
                  </div>
                  <Switch
                    id="syncFullHistory"
                    checked={settings.syncFullHistory}
                    onCheckedChange={(checked) =>
                      updateSetting("syncFullHistory", checked)
                    }
                  />
                </div>

                {/* Reject Calls */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="rejectCall">Rejeitar Chamadas</Label>
                    <p className="text-xs text-muted-foreground">
                      Rejeitar chamadas de voz/video automaticamente
                    </p>
                  </div>
                  <Switch
                    id="rejectCall"
                    checked={settings.rejectCall}
                    onCheckedChange={(checked) =>
                      updateSetting("rejectCall", checked)
                    }
                  />
                </div>

                {/* Message when rejecting calls */}
                {settings.rejectCall && (
                  <div className="space-y-2 pl-4 border-l-2 border-muted">
                    <Label htmlFor="msgCall">Mensagem ao Rejeitar</Label>
                    <Input
                      id="msgCall"
                      placeholder="Ex: Nao aceito chamadas, envie uma mensagem"
                      value={settings.msgCall}
                      onChange={(e) => updateSetting("msgCall", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Mensagem enviada automaticamente ao rejeitar uma chamada
                    </p>
                  </div>
                )}

                <Button onClick={handleSave} disabled={loading || saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Configuracoes
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
