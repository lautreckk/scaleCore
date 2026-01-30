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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Smartphone,
  Users,
  MessageSquare,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
}

interface ContactList {
  id: string;
  name: string;
  member_count: number;
}

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  status: string;
}

const steps = [
  { id: 1, title: "Configuração", icon: Smartphone },
  { id: 2, title: "Destinatários", icon: Users },
  { id: 3, title: "Mensagem", icon: MessageSquare },
  { id: 4, title: "Confirmação", icon: CheckCircle },
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
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  // Form data
  const [formData, setFormData] = useState({
    name: "",
    instanceId: "",
    selectionType: "list" as "list" | "leads" | "manual",
    contactListId: "",
    selectedLeads: [] as string[],
    manualNumbers: "",
    messageTemplate: "",
    delay: 5,
    scheduledAt: "",
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

    // Load all data in parallel
    const [instancesResult, listsResult, leadsResult, walletResult] = await Promise.all([
      supabase
        .from("whatsapp_instances")
        .select("id, instance_name, phone_number, status")
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("status", "connected"),
      supabase
        .from("contact_lists")
        .select("id, name, member_count")
        .eq("tenant_id", tenantUser.tenant_id),
      supabase
        .from("leads")
        .select("id, name, phone, status")
        .eq("tenant_id", tenantUser.tenant_id)
        .not("phone", "is", null)
        .order("name"),
      supabase
        .from("wallets")
        .select("balance")
        .eq("tenant_id", tenantUser.tenant_id)
        .single(),
    ]);

    setInstances(instancesResult.data || []);
    setContactLists(listsResult.data || []);
    setLeads(leadsResult.data || []);
    setWalletBalance(walletResult.data?.balance || 0);
    setLoading(false);
  };

  const getRecipientCount = () => {
    switch (formData.selectionType) {
      case "list":
        const list = contactLists.find((l) => l.id === formData.contactListId);
        return list?.member_count || 0;
      case "leads":
        return formData.selectedLeads.length;
      case "manual":
        return formData.manualNumbers
          .split("\n")
          .filter((n) => n.trim()).length;
      default:
        return 0;
    }
  };

  const getEstimatedCost = () => {
    const recipientCount = getRecipientCount();
    const costPerMessage = 0.12;
    return recipientCount * costPerMessage;
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name.trim() && formData.instanceId;
      case 2:
        return getRecipientCount() > 0;
      case 3:
        return formData.messageTemplate.trim();
      case 4:
        return walletBalance >= getEstimatedCost();
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (canProceed() && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const createCampaign = async () => {
    if (!tenantId) return;

    setCreating(true);
    try {
      const recipientCount = getRecipientCount();
      const estimatedCost = getEstimatedCost();

      // Create campaign
      const { data: campaign, error } = await supabase
        .from("campaigns")
        .insert({
          tenant_id: tenantId,
          instance_id: formData.instanceId,
          name: formData.name,
          message_template: formData.messageTemplate,
          total_recipients: recipientCount,
          estimated_cost: estimatedCost,
          settings: {
            delay: formData.delay,
            selectionType: formData.selectionType,
          },
          status: formData.scheduledAt ? "scheduled" : "draft",
          scheduled_at: formData.scheduledAt || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add recipients based on selection type
      let recipients: { campaign_id: string; phone: string; lead_id?: string }[] = [];

      if (formData.selectionType === "list" && formData.contactListId) {
        // Get members from contact list
        const { data: members } = await supabase
          .from("contact_list_members")
          .select("phone, lead_id")
          .eq("list_id", formData.contactListId);

        recipients = (members || []).map((m) => ({
          campaign_id: campaign.id,
          phone: m.phone,
          lead_id: m.lead_id,
        }));
      } else if (formData.selectionType === "leads") {
        // Get selected leads
        const selectedLeads = leads.filter((l) =>
          formData.selectedLeads.includes(l.id)
        );
        recipients = selectedLeads
          .filter((l) => l.phone)
          .map((l) => ({
            campaign_id: campaign.id,
            phone: l.phone!,
            lead_id: l.id,
          }));
      } else if (formData.selectionType === "manual") {
        // Parse manual numbers
        const numbers = formData.manualNumbers
          .split("\n")
          .map((n) => n.trim())
          .filter((n) => n);
        recipients = numbers.map((phone) => ({
          campaign_id: campaign.id,
          phone,
        }));
      }

      // Insert campaign sends
      if (recipients.length > 0) {
        await supabase.from("campaign_sends").insert(recipients);
      }

      toast.success("Campanha criada com sucesso!");
      router.push(`/campaigns/${campaign.id}`);
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast.error("Erro ao criar campanha");
    } finally {
      setCreating(false);
    }
  };

  const toggleLeadSelection = (leadId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedLeads: prev.selectedLeads.includes(leadId)
        ? prev.selectedLeads.filter((id) => id !== leadId)
        : [...prev.selectedLeads, leadId],
    }));
  };

  const selectAllLeads = () => {
    setFormData((prev) => ({
      ...prev,
      selectedLeads: leads.map((l) => l.id),
    }));
  };

  const deselectAllLeads = () => {
    setFormData((prev) => ({
      ...prev,
      selectedLeads: [],
    }));
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
          <h1 className="text-2xl font-bold text-white">Nova Campanha</h1>
          <p className="text-muted-foreground">
            Configure e envie mensagens em massa
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
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
                className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  currentStep >= step.id
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > step.id ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              <span className="hidden sm:block font-medium">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-12 sm:w-24 h-0.5 mx-2 ${
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
                  <div className="p-4 rounded-lg border border-border text-center">
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
                <Label htmlFor="delay">Intervalo entre mensagens (segundos)</Label>
                <Input
                  id="delay"
                  type="number"
                  min={1}
                  max={60}
                  value={formData.delay}
                  onChange={(e) =>
                    setFormData({ ...formData, delay: parseInt(e.target.value) || 5 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Recomendado: 5-10 segundos para evitar bloqueio
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Recipients */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Selecionar destinatários</Label>
                <div className="grid grid-cols-3 gap-2">
                  {["list", "leads", "manual"].map((type) => (
                    <Button
                      key={type}
                      variant={formData.selectionType === type ? "default" : "outline"}
                      onClick={() =>
                        setFormData({ ...formData, selectionType: type as "list" | "leads" | "manual" })
                      }
                    >
                      {type === "list" && "Lista de Contatos"}
                      {type === "leads" && "Selecionar Leads"}
                      {type === "manual" && "Números Manual"}
                    </Button>
                  ))}
                </div>
              </div>

              {formData.selectionType === "list" && (
                <div className="space-y-2">
                  <Label>Lista de Contatos</Label>
                  {contactLists.length === 0 ? (
                    <p className="text-muted-foreground">
                      Nenhuma lista de contatos disponível
                    </p>
                  ) : (
                    <Select
                      value={formData.contactListId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, contactListId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma lista" />
                      </SelectTrigger>
                      <SelectContent>
                        {contactLists.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name} ({list.member_count} contatos)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {formData.selectionType === "leads" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Selecionar Leads</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllLeads}>
                        Selecionar todos
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAllLeads}>
                        Limpar
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-64 rounded-lg border border-border">
                    <div className="p-2 space-y-1">
                      {leads.map((lead) => (
                        <div
                          key={lead.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={() => toggleLeadSelection(lead.id)}
                        >
                          <Checkbox
                            checked={formData.selectedLeads.includes(lead.id)}
                            onCheckedChange={() => toggleLeadSelection(lead.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">
                              {lead.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {lead.phone}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-sm text-muted-foreground">
                    {formData.selectedLeads.length} leads selecionados
                  </p>
                </div>
              )}

              {formData.selectionType === "manual" && (
                <div className="space-y-2">
                  <Label htmlFor="numbers">Números de telefone</Label>
                  <Textarea
                    id="numbers"
                    placeholder="Digite um número por linha&#10;5511999999999&#10;5511888888888"
                    rows={8}
                    value={formData.manualNumbers}
                    onChange={(e) =>
                      setFormData({ ...formData, manualNumbers: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato: código do país + DDD + número (ex: 5511999999999)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Message */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  placeholder="Digite sua mensagem aqui..."
                  rows={8}
                  value={formData.messageTemplate}
                  onChange={(e) =>
                    setFormData({ ...formData, messageTemplate: e.target.value })
                  }
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Você pode usar variáveis: {"{{nome}}"}, {"{{empresa}}"}
                  </span>
                  <span>{formData.messageTemplate.length} caracteres</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedule">Agendar envio (opcional)</Label>
                <Input
                  id="schedule"
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduledAt: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="text-lg font-medium text-white">
                      {formData.name}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Destinatários</p>
                    <p className="text-lg font-medium text-white">
                      {getRecipientCount()} contatos
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Custo Estimado</p>
                    <p className="text-lg font-medium text-white">
                      {formatCurrency(getEstimatedCost())}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                    <p
                      className={`text-lg font-medium ${
                        walletBalance >= getEstimatedCost()
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {formatCurrency(walletBalance)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {walletBalance < getEstimatedCost() && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Saldo insuficiente</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Adicione créditos para enviar esta campanha.
                  </p>
                  <Link href="/credits">
                    <Button variant="outline" size="sm" className="mt-2">
                      Adicionar Créditos
                    </Button>
                  </Link>
                </div>
              )}

              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-2">
                  Prévia da mensagem:
                </p>
                <p className="text-white whitespace-pre-wrap">
                  {formData.messageTemplate}
                </p>
              </div>
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

        {currentStep < 4 ? (
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
            {formData.scheduledAt ? "Agendar Campanha" : "Criar Campanha"}
          </Button>
        )}
      </div>
    </div>
  );
}
