"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "@/components/tenant/layout/sidebar";
import { Header } from "@/components/tenant/layout/header";
import { Loader2 } from "lucide-react";

interface UserData {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  tenant_id: string;
  role: string;
}

interface TenantData {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [tenantData, setTenantData] = useState<TenantData | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Check if super admin (redirect to admin panel)
      const { data: superAdmin } = await supabase
        .from("super_admins")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (superAdmin) {
        router.push("/admin/dashboard");
        return;
      }

      // Get tenant user data
      const { data: tenantUser, error } = await supabase
        .from("tenant_users")
        .select(`
          id,
          name,
          email,
          avatar_url,
          tenant_id,
          role,
          tenants (
            id,
            name,
            slug,
            plan
          )
        `)
        .eq("user_id", user.id)
        .single();

      if (error || !tenantUser) {
        router.push("/login");
        return;
      }

      setUserData({
        id: tenantUser.id,
        name: tenantUser.name,
        email: tenantUser.email,
        avatar_url: tenantUser.avatar_url,
        tenant_id: tenantUser.tenant_id!,
        role: tenantUser.role!,
      });

      const tenant = tenantUser.tenants as unknown as TenantData;
      setTenantData(tenant);
      setLoading(false);
    };

    loadUserData();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userData || !tenantData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          user={userData}
          tenant={tenantData}
        />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
