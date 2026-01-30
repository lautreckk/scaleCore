"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Smartphone,
  Plus,
  QrCode,
  Trash2,
  WifiOff,
  Loader2,
  Server,
  AlertCircle,
  RefreshCw,
  Settings,
  Webhook,
} from "lucide-react";
import { EvolutionServerCard } from "@/components/settings/evolution-server-card";
import { EvolutionServerDialog } from "@/components/settings/evolution-server-dialog";
import { InstanceSettingsDialog } from "@/components/settings/instance-settings-dialog";
import { WebhookForwardCard } from "@/components/settings/webhook-forward-card";
import { WebhookForwardDialog } from "@/components/settings/webhook-forward-dialog";

interface EvolutionServer {
  id: string;
  name: string;
  url: string;
  api_key_masked: string;
  is_active: boolean;
  instance_count: number;
}

interface WhatsAppInstance {
  id: string;
  name: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
  qrcode: string | null;
  last_connected_at: string | null;
  total_messages_sent: number;
  evolution_config_id: string | null;
  evolution_config?: {
    id: string;
    name: string;
  } | null;
}

interface WebhookForward {
  id: string;
  name: string;
  target_url: string;
  headers: Record<string, string> | null;
  events: string[] | null;
  is_active: boolean;
  instance_id: string;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  whatsapp_instances: {
    id: string;
    name: string;
    instance_name: string;
  } | null;
}

export default function IntegrationsPage() {
  const [servers, setServers] = useState<EvolutionServer[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [selectedServerId, setSelectedServerId] = useState("");
  const [instanceDialogOpen, setInstanceDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<EvolutionServer | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [refreshingInstance, setRefreshingInstance] = useState<string | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsInstanceName, setSettingsInstanceName] = useState<string | null>(null);

  // Webhook forwards state
  const [webhookForwards, setWebhookForwards] = useState<WebhookForward[]>([]);
  const [loadingForwards, setLoadingForwards] = useState(true);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [editingForward, setEditingForward] = useState<WebhookForward | null>(null);
  const [testingForward, setTestingForward] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) return;
    setTenantId(tenantUser.tenant_id);

    await Promise.all([loadServers(), loadInstances(), loadWebhookForwards()]);
  };

  const loadServers = async () => {
    setLoadingServers(true);
    try {
      const response = await fetch("/api/settings/integrations/evolution");
      const data = await response.json();
      if (data.configs) {
        setServers(data.configs);
      }
    } catch (error) {
      console.error("Error loading servers:", error);
      toast.error("Erro ao carregar servidores");
    } finally {
      setLoadingServers(false);
    }
  };

  const loadInstances = async () => {
    setLoadingInstances(true);
    try {
      const response = await fetch("/api/whatsapp/instances");
      const data = await response.json();
      if (data.instances) {
        setInstances(data.instances);
      }
    } catch (error) {
      console.error("Error loading instances:", error);
      toast.error("Erro ao carregar instancias");
    } finally {
      setLoadingInstances(false);
    }
  };

  const loadWebhookForwards = async () => {
    setLoadingForwards(true);
    try {
      const response = await fetch("/api/webhook-forwards");
      const data = await response.json();
      if (data.forwards) {
        setWebhookForwards(data.forwards);
      }
    } catch (error) {
      console.error("Error loading webhook forwards:", error);
      toast.error("Erro ao carregar webhook forwards");
    } finally {
      setLoadingForwards(false);
    }
  };

  const createInstance = async () => {
    if (!newInstanceName.trim() || !tenantId || !selectedServerId) {
      toast.error("Preencha todos os campos");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/whatsapp/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newInstanceName,
          evolutionConfigId: selectedServerId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Falha ao criar instancia");
      }

      toast.success("Instancia criada com sucesso!");
      setInstanceDialogOpen(false);
      setNewInstanceName("");
      setSelectedServerId("");
      loadInstances();
      loadServers(); // Update instance counts
    } catch (error) {
      console.error("Error creating instance:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao criar instancia");
    } finally {
      setCreating(false);
    }
  };

  const connectInstance = async (instance: WhatsAppInstance) => {
    setSelectedInstance(instance);
    setQrDialogOpen(true);

    try {
      const response = await fetch(`/api/whatsapp/instances/${instance.instance_name}/connect`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Falha ao conectar instancia");
      }

      // Poll for updates
      const pollInterval = setInterval(async () => {
        const { data } = await supabase
          .from("whatsapp_instances")
          .select("qrcode, status")
          .eq("id", instance.id)
          .single();

        if (data) {
          setSelectedInstance((prev) =>
            prev ? { ...prev, qrcode: data.qrcode, status: data.status } : null
          );

          if (data.status === "connected") {
            clearInterval(pollInterval);
            toast.success("WhatsApp conectado com sucesso!");
            setQrDialogOpen(false);
            loadInstances();
          }
        }
      }, 2000);

      setTimeout(() => clearInterval(pollInterval), 120000);
    } catch (error) {
      console.error("Error connecting instance:", error);
      toast.error("Erro ao conectar instancia");
    }
  };

  const disconnectInstance = async (instance: WhatsAppInstance) => {
    try {
      const response = await fetch(`/api/whatsapp/instances/${instance.instance_name}/disconnect`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Falha ao desconectar instancia");
      }

      toast.success("WhatsApp desconectado");
      loadInstances();
    } catch (error) {
      console.error("Error disconnecting instance:", error);
      toast.error("Erro ao desconectar instancia");
    }
  };

  const checkInstanceStatus = async (instance: WhatsAppInstance) => {
    setRefreshingInstance(instance.id);
    try {
      const response = await fetch(`/api/whatsapp/instances/${instance.instance_name}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error("Falha ao verificar status");
      }

      // Update local state based on connection state
      const newStatus = data.connectionState === "open" ? "connected" : "disconnected";

      // Update in database if status changed
      if (newStatus !== instance.status) {
        await supabase
          .from("whatsapp_instances")
          .update({ status: newStatus })
          .eq("id", instance.id);
      }

      // Update selected instance if in QR dialog
      if (selectedInstance?.id === instance.id) {
        setSelectedInstance((prev) =>
          prev ? { ...prev, status: newStatus } : null
        );

        if (newStatus === "connected") {
          toast.success("WhatsApp conectado com sucesso!");
          setQrDialogOpen(false);
        }
      }

      loadInstances();

      if (newStatus === "connected") {
        toast.success("Instancia conectada!");
      } else {
        toast.info("Status: Desconectado");
      }
    } catch (error) {
      console.error("Error checking instance status:", error);
      toast.error("Erro ao verificar status");
    } finally {
      setRefreshingInstance(null);
    }
  };

  const deleteInstance = async (instance: WhatsAppInstance) => {
    if (!confirm("Tem certeza que deseja excluir esta instancia?")) return;

    try {
      const response = await fetch(`/api/whatsapp/instances/${instance.instance_name}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Falha ao excluir instancia");
      }

      toast.success("Instancia excluida");
      loadInstances();
      loadServers(); // Update instance counts
    } catch (error) {
      console.error("Error deleting instance:", error);
      toast.error("Erro ao excluir instancia");
    }
  };

  const deleteServer = async (serverId: string) => {
    try {
      const response = await fetch(`/api/settings/integrations/evolution/${serverId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Falha ao excluir servidor");
      }

      toast.success("Servidor excluido");
      loadServers();
    } catch (error) {
      console.error("Error deleting server:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao excluir servidor");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge variant="success">Conectado</Badge>;
      case "waiting_qr":
        return <Badge variant="warning">Aguardando QR</Badge>;
      default:
        return <Badge variant="secondary">Desconectado</Badge>;
    }
  };

  const openEditServerDialog = (server: EvolutionServer) => {
    setEditingServer(server);
    setServerDialogOpen(true);
  };

  const openAddServerDialog = () => {
    setEditingServer(null);
    setServerDialogOpen(true);
  };

  const openInstanceSettings = (instance: WhatsAppInstance) => {
    setSettingsInstanceName(instance.instance_name);
    setSettingsDialogOpen(true);
  };

  const openAddForwardDialog = () => {
    setEditingForward(null);
    setForwardDialogOpen(true);
  };

  const openEditForwardDialog = (forward: WebhookForward) => {
    setEditingForward(forward);
    setForwardDialogOpen(true);
  };

  const deleteWebhookForward = async (forwardId: string) => {
    if (!confirm("Tem certeza que deseja excluir este webhook forward?")) return;

    try {
      const response = await fetch(`/api/webhook-forwards/${forwardId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Falha ao excluir webhook forward");
      }

      toast.success("Webhook forward excluido");
      loadWebhookForwards();
    } catch (error) {
      console.error("Error deleting webhook forward:", error);
      toast.error("Erro ao excluir webhook forward");
    }
  };

  const testWebhookForward = async (forwardId: string) => {
    setTestingForward(forwardId);
    try {
      const response = await fetch(`/api/webhook-forwards/${forwardId}/test`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Teste bem-sucedido! (${data.responseTime}ms)`);
      } else {
        toast.error(`Teste falhou: ${data.error || "Erro desconhecido"}`);
      }

      loadWebhookForwards();
    } catch (error) {
      console.error("Error testing webhook forward:", error);
      toast.error("Erro ao testar webhook forward");
    } finally {
      setTestingForward(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Evolution API Servers Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Servidores Evolution API</CardTitle>
            <CardDescription>
              Configure seus servidores Evolution API para criar instancias WhatsApp
            </CardDescription>
          </div>
          <Button onClick={openAddServerDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Servidor
          </Button>
        </CardHeader>
        <CardContent>
          {loadingServers ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Server className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Nenhum servidor configurado
              </p>
              <p className="text-sm text-muted-foreground">
                Configure um servidor Evolution API para comecar a criar instancias WhatsApp
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {servers.map((server) => (
                <EvolutionServerCard
                  key={server.id}
                  server={server}
                  onEdit={() => openEditServerDialog(server)}
                  onDelete={() => deleteServer(server.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Instances Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Instancias WhatsApp</CardTitle>
            <CardDescription>
              Conecte e gerencie suas instancias do WhatsApp
            </CardDescription>
          </div>
          <Dialog open={instanceDialogOpen} onOpenChange={setInstanceDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={servers.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Instancia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Instancia</DialogTitle>
                <DialogDescription>
                  Crie uma nova instancia para conectar um numero de WhatsApp
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Instancia</Label>
                  <Input
                    id="name"
                    placeholder="Ex: atendimento-principal"
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use apenas letras, numeros e hifens
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="server">Servidor Evolution API</Label>
                  <Select
                    value={selectedServerId}
                    onValueChange={setSelectedServerId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um servidor" />
                    </SelectTrigger>
                    <SelectContent>
                      {servers.map((server) => (
                        <SelectItem key={server.id} value={server.id}>
                          {server.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Selecione em qual servidor a instancia sera criada
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInstanceDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={createInstance} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Configure um servidor Evolution API primeiro
              </p>
              <p className="text-sm text-muted-foreground">
                Voce precisa adicionar pelo menos um servidor antes de criar instancias
              </p>
            </div>
          ) : loadingInstances ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Smartphone className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Nenhuma instancia configurada
              </p>
              <p className="text-sm text-muted-foreground">
                Crie uma instancia para conectar seu WhatsApp
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {instances.map((instance) => (
                <div
                  key={instance.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">
                          {instance.name || instance.instance_name}
                        </p>
                        {getStatusBadge(instance.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {instance.phone_number || "Numero nao configurado"}
                      </p>
                      {instance.evolution_config && (
                        <p className="text-xs text-muted-foreground">
                          Servidor: {instance.evolution_config.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => checkInstanceStatus(instance)}
                      disabled={refreshingInstance === instance.id}
                      title="Verificar status"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${
                          refreshingInstance === instance.id ? "animate-spin" : ""
                        }`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openInstanceSettings(instance)}
                      title="Configuracoes"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    {instance.status === "connected" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnectInstance(instance)}
                      >
                        <WifiOff className="h-4 w-4 mr-2" />
                        Desconectar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => connectInstance(instance)}
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        Conectar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteInstance(instance)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Forwards Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Webhook Forwards</CardTitle>
            <CardDescription>
              Encaminhe eventos do WhatsApp para n8n, Zapier ou outras integracoes
            </CardDescription>
          </div>
          <Button onClick={openAddForwardDialog} disabled={instances.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Forward
          </Button>
        </CardHeader>
        <CardContent>
          {instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Crie uma instancia WhatsApp primeiro
              </p>
              <p className="text-sm text-muted-foreground">
                Voce precisa ter pelo menos uma instancia para criar webhook forwards
              </p>
            </div>
          ) : loadingForwards ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : webhookForwards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Webhook className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Nenhum webhook forward configurado
              </p>
              <p className="text-sm text-muted-foreground">
                Configure forwards para integrar com n8n, Zapier ou outras ferramentas
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {webhookForwards.map((forward) => (
                <WebhookForwardCard
                  key={forward.id}
                  forward={forward}
                  onEdit={() => openEditForwardDialog(forward)}
                  onDelete={() => deleteWebhookForward(forward.id)}
                  onTest={() => testWebhookForward(forward.id)}
                  testing={testingForward === forward.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Forward Dialog */}
      <WebhookForwardDialog
        open={forwardDialogOpen}
        onOpenChange={setForwardDialogOpen}
        forward={editingForward}
        instances={instances.map((i) => ({ id: i.id, name: i.name, instance_name: i.instance_name }))}
        onSuccess={loadWebhookForwards}
      />

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para conectar
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            {selectedInstance?.status === "connected" ? (
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Smartphone className="h-8 w-8 text-green-500" />
                </div>
                <p className="text-lg font-medium text-green-500">
                  WhatsApp Conectado!
                </p>
                <p className="text-sm text-muted-foreground">
                  Sua instancia esta pronta para uso
                </p>
              </div>
            ) : selectedInstance?.qrcode ? (
              <div className="p-4 bg-white rounded-lg">
                <img
                  src={
                    selectedInstance.qrcode.startsWith("data:")
                      ? selectedInstance.qrcode
                      : `data:image/png;base64,${selectedInstance.qrcode}`
                  }
                  alt="QR Code"
                  className="w-64 h-64"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Aguardando QR Code...
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            {selectedInstance && selectedInstance.status !== "connected" && (
              <Button
                variant="secondary"
                onClick={() => checkInstanceStatus(selectedInstance)}
                disabled={refreshingInstance === selectedInstance.id}
              >
                {refreshingInstance === selectedInstance.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Verificar Status
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setQrDialogOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evolution Server Dialog */}
      <EvolutionServerDialog
        open={serverDialogOpen}
        onOpenChange={setServerDialogOpen}
        server={editingServer}
        onSuccess={() => {
          loadServers();
        }}
      />

      {/* Instance Settings Dialog */}
      {settingsInstanceName && (
        <InstanceSettingsDialog
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
          instanceName={settingsInstanceName}
        />
      )}
    </div>
  );
}
