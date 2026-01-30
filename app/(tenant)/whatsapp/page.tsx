"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Plus,
  Smartphone,
  Loader2,
  RefreshCw,
  QrCode,
  CheckCircle2,
  XCircle,
  MoreVertical,
} from "lucide-react";

interface WhatsAppInstance {
  id: string;
  name: string;
  instance_name: string;
  status: string;
  phone_number: string | null;
  qrcode: string | null;
  total_messages_sent: number;
  last_connected_at: string | null;
  created_at: string;
}

export default function WhatsAppPage() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [refreshingQR, setRefreshingQR] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadInstances();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("whatsapp_instances_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_instances" },
        () => {
          loadInstances();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadInstances = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) return;

    const { data } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("tenant_id", tenantUser.tenant_id)
      .order("created_at", { ascending: true });

    setInstances(data || []);
    setLoading(false);
  };

  const createInstance = async () => {
    if (!newInstanceName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/whatsapp/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newInstanceName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar instância");
      }

      toast.success("Instância criada! Escaneie o QR Code para conectar.");
      setNewInstanceName("");
      setSelectedInstance(data.instance);
      setShowQRDialog(true);
      loadInstances();
    } catch (error) {
      console.error("Error creating instance:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao criar instância");
    } finally {
      setCreating(false);
    }
  };

  const refreshQRCode = async (instanceName: string) => {
    setRefreshingQR(true);
    try {
      const response = await fetch(`/api/whatsapp/instances/${instanceName}/connect`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao atualizar QR Code");
      }

      toast.success("QR Code atualizado!");
      loadInstances();
    } catch (error) {
      console.error("Error refreshing QR:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar QR Code");
    } finally {
      setRefreshingQR(false);
    }
  };

  const disconnectInstance = async (instanceName: string) => {
    try {
      const response = await fetch(`/api/whatsapp/instances/${instanceName}/disconnect`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao desconectar");
      }

      toast.success("Instância desconectada");
      loadInstances();
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao desconectar");
    }
  };

  const deleteInstance = async (instanceName: string) => {
    if (!confirm("Tem certeza que deseja excluir esta instância?")) return;

    try {
      const response = await fetch(`/api/whatsapp/instances/${instanceName}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao excluir");
      }

      toast.success("Instância excluída");
      loadInstances();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao excluir");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
      connected: { icon: CheckCircle2, color: "text-green-500", label: "Conectado" },
      connecting: { icon: Loader2, color: "text-yellow-500", label: "Conectando" },
      disconnected: { icon: XCircle, color: "text-red-500", label: "Desconectado" },
    };

    const config = statusConfig[status] || statusConfig.disconnected;
    const Icon = config.icon;

    return (
      <span className={`flex items-center gap-1.5 text-sm ${config.color}`}>
        <Icon className={`h-4 w-4 ${status === "connecting" ? "animate-spin" : ""}`} />
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie suas instâncias do WhatsApp
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Instância
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Instância</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Instância</Label>
                <Input
                  id="name"
                  placeholder="Ex: Vendas, Suporte, Marketing"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                />
              </div>
              <Button onClick={createInstance} disabled={creating} className="w-full">
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Instância
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Instances */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 bg-surface-elevated rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : instances.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Nenhuma instância
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie sua primeira instância do WhatsApp para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {instances.map((instance) => (
            <Card key={instance.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{instance.name}</CardTitle>
                  {getStatusBadge(instance.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {instance.phone_number && (
                  <p className="text-sm text-muted-foreground">
                    📱 {instance.phone_number}
                  </p>
                )}

                <div className="text-sm text-muted-foreground">
                  <p>Mensagens enviadas: {instance.total_messages_sent}</p>
                </div>

                {instance.status === "disconnected" && instance.qrcode && (
                  <div className="flex flex-col items-center p-4 bg-white rounded-lg">
                    <img
                      src={instance.qrcode}
                      alt="QR Code"
                      className="w-48 h-48"
                    />
                    <p className="text-xs text-gray-600 mt-2 text-center">
                      Escaneie com o WhatsApp
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  {instance.status === "disconnected" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refreshQRCode(instance.instance_name)}
                      disabled={refreshingQR}
                    >
                      {refreshingQR ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4" />
                      )}
                      <span className="ml-2">Novo QR</span>
                    </Button>
                  )}

                  {instance.status === "connected" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectInstance(instance.instance_name)}
                    >
                      Desconectar
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteInstance(instance.instance_name)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  >
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center p-4">
            {selectedInstance?.qrcode ? (
              <>
                <div className="bg-white p-4 rounded-lg">
                  <img
                    src={selectedInstance.qrcode}
                    alt="QR Code"
                    className="w-64 h-64"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Abra o WhatsApp no seu celular, vá em Dispositivos Vinculados e
                  escaneie o QR Code acima.
                </p>
                <Button
                  variant="outline"
                  onClick={() => selectedInstance && refreshQRCode(selectedInstance.instance_name)}
                  disabled={refreshingQR}
                  className="mt-4"
                >
                  {refreshingQR ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Atualizar QR Code
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Gerando QR Code...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
