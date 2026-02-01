"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigCard } from "@/components/aquecimento/config-card";
import { ConfigModal } from "@/components/aquecimento/config-modal";
import { ActivityLog } from "@/components/aquecimento/activity-log";
import { StatsCards } from "@/components/aquecimento/stats-cards";
import { MediaLibrary } from "@/components/aquecimento/media-library";
import { toast } from "sonner";
import {
  Plus,
  Flame,
  ListFilter,
  Activity,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WhatsAppInstance {
  id: string;
  name: string;
  phone_number: string | null;
  color: string | null;
  status: string | null;
}

interface WarmingConfig {
  id: string;
  name: string;
  description: string | null;
  status: string;
  total_actions_executed: number;
  total_messages_sent: number;
  last_action_at: string | null;
  warming_config_instances: Array<{
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
  }>;
  active_session: {
    id: string;
    status: string;
    started_at: string;
    actions_executed: number;
    errors_count: number;
    next_action_at: string | null;
  } | null;
}

export default function AquecimentoPage() {
  const [configs, setConfigs] = useState<WarmingConfig[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<WarmingConfig | null>(null);
  const [deleteConfigId, setDeleteConfigId] = useState<string | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<"today" | "week" | "month">("today");
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) return;

    // Load WhatsApp instances
    const { data: instancesData } = await supabase
      .from("whatsapp_instances")
      .select("id, name, phone_number, color, status")
      .eq("tenant_id", tenantUser.tenant_id)
      .order("name");

    setInstances(instancesData || []);

    // Load configs via API
    try {
      const response = await fetch("/api/warming/configs");
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.data || []);
      }
    } catch (error) {
      console.error("Error loading configs:", error);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateConfig = () => {
    setEditingConfig(null);
    setShowConfigModal(true);
  };

  const handleEditConfig = (config: WarmingConfig) => {
    // Load full config data
    const fullConfig = {
      ...config,
      instance_ids: config.warming_config_instances?.map((ci) => ci.instance_id) || [],
    };
    setEditingConfig(fullConfig as any);
    setShowConfigModal(true);
  };

  const handleDeleteConfig = async () => {
    if (!deleteConfigId) return;

    try {
      const response = await fetch(`/api/warming/configs/${deleteConfigId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao excluir");
      }

      toast.success("Configuracao excluida");
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir");
    } finally {
      setDeleteConfigId(null);
    }
  };

  const handleStartSession = async (configId: string) => {
    try {
      const response = await fetch(`/api/warming/configs/${configId}/start`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao iniciar");
      }

      toast.success("Aquecimento iniciado");
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar");
    }
  };

  const handleStopSession = async (configId: string) => {
    try {
      const response = await fetch(`/api/warming/configs/${configId}/stop`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao parar");
      }

      toast.success("Aquecimento parado");
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao parar");
    }
  };

  const handlePauseSession = async (configId: string) => {
    try {
      const response = await fetch(`/api/warming/configs/${configId}/pause`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao pausar/retomar");
      }

      const data = await response.json();
      toast.success(data.message || "Sessao atualizada");
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao pausar/retomar");
    }
  };

  const connectedInstances = instances.filter((i) => i.status === "connected");
  const hasEnoughInstances = connectedInstances.length >= 2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-500" />
            Aquecimento
          </h1>
          <p className="text-muted-foreground">
            Mantenha seus chips WhatsApp ativos e evite bloqueios
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowMediaLibrary(true)}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Biblioteca de Midia
          </Button>
          <Button onClick={handleCreateConfig} disabled={!hasEnoughInstances}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Configuracao
          </Button>
        </div>
      </div>

      {/* Warning if not enough instances */}
      {!hasEnoughInstances && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-500">
              Instancias insuficientes
            </p>
            <p className="text-xs text-yellow-500/80">
              Voce precisa de pelo menos 2 instancias WhatsApp conectadas para
              usar o aquecimento. Atualmente voce tem {connectedInstances.length}.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Tabs value={statsPeriod} onValueChange={(v) => setStatsPeriod(v as any)}>
            <TabsList>
              <TabsTrigger value="today">Hoje</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mes</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <StatsCards period={statsPeriod} />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="configs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configs" className="gap-2">
            <ListFilter className="h-4 w-4" />
            Configuracoes
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            Atividade
          </TabsTrigger>
        </TabsList>

        {/* Configs Tab */}
        <TabsContent value="configs" className="space-y-4">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-48 bg-surface-elevated rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : configs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Flame className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Nenhuma configuracao
                </h3>
                <p className="text-muted-foreground text-center mb-4 max-w-md">
                  Crie configuracoes de aquecimento para manter seus chips
                  WhatsApp ativos e evitar bloqueios.
                </p>
                {hasEnoughInstances && (
                  <Button onClick={handleCreateConfig}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Configuracao
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {configs.map((config) => (
                <ConfigCard
                  key={config.id}
                  config={config}
                  onEdit={() => handleEditConfig(config)}
                  onDelete={() => setDeleteConfigId(config.id)}
                  onStart={() => handleStartSession(config.id)}
                  onStop={() => handleStopSession(config.id)}
                  onPause={() => handlePauseSession(config.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <ActivityLog limit={50} />
        </TabsContent>
      </Tabs>

      {/* Config Modal */}
      <ConfigModal
        open={showConfigModal}
        onOpenChange={setShowConfigModal}
        config={editingConfig}
        instances={instances}
        onSave={loadData}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfigId}
        onOpenChange={() => setDeleteConfigId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir configuracao?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao nao pode ser desfeita. Todos os logs e sessoes
              relacionados serao excluidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfig}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Media Library */}
      <MediaLibrary
        open={showMediaLibrary}
        onOpenChange={setShowMediaLibrary}
      />
    </div>
  );
}
