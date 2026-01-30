"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  Webhook,
  Plus,
  Copy,
  Trash2,
  Edit,
  Loader2,
  ExternalLink,
  Key,
} from "lucide-react";

interface LeadSource {
  id: string;
  name: string;
  source_type: string;
  webhook_url: string;
  webhook_secret: string;
  field_mapping: Record<string, string>;
  is_active: boolean;
  total_leads: number;
  created_at: string;
}

const defaultFieldMapping = {
  name: "name",
  email: "email",
  phone: "phone",
  company: "company",
};

export default function SourcesPage() {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<LeadSource | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    source_type: "webhook",
    field_mapping: JSON.stringify(defaultFieldMapping, null, 2),
    is_active: true,
  });
  const supabase = createClient();

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
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
      .from("lead_sources")
      .select("*")
      .eq("tenant_id", tenantUser.tenant_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading sources:", error);
      toast.error("Erro ao carregar fontes");
    } else {
      setSources(data || []);
    }
    setLoading(false);
  };

  const generateWebhookUrl = (sourceId: string) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/api/webhook/${sourceId}`;
  };

  const createSource = async () => {
    if (!formData.name.trim() || !tenantId) return;

    setCreating(true);
    try {
      let fieldMapping;
      try {
        fieldMapping = JSON.parse(formData.field_mapping);
      } catch {
        toast.error("Mapeamento de campos inválido");
        setCreating(false);
        return;
      }

      const webhookSecret = crypto.randomUUID();

      const { data, error } = await supabase
        .from("lead_sources")
        .insert({
          tenant_id: tenantId,
          name: formData.name,
          source_type: formData.source_type,
          webhook_secret: webhookSecret,
          field_mapping: fieldMapping,
          is_active: formData.is_active,
        })
        .select()
        .single();

      if (error) throw error;

      // Update with webhook URL
      await supabase
        .from("lead_sources")
        .update({ webhook_url: generateWebhookUrl(data.id) })
        .eq("id", data.id);

      toast.success("Fonte de leads criada com sucesso!");
      setDialogOpen(false);
      resetForm();
      loadSources();
    } catch (error) {
      console.error("Error creating source:", error);
      toast.error("Erro ao criar fonte de leads");
    } finally {
      setCreating(false);
    }
  };

  const updateSource = async () => {
    if (!editingSource || !formData.name.trim()) return;

    setCreating(true);
    try {
      let fieldMapping;
      try {
        fieldMapping = JSON.parse(formData.field_mapping);
      } catch {
        toast.error("Mapeamento de campos inválido");
        setCreating(false);
        return;
      }

      const { error } = await supabase
        .from("lead_sources")
        .update({
          name: formData.name,
          field_mapping: fieldMapping,
          is_active: formData.is_active,
        })
        .eq("id", editingSource.id);

      if (error) throw error;

      toast.success("Fonte atualizada com sucesso!");
      setDialogOpen(false);
      setEditingSource(null);
      resetForm();
      loadSources();
    } catch (error) {
      console.error("Error updating source:", error);
      toast.error("Erro ao atualizar fonte");
    } finally {
      setCreating(false);
    }
  };

  const deleteSource = async (source: LeadSource) => {
    if (!confirm("Tem certeza que deseja excluir esta fonte?")) return;

    try {
      const { error } = await supabase
        .from("lead_sources")
        .delete()
        .eq("id", source.id);

      if (error) throw error;

      toast.success("Fonte excluída");
      loadSources();
    } catch (error) {
      console.error("Error deleting source:", error);
      toast.error("Erro ao excluir fonte");
    }
  };

  const toggleSourceActive = async (source: LeadSource) => {
    try {
      const { error } = await supabase
        .from("lead_sources")
        .update({ is_active: !source.is_active })
        .eq("id", source.id);

      if (error) throw error;

      loadSources();
    } catch (error) {
      console.error("Error toggling source:", error);
      toast.error("Erro ao atualizar fonte");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      source_type: "webhook",
      field_mapping: JSON.stringify(defaultFieldMapping, null, 2),
      is_active: true,
    });
  };

  const openEditDialog = (source: LeadSource) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      source_type: source.source_type,
      field_mapping: JSON.stringify(source.field_mapping, null, 2),
      is_active: source.is_active,
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Fontes de Leads</CardTitle>
            <CardDescription>
              Configure webhooks para receber leads automaticamente
            </CardDescription>
          </div>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingSource(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Fonte
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingSource ? "Editar Fonte" : "Nova Fonte de Leads"}
                </DialogTitle>
                <DialogDescription>
                  Configure uma fonte para receber leads via webhook
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Fonte</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Landing Page Principal"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mapping">Mapeamento de Campos (JSON)</Label>
                  <Textarea
                    id="mapping"
                    className="font-mono text-sm"
                    rows={6}
                    value={formData.field_mapping}
                    onChange={(e) =>
                      setFormData({ ...formData, field_mapping: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Mapeie os campos do webhook para os campos do lead
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="active">Fonte Ativa</Label>
                  <Switch
                    id="active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={editingSource ? updateSource : createSource}
                  disabled={creating}
                >
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingSource ? "Salvar" : "Criar"}
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
          ) : sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Webhook className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Nenhuma fonte configurada
              </p>
              <p className="text-sm text-muted-foreground">
                Crie uma fonte para receber leads automaticamente
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="p-4 rounded-lg border border-border space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Webhook className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{source.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {source.total_leads || 0} leads recebidos
                        </p>
                      </div>
                      <Badge
                        variant={source.is_active ? "success" : "secondary"}
                      >
                        {source.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={source.is_active}
                        onCheckedChange={() => toggleSourceActive(source)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(source)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSource(source)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Webhook Details */}
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Webhook URL
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={source.webhook_url || generateWebhookUrl(source.id)}
                          className="font-mono text-xs"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              source.webhook_url || generateWebhookUrl(source.id),
                              "URL"
                            )
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Key className="h-3 w-3" />
                        Webhook Secret (para validação HMAC)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          type="password"
                          value={source.webhook_secret}
                          className="font-mono text-xs"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(source.webhook_secret, "Secret")
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Como Integrar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-white mb-2">Formato do Webhook</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Envie um POST request para a URL do webhook com o seguinte formato:
            </p>
            <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`{
  "name": "Nome do Lead",
  "email": "email@exemplo.com",
  "phone": "+5511999999999",
  "company": "Empresa"
}`}
            </pre>
          </div>

          <div>
            <h4 className="font-medium text-white mb-2">Validação HMAC (Opcional)</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Para validar a autenticidade do webhook, inclua o header:
            </p>
            <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`X-Webhook-Signature: sha256=<hmac_signature>`}
            </pre>
            <p className="text-sm text-muted-foreground mt-2">
              A assinatura deve ser o HMAC-SHA256 do body usando o webhook secret.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
