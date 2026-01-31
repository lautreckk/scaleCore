import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/warming/templates - Get message templates
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get tenant
  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get("category");

  // Get global templates (tenant_id IS NULL) and tenant-specific templates
  let query = supabase
    .from("warming_message_templates")
    .select("*")
    .eq("is_active", true)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantUser.tenant_id}`)
    .order("category")
    .order("usage_count", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data: templates, error } = await query;

  if (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by category
  const grouped = templates?.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, typeof templates>);

  return NextResponse.json({
    data: templates,
    grouped,
    categories: Object.keys(grouped || {}),
  });
}

// POST /api/warming/templates - Create custom template
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get tenant
  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const body = await request.json();
  const { category, content, can_start_conversation, can_continue_conversation, language } = body;

  if (!category || !content) {
    return NextResponse.json(
      { error: "Category and content are required" },
      { status: 400 }
    );
  }

  const { data: template, error } = await supabase
    .from("warming_message_templates")
    .insert({
      tenant_id: tenantUser.tenant_id,
      category,
      content,
      can_start_conversation: can_start_conversation ?? true,
      can_continue_conversation: can_continue_conversation ?? true,
      language: language || "pt-BR",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: template }, { status: 201 });
}

// DELETE /api/warming/templates - Delete custom template
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get tenant
  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const templateId = searchParams.get("id");

  if (!templateId) {
    return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
  }

  // Only delete tenant-specific templates (not global ones)
  const { error } = await supabase
    .from("warming_message_templates")
    .delete()
    .eq("id", templateId)
    .eq("tenant_id", tenantUser.tenant_id);

  if (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
