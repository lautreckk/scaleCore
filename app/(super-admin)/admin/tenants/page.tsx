"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate, formatCurrency, PLANS } from "@/lib/utils";
import {
  Plus,
  Search,
  Building2,
  ChevronRight,
  Users,
  MoreVertical,
} from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  monthly_price: number;
  created_at: string;
  _count: {
    users: number;
    leads: number;
  };
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const supabase = createClient();

  useEffect(() => {
    const loadTenants = async () => {
      let query = supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });

      if (search) {
        query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
      }

      const { data } = await query;

      // Get counts for each tenant
      const tenantsWithCounts = await Promise.all(
        (data || []).map(async (tenant) => {
          const [usersResult, leadsResult] = await Promise.all([
            supabase
              .from("tenant_users")
              .select("id", { count: "exact", head: true })
              .eq("tenant_id", tenant.id),
            supabase
              .from("leads")
              .select("id", { count: "exact", head: true })
              .eq("tenant_id", tenant.id),
          ]);

          return {
            ...tenant,
            _count: {
              users: usersResult.count || 0,
              leads: leadsResult.count || 0,
            },
          };
        })
      );

      setTenants(tenantsWithCounts);
      setLoading(false);
    };

    loadTenants();
  }, [supabase, search]);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-500/10 text-green-500",
      trial: "bg-yellow-500/10 text-yellow-500",
      suspended: "bg-red-500/10 text-red-500",
      cancelled: "bg-gray-500/10 text-gray-500",
    };

    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          colors[status] || colors.cancelled
        }`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-muted-foreground">Gerencie os clientes da plataforma</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Tenant
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar tenants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tenants List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-surface-elevated rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Nenhum tenant encontrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie seu primeiro tenant para começar.
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Criar Tenant
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tenants.map((tenant) => (
            <Link key={tenant.id} href={`/admin/tenants/${tenant.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {tenant.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">{tenant.name}</h3>
                        {getStatusBadge(tenant.status || "trial")}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{tenant.slug}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {tenant._count.users} usuários
                        </span>
                        <span>{tenant._count.leads} leads</span>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="font-medium text-white">
                        {formatCurrency(tenant.monthly_price || 0)}
                        <span className="text-muted-foreground text-sm">/mês</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {PLANS.find((p) => p.value === tenant.plan)?.label || tenant.plan}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
