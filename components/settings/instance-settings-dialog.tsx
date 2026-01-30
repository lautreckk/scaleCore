"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2,
  Webhook,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  User,
  Shield,
  Settings,
  ImageIcon,
  Trash2,
} from "lucide-react";
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

interface ProfileData {
  wuid?: string;
  name?: string;
  picture?: string;
  status?: string;
  isBusiness?: boolean;
}

interface PrivacySettings {
  readreceipts: "all" | "none";
  profile: "all" | "contacts" | "contact_blacklist" | "none";
  status: "all" | "contacts" | "contact_blacklist" | "none";
  online: "all" | "match_last_seen";
  last: "all" | "contacts" | "contact_blacklist" | "none";
  groupadd: "all" | "contacts" | "contact_blacklist";
}

interface InstanceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceName: string;
  onSuccess?: () => void;
}

const privacyOptions = {
  readreceipts: [
    { value: "all", label: "Todos" },
    { value: "none", label: "Ninguem" },
  ],
  profile: [
    { value: "all", label: "Todos" },
    { value: "contacts", label: "Meus contatos" },
    { value: "contact_blacklist", label: "Meus contatos exceto..." },
    { value: "none", label: "Ninguem" },
  ],
  status: [
    { value: "all", label: "Todos" },
    { value: "contacts", label: "Meus contatos" },
    { value: "contact_blacklist", label: "Meus contatos exceto..." },
    { value: "none", label: "Ninguem" },
  ],
  online: [
    { value: "all", label: "Todos" },
    { value: "match_last_seen", label: "Igual ao Visto por ultimo" },
  ],
  last: [
    { value: "all", label: "Todos" },
    { value: "contacts", label: "Meus contatos" },
    { value: "contact_blacklist", label: "Meus contatos exceto..." },
    { value: "none", label: "Ninguem" },
  ],
  groupadd: [
    { value: "all", label: "Todos" },
    { value: "contacts", label: "Meus contatos" },
    { value: "contact_blacklist", label: "Meus contatos exceto..." },
  ],
};

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

  // Profile state
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [profilePicture, setProfilePicture] = useState("");

  // Privacy state
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    readreceipts: "all",
    profile: "all",
    status: "contacts",
    online: "all",
    last: "contacts",
    groupadd: "all",
  });
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  useEffect(() => {
    if (open && instanceName) {
      loadSettings();
      loadWebhook();
      loadProfile();
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

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const response = await fetch(
        `/api/whatsapp/instances/${instanceName}/profile`
      );
      const data = await response.json();

      if (data.success) {
        if (data.profile) {
          setProfile(data.profile);
          setProfileName(data.profile.name || "");
          setProfileStatus(data.profile.status || "");
          setProfilePicture(data.profile.picture || "");
        }
        if (data.privacy) {
          setPrivacy({
            readreceipts: data.privacy.readreceipts || "all",
            profile: data.privacy.profile || "all",
            status: data.privacy.status || "contacts",
            online: data.privacy.online || "all",
            last: data.privacy.last || "contacts",
            groupadd: data.privacy.groupadd || "all",
          });
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoadingProfile(false);
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

  const handleSaveSettings = async () => {
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
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar configuracoes"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProfileName = async () => {
    if (!profileName.trim()) {
      toast.error("Nome nao pode ser vazio");
      return;
    }
    setSavingProfile(true);
    try {
      const response = await fetch(
        `/api/whatsapp/instances/${instanceName}/profile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "updateName", name: profileName }),
        }
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Nome atualizado!");
      loadProfile();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar nome"
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateProfileStatus = async () => {
    setSavingProfile(true);
    try {
      const response = await fetch(
        `/api/whatsapp/instances/${instanceName}/profile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "updateStatus", status: profileStatus }),
        }
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Status atualizado!");
      loadProfile();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar status"
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateProfilePicture = async () => {
    if (!profilePicture.trim()) {
      toast.error("URL da imagem nao pode ser vazia");
      return;
    }
    setSavingProfile(true);
    try {
      const response = await fetch(
        `/api/whatsapp/instances/${instanceName}/profile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "updatePicture", picture: profilePicture }),
        }
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Foto atualizada!");
      loadProfile();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar foto"
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRemoveProfilePicture = async () => {
    setSavingProfile(true);
    try {
      const response = await fetch(
        `/api/whatsapp/instances/${instanceName}/profile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "removePicture" }),
        }
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Foto removida!");
      setProfilePicture("");
      loadProfile();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao remover foto"
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    try {
      const response = await fetch(
        `/api/whatsapp/instances/${instanceName}/profile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "updatePrivacy", privacy }),
        }
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Configuracoes de privacidade salvas!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar privacidade"
      );
    } finally {
      setSavingPrivacy(false);
    }
  };

  const updateSetting = <K extends keyof InstanceSettings>(
    key: K,
    value: InstanceSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updatePrivacy = <K extends keyof PrivacySettings>(
    key: K,
    value: PrivacySettings[K]
  ) => {
    setPrivacy((prev) => ({ ...prev, [key]: value }));
  };

  const expectedWebhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/evolution`
      : "";

  const isWebhookConfigured =
    webhookInfo?.enabled &&
    webhookInfo?.url &&
    webhookInfo.url.includes("/api/webhooks/evolution");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuracoes da Instancia</DialogTitle>
          <DialogDescription>
            Configure o perfil, privacidade e comportamento da sua instancia WhatsApp
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Privacidade</span>
            </TabsTrigger>
            <TabsTrigger value="webhook" className="flex items-center gap-1.5">
              <Webhook className="h-4 w-4" />
              <span className="hidden sm:inline">Webhook</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Comportamento</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4 mt-4">
            {loadingProfile ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Profile Picture */}
                <div className="flex flex-col items-center gap-4 p-4 border rounded-lg">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profile?.picture || profilePicture} />
                    <AvatarFallback>
                      <User className="h-12 w-12" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col w-full gap-2">
                    <Label>URL da Foto de Perfil</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://exemplo.com/foto.jpg"
                        value={profilePicture}
                        onChange={(e) => setProfilePicture(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleUpdateProfilePicture}
                        disabled={savingProfile}
                      >
                        {savingProfile ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImageIcon className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={handleRemoveProfilePicture}
                        disabled={savingProfile}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A imagem deve ser acessivel publicamente
                    </p>
                  </div>
                </div>

                {/* Profile Name */}
                <div className="space-y-2">
                  <Label>Nome do Perfil</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome que aparece no WhatsApp"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      maxLength={25}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleUpdateProfileName}
                      disabled={savingProfile}
                    >
                      {savingProfile ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Salvar"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximo de 25 caracteres
                  </p>
                </div>

                {/* Profile Status/Bio */}
                <div className="space-y-2">
                  <Label>Status / Recado</Label>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Seu recado ou status"
                      value={profileStatus}
                      onChange={(e) => setProfileStatus(e.target.value)}
                      maxLength={139}
                      rows={2}
                      className="flex-1 resize-none"
                    />
                    <Button
                      onClick={handleUpdateProfileStatus}
                      disabled={savingProfile}
                      className="self-end"
                    >
                      {savingProfile ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Salvar"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximo de 139 caracteres
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="space-y-4 mt-4">
            {loadingProfile ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Read Receipts */}
                <div className="space-y-2">
                  <Label>Confirmacao de leitura</Label>
                  <Select
                    value={privacy.readreceipts}
                    onValueChange={(v) =>
                      updatePrivacy("readreceipts", v as PrivacySettings["readreceipts"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {privacyOptions.readreceipts.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Se desativado, voce tambem nao vera confirmacoes dos outros
                  </p>
                </div>

                {/* Profile Photo */}
                <div className="space-y-2">
                  <Label>Foto de perfil</Label>
                  <Select
                    value={privacy.profile}
                    onValueChange={(v) =>
                      updatePrivacy("profile", v as PrivacySettings["profile"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {privacyOptions.profile.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Quem pode ver sua foto de perfil
                  </p>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={privacy.status}
                    onValueChange={(v) =>
                      updatePrivacy("status", v as PrivacySettings["status"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {privacyOptions.status.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Quem pode ver seus status
                  </p>
                </div>

                {/* Online */}
                <div className="space-y-2">
                  <Label>Online</Label>
                  <Select
                    value={privacy.online}
                    onValueChange={(v) =>
                      updatePrivacy("online", v as PrivacySettings["online"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {privacyOptions.online.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Quem pode ver quando voce esta online
                  </p>
                </div>

                {/* Last Seen */}
                <div className="space-y-2">
                  <Label>Visto por ultimo</Label>
                  <Select
                    value={privacy.last}
                    onValueChange={(v) =>
                      updatePrivacy("last", v as PrivacySettings["last"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {privacyOptions.last.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Quem pode ver quando esteve online pela ultima vez
                  </p>
                </div>

                {/* Group Add */}
                <div className="space-y-2">
                  <Label>Adicionar em grupos</Label>
                  <Select
                    value={privacy.groupadd}
                    onValueChange={(v) =>
                      updatePrivacy("groupadd", v as PrivacySettings["groupadd"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {privacyOptions.groupadd.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Quem pode adicionar voce em grupos
                  </p>
                </div>

                <Button
                  onClick={handleSavePrivacy}
                  disabled={savingPrivacy}
                  className="w-full"
                >
                  {savingPrivacy && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Salvar Configuracoes de Privacidade
                </Button>
              </div>
            )}
          </TabsContent>

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
                      O webhook nao esta configurado. Configure para receber
                      mensagens no sistema.
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
                  {isWebhookConfigured
                    ? "Reconfigurar Webhook"
                    : "Configurar Webhook"}
                </Button>

                {!isWebhookConfigured && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm text-yellow-500">
                      O webhook precisa estar configurado para que as mensagens
                      do WhatsApp aparecam no sistema de chat.
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

                <Button
                  onClick={handleSaveSettings}
                  disabled={loading || saving}
                  className="w-full"
                >
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
