import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/tarefas/tasks/[id]/attachments - Get all attachments for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Verify task belongs to tenant
    const { data: task } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", taskId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const { data: attachments, error } = await supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json(attachments || []);
  } catch (error) {
    console.error("Error fetching attachments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/tarefas/tasks/[id]/attachments - Create attachment record
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("id, tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Verify task belongs to tenant
    const { data: task } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", taskId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = await request.json();
    const { file_name, file_url, file_type, file_size } = body;

    if (!file_name || !file_url || !file_type || file_size === undefined) {
      return NextResponse.json(
        { error: "file_name, file_url, file_type, and file_size are required" },
        { status: 400 }
      );
    }

    const { data: attachment, error } = await supabase
      .from("task_attachments")
      .insert({
        task_id: taskId,
        file_name,
        file_url,
        file_type,
        file_size,
        uploaded_by: tenantUser.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(attachment);
  } catch (error) {
    console.error("Error creating attachment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tarefas/tasks/[id]/attachments - Delete an attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get("attachment_id");

    if (!attachmentId) {
      return NextResponse.json({ error: "attachment_id is required" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Verify task belongs to tenant
    const { data: task } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", taskId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get attachment to find file path for storage deletion
    const { data: attachment } = await supabase
      .from("task_attachments")
      .select("file_url")
      .eq("id", attachmentId)
      .eq("task_id", taskId)
      .single();

    if (attachment?.file_url) {
      // Extract storage path from public URL
      const match = attachment.file_url.match(/\/chat-media\/(.+)$/);
      if (match) {
        await supabase.storage.from("chat-media").remove([match[1]]);
      }
    }

    const { error } = await supabase
      .from("task_attachments")
      .delete()
      .eq("id", attachmentId)
      .eq("task_id", taskId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
