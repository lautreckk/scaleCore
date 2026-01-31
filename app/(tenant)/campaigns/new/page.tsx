"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadSelector } from "@/components/campaigns/lead-selector";
import { MessageComposer, CampaignMessage } from "@/components/campaigns/message-composer";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Smartphone,
  Users,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Tag,
} from "lucide-react";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
}

interface FilterCriteria {
  tags?: string[];
  status?: string[];
  sources?: string[];
  kanban_board_id?: string;
  kanban_stage_id?: string;
  assigned_to?: string;
  score_min?: number;
  score_max?: number;
  created_after?: string;
  created_before?: string;
}

const steps = [
  { id: 1, title: "Configuração", icon: Smartphone },
  { id: 2, title: "Leads", icon: Users },
  { id: 3, title: "Mensagens", icon: MessageSquare },
  { id: 4, title: "Timing", icon: Clock },
  { id: 5, title: "Confirmação", icon: CheckCircle },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  // Data
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);

  // Form data
  const [formData, setFormData] = useState({
    name: "",
    instanceId: "",
    tags: [] as string[],
    newTag: "",
  });

  // Lead selection
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({});

  // Messages
  const [messages, setMessages] = useState<CampaignMessage[]>([
    {
      id: crypto.randomUUID(),
      message_type: "text",
      content: "",
      delay_after: 0,
    },
  ]);
  const [delayBetweenMessages, setDelayBetweenMessages] = useState(3);

  // Timing
  const [delayBetweenRecipients, setDelayBetweenRecipients] = useState(5);
  const [scheduledAt, setScheduledAt] = useState("");

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

    const [instancesResult, walletResult] = await Promise.all([
      supabase
        .from("whatsapp_instances")
        .select("id, instance_name, phone_number, status")
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("status", "connected"),
      supabase
        .from("wallets")
        .select("balance")
        .eq("tenant_id", tenantUser.tenant_id)
        .single(),
    ]);

    setInstances(instancesResult.data || []);
    setWalletBalance(walletResult.data?.balance || 0);
    setLoading(false);
  };

  const getEstimatedCost = () => {
    const recipientCount = selectedLeads.length;
    const messageCount = messages.length || 1;
    const costPerMessage = 0.12;
    return recipientCount * messageCount * costPerMessage;
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name.trim() && formData.instanceId;
      case 2:
        return selectedLeads.length > 0;
      case 3:
        return messages.length > 0 && messages.every((m) => m.content.trim() || m.media_url);
      case 4:
        return delayBetweenRecipients >= 1;
      case 5:
        return walletBalance >= getEstimatedCost();
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (canProceed() && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const addTag = () => {
    if (formData.newTag.trim() && !formData.tags.includes(formData.newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, formData.newTag.trim()],
        newTag: "",
      });
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
  };

  const createCampaign = async () => {
    if (!tenantId) return;

    setCreating(true);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          instance_id: formData.instanceId,
          tags: formData.tags,
          messages: messages.map((m, i) => ({
            message_type: m.message_type,
            content: m.content,
            media_url: m.media_url,
            media_mimetype: m.media_mimetype,
            file_name: m.file_name,
            delay_after: m.delay_after,
          })),
          filter_criteria: filterCriteria,
          delay_between_messages: delayBetweenMessages,
          delay_between_recipients: delayBetweenRecipients,
          scheduled_at: scheduledAt || null,
          leads: selectedLeads,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create campaign");
      }

      const data = await response.json();
      toast.success("Campanha criada com sucesso!");
      router.push(`/campaigns/${data.campaign.id}`);
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao criar campanha");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nova Campanha</h1>
          <p className="text-muted-foreground">
            Configure e envie mensagens em massa
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between overflow-x-auto pb-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex items-center gap-2 ${
                currentStep >= step.id
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  currentStep >= step.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > step.id ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              <span className="hidden md:block font-medium whitespace-nowrap">
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-8 md:w-16 h-0.5 mx-2 ${
                  currentStep > step.id ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {/* Step 1: Configuration */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <CardHeader className="p-0">
                <CardTitle>Configuração Básica</CardTitle>
                <CardDescription>
                  Defina o nome e a instância WhatsApp para a campanha
                </CardDescription>
              </CardHeader>

              <div className="space-y-2">
                <Label htmlFor="name">Nome da Campanha</Label>
                <Input
                  id="name"
                  placeholder="Ex: Black Friday 2024"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Instância do WhatsApp</Label>
                {instances.length === 0 ? (
                  <div className="p-4 rounded-lg border text-center">
                    <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-muted-foreground">
                      Nenhuma instância conectada
                    </p>
                    <Link href="/settings/integrations">
                      <Button variant="link" className="mt-2">
                        Conectar WhatsApp
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Select
                    value={formData.instanceId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, instanceId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma instância" />
                    </SelectTrigger>
                    <SelectContent>
                      {instances.map((instance) => (
                        <SelectItem key={instance.id} value={instance.id}>
                          {instance.instance_name}
                          {instance.phone_number && ` (${instance.phone_number})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tags da campanha</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Adicionar tag..."
                    value={formData.newTag}
                    onChange={(e) =>
                      setFormData({ ...formData, newTag: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button variant="outline" onClick={addTag}>
                    <Tag className="h-4 w-4" />
                  </Button>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeTag(tag)}
                      >
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Lead Selection */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <CardHeader className="p-0">
                <CardTitle>Seleção de Leads</CardTitle>
                <CardDescription>
                  Escolha os leads que receberão a campanha
                </CardDescription>
              </CardHeader>

              <LeadSelector
                selectedLeads={selectedLeads}
                onSelectionChange={setSelectedLeads}
                filterCriteria={filterCriteria}
                onFilterChange={setFilterCriteria}
              />
            </div>
          )}

          {/* Step 3: Message Composition */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <CardHeader className="p-0">
                <CardTitle>Composição de Mensagens</CardTitle>
                <CardDescription>
                  Adicione uma ou mais mensagens para enviar aos leads
                </CardDescription>
              </CardHeader>

              <MessageComposer
                messages={messages}
                onChange={setMessages}
                delayBetweenMessages={delayBetweenMessages}
                onDelayChange={setDelayBetweenMessages}
              />
            </div>
          )}

          {/* Step 4: Timing */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <CardHeader className="p-0">
                <CardTitle>Configuração de Tempo</CardTitle>
                <CardDescription>
                  Defina os intervalos e agendamento da campanha
                </CardDescription>
              </CardHeader>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="delay">Intervalo entre destinatários</Label>
                  <Select
                    value={String(delayBetweenRecipients)}
                    onValueChange={(v) => setDelayBetweenRecipients(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 segundos</SelectItem>
                      <SelectItem value="10">10 segundos</SelectItem>
                      <SelectItem value="15">15 segundos</SelectItem>
                      <SelectItem value="30">30 segundos</SelectItem>
                      <SelectItem value="60">1 minuto</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Intervalo entre cada destinatário para evitar bloqueio
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule">Agendar envio (opcional)</Label>
                  <Input
                    id="schedule"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio para enviar imediatamente
                  </p>
                </div>
              </div>

              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Tempo estimado: ~
                      {Math.ceil(
                        (selectedLeads.length * delayBetweenRecipients) / 60
                      )}{" "}
                      minutos para {selectedLeads.length} destinatários
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 5: Confirmation */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <CardHeader className="p-0">
                <CardTitle>Revisão e Confirmação</CardTitle>
                <CardDescription>
                  Verifique os detalhes antes de criar a campanha
                </CardDescription>
              </CardHeader>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="text-lg font-medium">{formData.name}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Destinatários</p>
                    <p className="text-lg font-medium">
                      {selectedLeads.length} leads
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Mensagens</p>
                    <p className="text-lg font-medium">
                      {messages.length} por destinatário
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total de envios</p>
                    <p className="text-lg font-medium">
                      {selectedLeads.length * messages.length} mensagens
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Custo Estimado</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(getEstimatedCost())}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      R$ 0,12 × {selectedLeads.length} leads × {messages.length}{" "}
                      mensagens
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                    <p
                      className={`text-2xl font-bold ${
                        walletBalance >= getEstimatedCost()
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {formatCurrency(walletBalance)}
                    </p>
                    {walletBalance < getEstimatedCost() && (
                      <Link href="/credits">
                        <Button variant="link" size="sm" className="p-0 h-auto mt-1">
                          Adicionar créditos
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              </div>

              {walletBalance < getEstimatedCost() && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Saldo insuficiente</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Adicione créditos para enviar esta campanha.
                  </p>
                </div>
              )}

              {formData.tags.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Tags:</span>
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Preview da primeira mensagem</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 max-w-[80%]">
                    <p className="text-sm whitespace-pre-wrap">
                      {messages[0]?.content || "(Sem conteúdo)"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Anterior
        </Button>

        {currentStep < 5 ? (
          <Button onClick={nextStep} disabled={!canProceed()}>
            Próximo
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={createCampaign}
            disabled={creating || walletBalance < getEstimatedCost()}
          >
            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {scheduledAt ? "Agendar Campanha" : "Criar Campanha"}
          </Button>
        )}
      </div>
    </div>
  );
}
