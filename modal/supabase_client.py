"""
Supabase client for Modal worker.
Handles database operations for campaign processing.
"""

import os
from typing import Optional, Any
from supabase import create_client, Client


class SupabaseClient:
    """Wrapper for Supabase operations in campaign worker."""

    def __init__(self):
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

        self.client: Client = create_client(url, key)

    def get_campaign(self, campaign_id: str) -> Optional[dict]:
        """Fetch campaign with instance details."""
        response = self.client.table("campaigns").select(
            "*, whatsapp_instances(*, evolution_configs(*))"
        ).eq("id", campaign_id).single().execute()
        return response.data

    def get_campaign_messages(self, campaign_id: str) -> list[dict]:
        """Fetch all messages for a campaign ordered by position."""
        response = self.client.table("campaign_messages").select("*").eq(
            "campaign_id", campaign_id
        ).order("position").execute()
        return response.data or []

    def get_pending_sends(self, campaign_id: str, limit: int = 100) -> list[dict]:
        """Fetch pending sends with lead data."""
        response = self.client.table("campaign_sends").select(
            "*, leads(*)"
        ).eq("campaign_id", campaign_id).eq("status", "pending").limit(limit).execute()
        return response.data or []

    def update_send_status(
        self,
        send_id: str,
        status: str,
        message_id: Optional[str] = None,
        error_message: Optional[str] = None,
        messages_sent: Optional[int] = None,
        current_message_index: Optional[int] = None
    ) -> None:
        """Update campaign send status and tracking fields."""
        update_data = {"status": status}

        if message_id:
            update_data["message_id"] = message_id
        if error_message:
            update_data["error_message"] = error_message
        if messages_sent is not None:
            update_data["messages_sent"] = messages_sent
        if current_message_index is not None:
            update_data["current_message_index"] = current_message_index
        if status == "sent":
            update_data["sent_at"] = "now()"

        self.client.table("campaign_sends").update(update_data).eq("id", send_id).execute()

    def create_send_message(
        self,
        campaign_send_id: str,
        campaign_message_id: str,
        message_id: Optional[str] = None,
        status: str = "pending",
        error_message: Optional[str] = None
    ) -> dict:
        """Create a record for individual message tracking."""
        data = {
            "campaign_send_id": campaign_send_id,
            "campaign_message_id": campaign_message_id,
            "status": status
        }
        if message_id:
            data["message_id"] = message_id
        if error_message:
            data["error_message"] = error_message
        if status == "sent":
            data["sent_at"] = "now()"

        response = self.client.table("campaign_send_messages").insert(data).execute()
        return response.data[0] if response.data else {}

    def update_send_message(
        self,
        send_message_id: str,
        status: str,
        message_id: Optional[str] = None,
        error_message: Optional[str] = None
    ) -> None:
        """Update individual message tracking record."""
        update_data = {"status": status}
        if message_id:
            update_data["message_id"] = message_id
        if error_message:
            update_data["error_message"] = error_message
        if status == "sent":
            update_data["sent_at"] = "now()"

        self.client.table("campaign_send_messages").update(update_data).eq(
            "id", send_message_id
        ).execute()

    def update_campaign_status(
        self,
        campaign_id: str,
        status: str,
        modal_job_status: Optional[str] = None
    ) -> None:
        """Update campaign status."""
        update_data = {"status": status}
        if modal_job_status:
            update_data["modal_job_status"] = modal_job_status
        if status == "running":
            update_data["started_at"] = "now()"
        elif status in ("completed", "failed"):
            update_data["completed_at"] = "now()"

        self.client.table("campaigns").update(update_data).eq("id", campaign_id).execute()

    def increment_campaign_count(self, campaign_id: str, field: str) -> None:
        """Increment a counter field on campaign (sent_count, failed_count, etc)."""
        self.client.rpc("increment_campaign_count", {
            "campaign_id": campaign_id,
            "field_name": field
        }).execute()

    def deduct_wallet_balance(
        self,
        tenant_id: str,
        amount: float,
        description: str,
        reference_id: Optional[str] = None
    ) -> bool:
        """Deduct balance from tenant wallet. Returns True if successful."""
        try:
            self.client.rpc("deduct_wallet_balance", {
                "p_tenant_id": tenant_id,
                "p_amount": amount,
                "p_description": description,
                "p_reference_id": reference_id
            }).execute()
            return True
        except Exception:
            return False

    def append_campaign_error(self, campaign_id: str, error: str) -> None:
        """Append an error to campaign error_log array."""
        self.client.rpc("append_campaign_error", {
            "p_campaign_id": campaign_id,
            "p_error": error
        }).execute()

    def check_campaign_status(self, campaign_id: str) -> str:
        """Check current campaign status (for pause detection)."""
        response = self.client.table("campaigns").select("status").eq(
            "id", campaign_id
        ).single().execute()
        return response.data.get("status", "unknown") if response.data else "unknown"

    def get_lead(self, lead_id: str) -> Optional[dict]:
        """Fetch full lead data for variable replacement."""
        response = self.client.table("leads").select("*").eq("id", lead_id).single().execute()
        return response.data

    def get_wallet_balance(self, tenant_id: str) -> float:
        """Get current wallet balance for a tenant."""
        response = self.client.table("wallets").select("balance").eq(
            "tenant_id", tenant_id
        ).single().execute()
        return float(response.data.get("balance", 0)) if response.data else 0.0
