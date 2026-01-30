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
import { toast } from "sonner";
import {
  Smartphone,
  Plus,
  QrCode,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
  qrcode: string | null;
  last_connected_at: string | null;
  total_messages_sent: number;
}

export default function IntegrationsPage() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadInstances();
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
    setTenantId(tenantUser.tenant_id);

    const { data, error } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("tenant_id", tenantUser.tenant_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading instances:", error);
      toast.error("Erro ao carregar instâncias");
    } else {
      setInstances(data || []);
    }
    setLoading(false);
  };

  const createInstance = async () => {
    if (!newInstanceName.trim() || !tenantId) return;

    setCreating(true);
    try {
      // Create instance in Evolution API
      const response = await fetch("/api/whatsapp/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newInstanceName }),
      });

      if (!response.ok) {
        throw new Error("Failed to create instance");
      }

      const result = await response.json();

      // Save to database
      const { error } = await supabase.from("whatsapp_instances").insert({
        tenant_id: tenantId,
        instance_name: result.instanceName || newInstanceName,
        status: "disconnected",
      });

      if (error) throw error;

      toast.success("Instância criada com sucesso!");
      setDialogOpen(false);
      setNewInstanceName("");
      loadInstances();
    } catch (error) {
      console.error("Error creating instance:", error);
      toast.error("Erro ao criar instância");
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
        throw new Error("Failed to connect instance");
      }

      // The QR code will be received via webhook and saved to the database
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

      // Clear interval after 2 minutes
      setTimeout(() => clearInterval(pollInterval), 120000);
    } catch (error) {
      console.error("Error connecting instance:", error);
      toast.error("Erro ao conectar instância");
    }
  };

  const disconnectInstance = async (instance: WhatsAppInstance) => {
    try {
      const response = await fetch(`/api/whatsapp/instances/${instance.instance_name}/disconnect`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect instance");
      }

      await supabase
        .from("whatsapp_instances")
        .update({ status: "disconnected", qrcode: null })
        .eq("id", instance.id);

      toast.success("WhatsApp desconectado");
      loadInstances();
    } catch (error) {
      console.error("Error disconnecting instance:", error);
      toast.error("Erro ao desconectar instância");
    }
  };

  const deleteInstance = async (instance: WhatsAppInstance) => {
    if (!confirm("Tem certeza que deseja excluir esta instância?")) return;

    try {
      const response = await fetch(`/api/whatsapp/instances/${instance.instance_name}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete instance");
      }

      await supabase.from("whatsapp_instances").delete().eq("id", instance.id);

      toast.success("Instância excluída");
      loadInstances();
    } catch (error) {
      console.error("Error deleting instance:", error);
      toast.error("Erro ao excluir instância");
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Instâncias WhatsApp</CardTitle>
            <CardDescription>
              Conecte e gerencie suas instâncias do WhatsApp
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Instância
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Instância</DialogTitle>
                <DialogDescription>
                  Crie uma nova instância para conectar um número de WhatsApp
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Instância</Label>
                  <Input
                    id="name"
                    placeholder="Ex: atendimento-principal"
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use apenas letras, números e hífens
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
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
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Smartphone className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Nenhuma instância configurada
              </p>
              <p className="text-sm text-muted-foreground">
                Crie uma instância para conectar seu WhatsApp
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
                      <p className="font-medium text-white">
                        {instance.instance_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {instance.phone_number || "Número não configurado"}
                      </p>
                    </div>
                    {getStatusBadge(instance.status)}
                  </div>
                  <div className="flex items-center gap-2">
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
            {selectedInstance?.qrcode ? (
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setQrDialogOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
