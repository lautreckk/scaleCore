"""
Modal worker for processing WhatsApp campaigns.
Designed for long-running jobs (2+ hours) with proper state management.
"""

import os
import time
import httpx
import modal

from supabase_client import SupabaseClient
from evolution_client import create_evolution_client
from message_processor import (
    process_recipient,
    check_wallet_balance,
    MESSAGE_COST
)


# Modal app configuration
app = modal.App("scalecore-campaign-worker")

# Define the image with required dependencies
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "supabase>=2.0.0",
    "httpx>=0.25.0",
    "pycryptodome>=3.19.0",
    "tenacity>=8.2.0",
)


@app.function(
    image=image,
    secrets=[
        modal.Secret.from_name("supabase-credentials"),
        modal.Secret.from_name("scalecore-credentials"),
    ],
    timeout=7200,  # 2 hours max
    retries=0,  # Handle retries manually for better control
)
def process_campaign(campaign_id: str, tenant_id: str) -> dict:
    """
    Process a campaign, sending all messages to all recipients.

    Args:
        campaign_id: UUID of the campaign to process
        tenant_id: UUID of the tenant (for billing)

    Returns:
        Final status dict with counts
    """
    supabase = SupabaseClient()

    result = {
        "campaign_id": campaign_id,
        "status": "completed",
        "sent_count": 0,
        "failed_count": 0,
        "total_recipients": 0,
        "error": None
    }

    try:
        # Load campaign with instance data
        campaign = supabase.get_campaign(campaign_id)
        if not campaign:
            raise ValueError(f"Campaign not found: {campaign_id}")

        # Verify campaign is still running
        if campaign["status"] != "running":
            result["status"] = campaign["status"]
            result["error"] = f"Campaign is {campaign['status']}, not running"
            return result

        # Get campaign messages
        messages = supabase.get_campaign_messages(campaign_id)
        if not messages:
            # Fall back to message_template for backward compatibility
            if campaign.get("message_template"):
                messages = [{
                    "id": "legacy",
                    "position": 0,
                    "message_type": "text",
                    "content": campaign["message_template"],
                    "delay_after": 0
                }]
            else:
                raise ValueError("Campaign has no messages")

        messages_per_recipient = len(messages)

        # Get Evolution client
        instance = campaign.get("whatsapp_instances")
        if not instance:
            raise ValueError("Campaign has no WhatsApp instance")

        encryption_key = os.environ.get("ENCRYPTION_KEY")
        if not encryption_key:
            raise ValueError("ENCRYPTION_KEY not set")

        evolution_client = create_evolution_client(instance, encryption_key)

        # Verify instance is connected
        try:
            connection_state = evolution_client.check_connection()
            if connection_state.get("state") != "open":
                raise ValueError("WhatsApp instance is not connected")
        except Exception as e:
            raise ValueError(f"Failed to verify instance connection: {e}")

        # Get delay settings
        delay_between_messages = campaign.get("delay_between_messages", 3)
        delay_between_recipients = campaign.get("delay_between_recipients", 5)

        # Update Modal job status
        supabase.update_campaign_status(campaign_id, "running", "processing")

        # Process in batches
        batch_size = 100
        processed = 0

        while True:
            # Check campaign status (may have been paused)
            current_status = supabase.check_campaign_status(campaign_id)
            if current_status == "paused":
                result["status"] = "paused"
                break

            if current_status not in ("running",):
                result["status"] = current_status
                break

            # Get pending sends
            sends = supabase.get_pending_sends(campaign_id, limit=batch_size)
            if not sends:
                # All done
                break

            # Check wallet balance before batch
            has_balance, balance, required = check_wallet_balance(
                supabase, tenant_id, len(sends), messages_per_recipient
            )
            if not has_balance:
                error_msg = f"Insufficient balance: R${balance:.2f} < R${required:.2f}"
                supabase.append_campaign_error(campaign_id, error_msg)
                supabase.update_campaign_status(campaign_id, "paused", "insufficient_balance")
                result["status"] = "paused"
                result["error"] = error_msg
                break

            # Process each recipient
            for send in sends:
                # Process all messages for this recipient
                proc_result = process_recipient(
                    send=send,
                    messages=messages,
                    evolution_client=evolution_client,
                    supabase=supabase,
                    campaign_id=campaign_id,
                    tenant_id=tenant_id,
                    delay_between_messages=delay_between_messages
                )

                if proc_result.success:
                    result["sent_count"] += 1
                else:
                    result["failed_count"] += 1
                    if proc_result.error == "Campaign paused":
                        result["status"] = "paused"
                        break

                result["total_recipients"] += 1
                processed += 1

                # Delay between recipients
                time.sleep(delay_between_recipients)

            if result["status"] == "paused":
                break

        # Close Evolution client
        evolution_client.close()

        # Final status update
        if result["status"] == "completed":
            supabase.update_campaign_status(campaign_id, "completed", "completed")
        elif result["status"] == "paused":
            supabase.update_campaign_status(campaign_id, "paused", "paused")

        # Send webhook notification
        notify_completion(result)

    except Exception as e:
        error_msg = str(e)
        result["status"] = "failed"
        result["error"] = error_msg

        # Log error and update status
        try:
            supabase.append_campaign_error(campaign_id, error_msg)
            supabase.update_campaign_status(campaign_id, "failed", "failed")
        except Exception:
            pass

        notify_completion(result)

    return result


def notify_completion(result: dict):
    """Send webhook notification when campaign completes."""
    webhook_url = os.environ.get("SCALECORE_WEBHOOK_URL")
    webhook_secret = os.environ.get("SCALECORE_WEBHOOK_SECRET")

    if not webhook_url:
        return

    try:
        headers = {"Content-Type": "application/json"}
        if webhook_secret:
            headers["X-Webhook-Secret"] = webhook_secret

        httpx.post(
            webhook_url,
            json={
                "event": "campaign.completed",
                "data": result
            },
            headers=headers,
            timeout=10.0
        )
    except Exception:
        pass  # Don't fail if webhook fails


@app.local_entrypoint()
def main(campaign_id: str, tenant_id: str):
    """
    Local entrypoint for testing.

    Usage:
        modal run campaign_worker.py --campaign-id <uuid> --tenant-id <uuid>
    """
    result = process_campaign.remote(campaign_id, tenant_id)
    print(f"Campaign processing result: {result}")
