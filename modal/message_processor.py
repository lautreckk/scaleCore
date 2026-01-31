"""
Message processor for campaign worker.
Handles the logic of sending messages with proper delays and tracking.
"""

import time
from typing import Optional
from dataclasses import dataclass

from supabase_client import SupabaseClient
from evolution_client import EvolutionClient, create_evolution_client
from variable_replacer import replace_variables


# Cost per message in BRL
MESSAGE_COST = 0.12


@dataclass
class ProcessingResult:
    """Result of processing a single recipient."""
    success: bool
    messages_sent: int
    total_messages: int
    error: Optional[str] = None


def process_message(
    campaign_message: dict,
    lead: Optional[dict],
    evolution_client: EvolutionClient,
    phone: str,
    delay: int = 0
) -> dict:
    """
    Send a single message to a recipient.

    Args:
        campaign_message: Message data from campaign_messages table
        lead: Lead data for variable replacement
        evolution_client: Configured Evolution client
        phone: Recipient phone number
        delay: Delay in milliseconds before sending

    Returns:
        Evolution API response or error dict
    """
    message_type = campaign_message.get("message_type", "text")
    content = campaign_message.get("content", "")
    media_url = campaign_message.get("media_url")
    file_name = campaign_message.get("file_name")

    # Replace variables in content
    processed_content = replace_variables(content, lead)

    try:
        if message_type == "text":
            return evolution_client.send_text(phone, processed_content, delay)
        else:
            # Media message (image, video, audio, document)
            return evolution_client.send_media(
                to=phone,
                media_url=media_url,
                media_type=message_type,
                caption=processed_content if content else None,
                file_name=file_name,
                delay=delay
            )
    except Exception as e:
        return {"error": str(e)}


def process_recipient(
    send: dict,
    messages: list[dict],
    evolution_client: EvolutionClient,
    supabase: SupabaseClient,
    campaign_id: str,
    tenant_id: str,
    delay_between_messages: int = 3
) -> ProcessingResult:
    """
    Process all messages for a single recipient.

    Args:
        send: Campaign send record with lead data
        messages: List of campaign messages ordered by position
        evolution_client: Evolution client
        supabase: Supabase client
        campaign_id: Campaign ID
        tenant_id: Tenant ID for billing
        delay_between_messages: Seconds between messages

    Returns:
        ProcessingResult with success status and counts
    """
    lead = send.get("leads")
    phone = lead.get("phone") if lead else None

    if not phone:
        return ProcessingResult(
            success=False,
            messages_sent=0,
            total_messages=len(messages),
            error="No phone number"
        )

    total_messages = len(messages)
    messages_sent = 0

    for idx, message in enumerate(messages):
        # Check if campaign was paused
        status = supabase.check_campaign_status(campaign_id)
        if status == "paused":
            # Save progress and exit
            supabase.update_send_status(
                send["id"],
                status="pending",
                messages_sent=messages_sent,
                current_message_index=idx
            )
            return ProcessingResult(
                success=False,
                messages_sent=messages_sent,
                total_messages=total_messages,
                error="Campaign paused"
            )

        # Calculate delay for Evolution API (in ms)
        delay_ms = (delay_between_messages * 1000) if idx > 0 else 0

        # Create tracking record
        send_message = supabase.create_send_message(
            campaign_send_id=send["id"],
            campaign_message_id=message["id"],
            status="sending"
        )

        # Send the message
        result = process_message(
            campaign_message=message,
            lead=lead,
            evolution_client=evolution_client,
            phone=phone,
            delay=delay_ms
        )

        if "error" in result:
            # Message failed
            supabase.update_send_message(
                send_message["id"],
                status="failed",
                error_message=result["error"]
            )
            # Update overall send status
            supabase.update_send_status(
                send["id"],
                status="failed",
                error_message=result["error"],
                messages_sent=messages_sent,
                current_message_index=idx
            )
            supabase.increment_campaign_count(campaign_id, "failed_count")
            return ProcessingResult(
                success=False,
                messages_sent=messages_sent,
                total_messages=total_messages,
                error=result["error"]
            )

        # Message sent successfully
        message_id = result.get("key", {}).get("id")
        supabase.update_send_message(
            send_message["id"],
            status="sent",
            message_id=message_id
        )
        messages_sent += 1

        # Deduct cost per message
        supabase.deduct_wallet_balance(
            tenant_id=tenant_id,
            amount=MESSAGE_COST,
            description=f"Campaign message - {campaign_id}",
            reference_id=send_message["id"]
        )

        # Wait between messages (already handled by Evolution delay, but add extra safety)
        if idx < total_messages - 1:
            time.sleep(delay_between_messages)

    # All messages sent successfully
    last_message_id = None  # Could track if needed
    supabase.update_send_status(
        send["id"],
        status="sent",
        messages_sent=messages_sent,
        current_message_index=total_messages
    )
    supabase.increment_campaign_count(campaign_id, "sent_count")

    return ProcessingResult(
        success=True,
        messages_sent=messages_sent,
        total_messages=total_messages
    )


def check_wallet_balance(
    supabase: SupabaseClient,
    tenant_id: str,
    pending_count: int,
    messages_per_recipient: int
) -> tuple[bool, float, float]:
    """
    Check if wallet has sufficient balance for remaining sends.

    Returns:
        (has_balance, current_balance, required_amount)
    """
    required = pending_count * messages_per_recipient * MESSAGE_COST
    balance = supabase.get_wallet_balance(tenant_id)
    return balance >= required, balance, required
