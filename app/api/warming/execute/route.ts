import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { processWarmingSessions } from "@/lib/warming/processor";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

// POST /api/warming/execute - Execute pending warming actions (called by cron)
export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Allow either CRON_SECRET or service role for internal calls
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Try to verify as authenticated user
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // For manual testing, allow authenticated users
    const token = authHeader?.replace("Bearer ", "");
    if (token) {
      const supabase = createAdminClient(supabaseUrl, supabaseServiceKey);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await processWarmingSessions();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Warming processor error:", error);
    return NextResponse.json(
      {
        error: "Processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint for health check / manual trigger
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const run = searchParams.get("run");

  if (run === "true") {
    // Redirect to POST
    return POST(request);
  }

  return NextResponse.json({
    status: "ok",
    message: "Warming executor is ready. POST to execute or GET with ?run=true",
  });
}
