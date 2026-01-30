"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface NotificationSettings {
  new_lead: boolean;
  new_message: boolean;
  campaign_completed: boolean;
  low_balance: boolean;
  daily_summary: boolean;
}

const defaultSettings: NotificationSettings = {
  new_lead: true,
  new_message: true,
  campaign_completed: true,
  low_balance: true,
  daily_summary: false,
};

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("settings")
      .eq("user_id", user.id)
      .single();

    if (tenantUser?.settings?.notifications) {
      setSettings({
        ...defaultSettings,
        ...(tenantUser.settings.notifications as NotificationSettings),
      });
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    if (!userId) return;

    setSaving(true);
    try {
      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("settings")
        .eq("user_id", userId)
        .single();

      const currentSettings = tenantUser?.settings || {};

      const { error } = await supabase
        .from("tenant_users")
        .update({
          settings: {
            ...currentSettings,
            notifications: settings,
          },
        })
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("Notificações atualizadas!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (key: keyof NotificationSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const notificationOptions = [
    {
      key: "new_lead" as const,
      label: "Novo Lead",
      description: "Receba notificações quando um novo lead for capturado",
    },
    {
      key: "new_message" as const,
      label: "Nova Mensagem",
      description: "Receba notificações de novas mensagens no WhatsApp",
    },
    {
      key: "campaign_completed" as const,
      label: "Campanha Finalizada",
      description: "Receba notificações quando uma campanha for concluída",
    },
    {
      key: "low_balance" as const,
      label: "Saldo Baixo",
      description: "Receba alertas quando seu saldo estiver baixo",
    },
    {
      key: "daily_summary" as const,
      label: "Resumo Diário",
      description: "Receba um resumo diário das suas métricas",
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notificações</CardTitle>
          <CardDescription>
            Configure quais notificações você deseja receber
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {notificationOptions.map((option) => (
            <div
              key={option.key}
              className="flex items-center justify-between py-3 border-b border-border last:border-0"
            >
              <div className="space-y-0.5">
                <Label className="text-base">{option.label}</Label>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
              </div>
              <Switch
                checked={settings[option.key]}
                onCheckedChange={() => toggleSetting(option.key)}
              />
            </div>
          ))}

          <div className="pt-4">
            <Button onClick={saveSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Preferências
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
