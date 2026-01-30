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
import { Loader2 } from "lucide-react";
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

  useEffect(() => {
    if (open && instanceName) {
      loadSettings();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configuracoes da Instancia</DialogTitle>
          <DialogDescription>
            Configure o comportamento da sua instancia WhatsApp
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
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
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
