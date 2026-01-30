"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  settings: Record<string, unknown>;
}

export default function CompanySettingsPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    logo_url: "",
    primary_color: "#DC2626",
  });
  const supabase = createClient();

  useEffect(() => {
    loadTenant();
  }, []);

  const loadTenant = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) return;

    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenantUser.tenant_id)
      .single();

    if (error) {
      console.error("Error loading tenant:", error);
      toast.error("Erro ao carregar dados da empresa");
    } else if (data) {
      setTenant(data);
      setFormData({
        name: data.name || "",
        logo_url: data.logo_url || "",
        primary_color: data.primary_color || "#DC2626",
      });
    }
    setLoading(false);
  };

  const saveTenant = async () => {
    if (!tenant) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          name: formData.name,
          logo_url: formData.logo_url || null,
          primary_color: formData.primary_color,
        })
        .eq("id", tenant.id);

      if (error) throw error;

      toast.success("Dados salvos com sucesso!");
      loadTenant();
    } catch (error) {
      console.error("Error saving tenant:", error);
      toast.error("Erro ao salvar dados");
    } finally {
      setSaving(false);
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
      <Card>
        <CardHeader>
          <CardTitle>Dados da Empresa</CardTitle>
          <CardDescription>
            Configure as informações da sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Empresa</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo">URL do Logo</Label>
            <Input
              id="logo"
              placeholder="https://exemplo.com/logo.png"
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
            />
            {formData.logo_url && (
              <div className="mt-2 p-4 border border-border rounded-lg">
                <img
                  src={formData.logo_url}
                  alt="Logo preview"
                  className="h-16 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Cor Primária</Label>
            <div className="flex items-center gap-3">
              <Input
                id="color"
                type="color"
                className="w-16 h-10 p-1 cursor-pointer"
                value={formData.primary_color}
                onChange={(e) =>
                  setFormData({ ...formData, primary_color: e.target.value })
                }
              />
              <Input
                value={formData.primary_color}
                onChange={(e) =>
                  setFormData({ ...formData, primary_color: e.target.value })
                }
                className="w-32"
              />
            </div>
          </div>

          <div className="pt-4">
            <Button onClick={saveTenant} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Identificador</CardTitle>
          <CardDescription>
            Informações de identificação da sua conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input readOnly value={tenant?.slug || ""} className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              O slug é usado para identificar sua conta e não pode ser alterado
            </p>
          </div>

          <div className="space-y-2">
            <Label>ID da Conta</Label>
            <Input readOnly value={tenant?.id || ""} className="bg-muted font-mono text-xs" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
