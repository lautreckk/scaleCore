"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Zap,
  MessageSquare,
  UserPlus,
  Tag,
  ArrowRight,
} from "lucide-react";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
}

const triggerTypes = [
  {
    value: "lead_created",
    label: "Lead Criado",
    description: "Executa quando um novo lead é criado",
    icon: UserPlus,
  },
  {
    value: "lead_status_changed",
    label: "Status Alterado",
    description: "Executa quando o status de um lead muda",
    icon: Tag,
  },
  {
    value: "message_received",
    label: "Mensagem Recebida",
    description: "Executa quando uma mensagem é recebida no WhatsApp",
    icon: MessageSquare,
  },
];

const actionTypes = [
  {
    value: "send_whatsapp",
    label: "Enviar WhatsApp",
    description: "Envia uma mensagem automática via WhatsApp",
  },
  {
    value: "update_lead_status",
    label: "Atualizar Status",
    description: "Altera o status do lead automaticamente",
  },
  {
    value: "add_tag",
    label: "Adicionar Tag",
    description: "Adiciona uma tag ao lead",
  },
  {
    value: "webhook",
    label: "Chamar Webhook",
    description: "Faz uma requisição HTTP para uma URL externa",
  },
];

export default function NewAutomationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    triggerType: "",
    triggerConfig: {} as Record<string, unknown>,
    actionType: "",
    actionConfig: {} as Record<string, unknown>,
    isActive: true,
  });
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

    const { data: instancesData } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, status")
      .eq("tenant_id", tenantUser.tenant_id)
      .eq("status", "connected");

    setInstances(instancesData || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!formData.triggerType) {
      toast.error("Selecione um gatilho");
      return;
    }

    if (!formData.actionType) {
      toast.error("Selecione uma ação");
      return;
    }

    if (!tenantId) {
      toast.error("Tenant não encontrado");
      return;
    }

    setLoading(true);
    try {
      const { data: automation, error } = await supabase
        .from("automations")
        .insert({
          tenant_id: tenantId,
          name: formData.name,
          trigger_type: formData.triggerType,
          trigger_config: formData.triggerConfig,
          actions: [
            {
              type: formData.actionType,
              config: formData.actionConfig,
            },
          ],
          status: formData.isActive ? "active" : "inactive",
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Automação criada com sucesso!");
      router.push(`/automations`);
    } catch (error) {
      console.error("Error creating automation:", error);
      toast.error("Erro ao criar automação");
    } finally {
      setLoading(false);
    }
  };

  const renderTriggerConfig = () => {
    switch (formData.triggerType) {
      case "lead_status_changed":
        return (
          <div className="space-y-2">
            <Label>Status de origem (opcional)</Label>
            <Select
              value={formData.triggerConfig.fromStatus as string || "any"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  triggerConfig: { ...formData.triggerConfig, fromStatus: value },
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Qualquer status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer status</SelectItem>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="contacted">Contactado</SelectItem>
                <SelectItem value="qualified">Qualificado</SelectItem>
                <SelectItem value="proposal">Proposta</SelectItem>
              </SelectContent>
            </Select>
            <Label className="mt-4">Status de destino</Label>
            <Select
              value={formData.triggerConfig.toStatus as string || ""}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  triggerConfig: { ...formData.triggerConfig, toStatus: value },
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contacted">Contactado</SelectItem>
                <SelectItem value="qualified">Qualificado</SelectItem>
                <SelectItem value="proposal">Proposta</SelectItem>
                <SelectItem value="won">Ganho</SelectItem>
                <SelectItem value="lost">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case "message_received":
        return (
          <div className="space-y-2">
            <Label>Contém palavra-chave (opcional)</Label>
            <Input
              placeholder="Ex: preço, orçamento"
              value={formData.triggerConfig.keyword as string || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  triggerConfig: { ...formData.triggerConfig, keyword: e.target.value },
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco para executar em qualquer mensagem
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  const renderActionConfig = () => {
    switch (formData.actionType) {
      case "send_whatsapp":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Instância do WhatsApp</Label>
              <Select
                value={formData.actionConfig.instanceId as string || ""}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    actionConfig: { ...formData.actionConfig, instanceId: value },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.instance_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                placeholder="Digite a mensagem a ser enviada..."
                rows={4}
                value={formData.actionConfig.message as string || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    actionConfig: { ...formData.actionConfig, message: e.target.value },
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{nome}}"} para nome do lead, {"{{empresa}}"} para empresa
              </p>
            </div>
            <div className="space-y-2">
              <Label>Atraso antes de enviar (segundos)</Label>
              <Input
                type="number"
                min={0}
                max={3600}
                value={formData.actionConfig.delay as number || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    actionConfig: { ...formData.actionConfig, delay: parseInt(e.target.value) || 0 },
                  })
                }
              />
            </div>
          </div>
        );
      case "update_lead_status":
        return (
          <div className="space-y-2">
            <Label>Novo status</Label>
            <Select
              value={formData.actionConfig.newStatus as string || ""}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  actionConfig: { ...formData.actionConfig, newStatus: value },
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contacted">Contactado</SelectItem>
                <SelectItem value="qualified">Qualificado</SelectItem>
                <SelectItem value="proposal">Proposta</SelectItem>
                <SelectItem value="won">Ganho</SelectItem>
                <SelectItem value="lost">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case "add_tag":
        return (
          <div className="space-y-2">
            <Label>Nome da tag</Label>
            <Input
              placeholder="Ex: interessado, vip"
              value={formData.actionConfig.tag as string || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  actionConfig: { ...formData.actionConfig, tag: e.target.value },
                })
              }
            />
          </div>
        );
      case "webhook":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <Input
                placeholder="https://..."
                value={formData.actionConfig.webhookUrl as string || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    actionConfig: { ...formData.actionConfig, webhookUrl: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <Select
                value={formData.actionConfig.method as string || "POST"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    actionConfig: { ...formData.actionConfig, method: value },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/automations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Nova Automação</h1>
          <p className="text-muted-foreground">
            Configure ações automáticas baseadas em eventos
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Automação</Label>
              <Input
                id="name"
                placeholder="Ex: Boas-vindas para novos leads"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Automação ativa</Label>
                <p className="text-sm text-muted-foreground">
                  Desative para pausar a execução
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Trigger */}
        <Card>
          <CardHeader>
            <CardTitle>Gatilho</CardTitle>
            <CardDescription>
              Quando a automação deve ser executada?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {triggerTypes.map((trigger) => (
                <div
                  key={trigger.value}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    formData.triggerType === trigger.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      triggerType: trigger.value,
                      triggerConfig: {},
                    })
                  }
                >
                  <trigger.icon className="h-6 w-6 text-primary mb-2" />
                  <p className="font-medium text-white">{trigger.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {trigger.description}
                  </p>
                </div>
              ))}
            </div>

            {formData.triggerType && (
              <div className="pt-4 border-t border-border">
                {renderTriggerConfig()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action */}
        {formData.triggerType && (
          <Card>
            <CardHeader>
              <CardTitle>Ação</CardTitle>
              <CardDescription>O que deve acontecer?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {actionTypes.map((action) => (
                  <div
                    key={action.value}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      formData.actionType === action.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        actionType: action.value,
                        actionConfig: {},
                      })
                    }
                  >
                    <p className="font-medium text-white">{action.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                ))}
              </div>

              {formData.actionType && (
                <div className="pt-4 border-t border-border">
                  {renderActionConfig()}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link href="/automations">
            <Button variant="outline" type="button">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Automação
          </Button>
        </div>
      </form>
    </div>
  );
}
