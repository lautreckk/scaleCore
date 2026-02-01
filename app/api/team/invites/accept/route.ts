import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/team/invites/accept - Accept an invite and create user account
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { token, password, name } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Find the invite
    const { data: invite, error: inviteError } = await supabase
      .from("tenant_invites")
      .select(`
        *,
        tenants:tenant_id(id, name, slug)
      `)
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: "Convite inválido ou expirado" },
        { status: 404 }
      );
    }

    // Check if invite expired
    if (new Date(invite.expires_at) < new Date()) {
      await supabase
        .from("tenant_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);

      return NextResponse.json(
        { error: "Este convite expirou" },
        { status: 400 }
      );
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        data: {
          name: name || invite.name || invite.email.split("@")[0],
        },
      },
    });

    if (authError) {
      // Check if user already exists
      if (authError.message.includes("already registered")) {
        return NextResponse.json(
          { error: "Este email já possui uma conta. Faça login." },
          { status: 400 }
        );
      }
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Erro ao criar conta" },
        { status: 500 }
      );
    }

    // Get permissions and settings from invite
    const permissions = invite.permissions || {};
    const departmentIds = permissions._department_ids || [];
    const maxConcurrentChats = permissions._max_concurrent_chats || 10;

    // Remove internal fields from permissions
    delete permissions._department_ids;
    delete permissions._max_concurrent_chats;

    // Create tenant_user record
    const { data: tenantUser, error: tenantUserError } = await supabase
      .from("tenant_users")
      .insert({
        tenant_id: invite.tenant_id,
        user_id: authData.user.id,
        name: name || invite.name || invite.email.split("@")[0],
        email: invite.email,
        role: invite.role || "agent",
        department_id: invite.department_id || (departmentIds.length > 0 ? departmentIds[0] : null),
        permissions: Object.keys(permissions).length > 0 ? permissions : undefined,
        max_concurrent_chats: maxConcurrentChats,
        status: "active",
      })
      .select()
      .single();

    if (tenantUserError) {
      console.error("Tenant user error:", tenantUserError);
      // Try to clean up auth user if tenant_user creation fails
      return NextResponse.json(
        { error: "Erro ao associar usuário à equipe" },
        { status: 500 }
      );
    }

    // Add user to additional departments if any
    if (departmentIds.length > 1 && tenantUser) {
      const departmentInserts = departmentIds.slice(1).map((deptId: string) => ({
        tenant_user_id: tenantUser.id,
        department_id: deptId,
      }));

      await supabase
        .from("user_departments")
        .insert(departmentInserts);
    }

    // Mark invite as accepted
    await supabase
      .from("tenant_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    return NextResponse.json({
      success: true,
      message: "Conta criada com sucesso!",
      tenant: invite.tenants,
    });
  } catch (error) {
    console.error("Error accepting invite:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/team/invites/accept?token=xxx - Get invite details
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    const { data: invite, error } = await supabase
      .from("tenant_invites")
      .select(`
        id,
        email,
        name,
        role,
        status,
        expires_at,
        tenants:tenant_id(id, name, logo_url)
      `)
      .eq("token", token)
      .single();

    if (error || !invite) {
      return NextResponse.json(
        { error: "Convite não encontrado" },
        { status: 404 }
      );
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "Este convite já foi utilizado ou cancelado", status: invite.status },
        { status: 400 }
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Este convite expirou", status: "expired" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      email: invite.email,
      name: invite.name,
      role: invite.role,
      tenant: invite.tenants,
    });
  } catch (error) {
    console.error("Error fetching invite:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
