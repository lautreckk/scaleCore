import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a super admin
    const { data: superAdmin } = await supabase
      .from("super_admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!superAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { tenantId, amount } = await request.json();

    if (!tenantId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 }
      );
    }

    // Add credits using RPC function
    const { error } = await supabase.rpc("add_wallet_credits", {
      p_tenant_id: tenantId,
      p_amount: amount,
      p_description: "Créditos adicionados pelo administrador",
    });

    if (error) {
      console.error("Error adding credits:", error);
      return NextResponse.json(
        { error: "Failed to add credits" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in admin credits:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
