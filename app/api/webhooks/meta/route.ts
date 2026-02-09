import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = "sena_works_verify_2026";

// GET - Webhook Verification (Meta challenge handshake)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Meta Webhook] Verification successful");
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[Meta Webhook] Verification failed - invalid token");
  return new Response("Forbidden", { status: 403 });
}

// POST - Receive webhook events from Meta
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log(
      "[Meta Webhook] Event received:",
      JSON.stringify(body, null, 2)
    );

    // Log each entry for debugging
    if (body.entry) {
      for (const entry of body.entry) {
        console.log("[Meta Webhook] Entry ID:", entry.id);

        if (entry.changes) {
          for (const change of entry.changes) {
            console.log("[Meta Webhook] Change field:", change.field);
            console.log(
              "[Meta Webhook] Change value:",
              JSON.stringify(change.value, null, 2)
            );

            // Log message status updates
            if (change.value?.statuses) {
              for (const status of change.value.statuses) {
                console.log(
                  `[Meta Webhook] Message ${status.id} -> ${status.status}`
                );
              }
            }

            // Log incoming messages
            if (change.value?.messages) {
              for (const msg of change.value.messages) {
                console.log(
                  `[Meta Webhook] Message from ${msg.from}: type=${msg.type}`
                );
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Meta Webhook] Error processing event:", error);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
