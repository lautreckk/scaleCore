import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

// GET /api/team/invites - List pending invites
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { data: invites, error } = await supabase
      .from("tenant_invites")
      .select(`
        *,
        departments:department_id(id, name, color),
        invited_by_user:invited_by(id, name, email)
      `)
      .eq("tenant_id", tenantUser.tenant_id)
      .in("status", ["pending"])
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(invites || []);
  } catch (error) {
    console.error("Error fetching invites:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/team/invites - Create a new invite
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, id, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser || !["owner", "admin", "manager"].includes(tenantUser.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, role, department_ids, permissions, max_concurrent_chats } = body;

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user already exists in tenant
    const { data: existingUser } = await supabase
      .from("tenant_users")
      .select("id")
      .eq("tenant_id", tenantUser.tenant_id)
      .eq("email", email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email já é um membro da equipe" },
        { status: 400 }
      );
    }

    // Check if there's already a pending invite
    const { data: existingInvite } = await supabase
      .from("tenant_invites")
      .select("id")
      .eq("tenant_id", tenantUser.tenant_id)
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: "Já existe um convite pendente para este email" },
        { status: 400 }
      );
    }

    // Managers can only invite agents and viewers
    if (tenantUser.role === "manager" && !["agent", "viewer"].includes(role)) {
      return NextResponse.json(
        { error: "Você só pode convidar agentes e visualizadores" },
        { status: 403 }
      );
    }

    // Generate unique token
    const token = randomBytes(32).toString("hex");

    // Create the invite
    const { data: invite, error } = await supabase
      .from("tenant_invites")
      .insert({
        tenant_id: tenantUser.tenant_id,
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        role: role || "agent",
        department_id: department_ids?.[0] || null, // Primary department
        permissions: permissions || null,
        invited_by: tenantUser.id,
        token,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    // If multiple departments, add to junction table
    if (department_ids && department_ids.length > 0 && invite) {
      // Store department assignments in invite metadata
      await supabase
        .from("tenant_invites")
        .update({
          permissions: {
            ...(permissions || {}),
            _department_ids: department_ids,
            _max_concurrent_chats: max_concurrent_chats || 10,
          }
        })
        .eq("id", invite.id);
    }

    // TODO: Send email with invite link
    // For now, just return the invite with the token
    // In production, you would send an email like:
    // await sendInviteEmail(email, token, tenantName);

    return NextResponse.json({
      ...invite,
      invite_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite/${token}`,
    });
  } catch (error) {
    console.error("Error creating invite:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/team/invites - Cancel an invite
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser || !["owner", "admin", "manager"].includes(tenantUser.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Verify invite belongs to tenant
    const { data: existingInvite } = await supabase
      .from("tenant_invites")
      .select("id, status")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!existingInvite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (existingInvite.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending invites can be cancelled" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("tenant_invites")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling invite:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
