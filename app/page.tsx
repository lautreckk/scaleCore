import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/marketing/landing-page";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Show landing page for non-authenticated users
  if (!user) {
    return <LandingPage />;
  }

  // Check if user is a super admin
  const { data: superAdmin } = await supabase
    .from("super_admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (superAdmin) {
    redirect("/admin/dashboard");
  }

  // Check if user is a tenant user
  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .single();

  if (tenantUser) {
    redirect("/dashboard");
  }

  // User exists but no role - redirect to onboarding or login
  redirect("/login");
}
