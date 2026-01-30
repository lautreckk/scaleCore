"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDate, formatCurrency, PLANS } from "@/lib/utils";
import {
  ArrowLeft,
  Building2,
  Users,
  MessageSquare,
  BarChart3,
  Wallet,
  Loader2,
  Save,
} from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  plan: string;
  status: string;
  max_users: number;
  max_leads: number;
  max_whatsapp_instances: number;
  max_campaigns_per_month: number;
  monthly_price: number;
  trial_ends_at: string | null;
  created_at: string;
}

interface TenantStats {
  users: number;
  leads: number;
  messages: number;
  walletBalance: number;
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [stats, setStats] = useState<TenantStats>({ users: 0, leads: 0, messages: 0, walletBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Tenant>>({});
  const supabase = createClient();

  useEffect(() => {
    loadTenant();
  }, [params.id]);

  const loadTenant = async () => {
    const { data: tenantData, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !tenantData) {
      toast.error("Tenant não encontrado");
      router.push("/admin/tenants");
      return;
    }

    setTenant(tenantData);
    setFormData(tenantData);

    // Load stats
    const [usersResult, leadsResult, walletResult] = await Promise.all([
      supabase
        .from("tenant_users")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", params.id),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", params.id),
      supabase
        .from("wallets")
        .select("balance")
        .eq("tenant_id", params.id)
        .single(),
    ]);

    setStats({
      users: usersResult.count || 0,
      leads: leadsResult.count || 0,
      messages: 0,
      walletBalance: walletResult.data?.balance || 0,
    });

    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          name: formData.name,
          slug: formData.slug,
          plan: formData.plan,
          status: formData.status,
          max_users: formData.max_users,
          max_leads: formData.max_leads,
          max_whatsapp_instances: formData.max_whatsapp_instances,
          max_campaigns_per_month: formData.max_campaigns_per_month,
          monthly_price: formData.monthly_price,
        })
        .eq("id", params.id);

      if (error) throw error;

      toast.success("Tenant atualizado com sucesso!");
      loadTenant();
    } catch (error) {
      console.error("Error updating tenant:", error);
      toast.error("Erro ao atualizar tenant");
    } finally {
      setSaving(false);
    }
  };

  const addCredits = async (amount: number) => {
    try {
      const response = await fetch("/api/admin/tenants/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: params.id, amount }),
      });

      if (!response.ok) {
        throw new Error("Erro ao adicionar créditos");
      }

      toast.success(`R$ ${amount.toFixed(2)} adicionados com sucesso!`);
      loadTenant();
    } catch (error) {
      toast.error("Erro ao adicionar créditos");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/tenants">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
          <p className="text-muted-foreground">{tenant.slug}</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.users}</p>
                <p className="text-xs text-muted-foreground">Usuários</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <BarChart3 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.leads}</p>
                <p className="text-xs text-muted-foreground">Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <MessageSquare className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.messages}</p>
                <p className="text-xs text-muted-foreground">Mensagens</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Wallet className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(stats.walletBalance)}
                </p>
                <p className="text-xs text-muted-foreground">Saldo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="limits">Limites</TabsTrigger>
          <TabsTrigger value="billing">Faturamento</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados do Tenant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={formData.name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={formData.slug || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select
                    value={formData.plan || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, plan: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLANS.map((plan) => (
                        <SelectItem key={plan.value} value={plan.value}>
                          {plan.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Criado em: {formatDate(tenant.created_at)}</p>
                {tenant.trial_ends_at && (
                  <p>Trial termina em: {formatDate(tenant.trial_ends_at)}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limits" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Limites do Plano</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Máximo de Usuários</Label>
                  <Input
                    type="number"
                    value={formData.max_users || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_users: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Máximo de Leads</Label>
                  <Input
                    type="number"
                    value={formData.max_leads || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_leads: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Máximo de Instâncias WhatsApp</Label>
                  <Input
                    type="number"
                    value={formData.max_whatsapp_instances || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_whatsapp_instances: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Campanhas por Mês</Label>
                  <Input
                    type="number"
                    value={formData.max_campaigns_per_month || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_campaigns_per_month: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Faturamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Valor Mensal (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.monthly_price || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      monthly_price: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Carteira de Créditos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-surface-elevated rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Atual</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(stats.walletBalance)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => addCredits(50)}>
                  + R$ 50
                </Button>
                <Button variant="outline" size="sm" onClick={() => addCredits(100)}>
                  + R$ 100
                </Button>
                <Button variant="outline" size="sm" onClick={() => addCredits(200)}>
                  + R$ 200
                </Button>
                <Button variant="outline" size="sm" onClick={() => addCredits(500)}>
                  + R$ 500
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
