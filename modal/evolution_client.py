"""
Evolution API client for Modal worker.
Handles WhatsApp message sending via Evolution API.
"""

import os
import base64
import hashlib
from typing import Optional, Any
from Crypto.Cipher import AES
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type


class EvolutionClient:
    """Client for Evolution API v2."""

    def __init__(self, base_url: str, api_key: str, instance_name: str):
        """
        Initialize Evolution API client.

        Args:
            base_url: Evolution API base URL
            api_key: Decrypted API key
            instance_name: WhatsApp instance name
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.instance_name = instance_name
        self.client = httpx.Client(timeout=30.0)

    def _headers(self) -> dict:
        """Get request headers with API key."""
        return {
            "Content-Type": "application/json",
            "apikey": self.api_key
        }

    def _format_phone(self, phone: str) -> str:
        """
        Format phone number to WhatsApp format.
        Removes special characters and ensures country code.
        """
        # Remove all non-numeric characters
        digits = "".join(c for c in phone if c.isdigit())

        # Brazilian numbers: add 55 if missing
        if len(digits) == 10 or len(digits) == 11:
            digits = "55" + digits

        return digits

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError))
    )
    def send_text(
        self,
        to: str,
        text: str,
        delay: int = 0
    ) -> dict:
        """
        Send a text message.

        Args:
            to: Recipient phone number
            text: Message content
            delay: Delay in milliseconds before sending

        Returns:
            API response with message ID
        """
        url = f"{self.base_url}/message/sendText/{self.instance_name}"
        payload = {
            "number": self._format_phone(to),
            "text": text
        }
        if delay > 0:
            payload["delay"] = delay

        response = self.client.post(url, json=payload, headers=self._headers())
        response.raise_for_status()
        return response.json()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError))
    )
    def send_media(
        self,
        to: str,
        media_url: str,
        media_type: str,
        caption: Optional[str] = None,
        file_name: Optional[str] = None,
        delay: int = 0
    ) -> dict:
        """
        Send a media message (image, video, audio, document).

        Args:
            to: Recipient phone number
            media_url: URL of the media file
            media_type: Type of media (image, video, audio, document)
            caption: Optional caption for the media
            file_name: Original file name (for documents)
            delay: Delay in milliseconds before sending

        Returns:
            API response with message ID
        """
        url = f"{self.base_url}/message/sendMedia/{self.instance_name}"
        payload = {
            "number": self._format_phone(to),
            "mediatype": media_type,
            "media": media_url
        }

        if caption:
            payload["caption"] = caption
        if file_name:
            payload["fileName"] = file_name
        if delay > 0:
            payload["delay"] = delay

        response = self.client.post(url, json=payload, headers=self._headers())
        response.raise_for_status()
        return response.json()

    def check_connection(self) -> dict:
        """Check if instance is connected."""
        url = f"{self.base_url}/instance/connectionState/{self.instance_name}"
        response = self.client.get(url, headers=self._headers())
        response.raise_for_status()
        return response.json()

    def close(self):
        """Close the HTTP client."""
        self.client.close()


def decrypt_api_key(encrypted_key: str, encryption_key: str) -> str:
    """
    Decrypt an API key encrypted with AES-256-GCM.

    Format: iv:authTag:encryptedData (all hex-encoded)

    Args:
        encrypted_key: Encrypted key string from database
        encryption_key: Encryption key from environment

    Returns:
        Decrypted API key
    """
    try:
        parts = encrypted_key.split(":")
        if len(parts) != 3:
            raise ValueError("Invalid encrypted key format")

        iv = bytes.fromhex(parts[0])
        auth_tag = bytes.fromhex(parts[1])
        encrypted_data = bytes.fromhex(parts[2])

        # Derive 32-byte key from encryption key using SHA256
        key = hashlib.sha256(encryption_key.encode()).digest()

        # Decrypt using AES-256-GCM
        cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
        decrypted = cipher.decrypt_and_verify(encrypted_data, auth_tag)

        return decrypted.decode("utf-8")
    except Exception as e:
        raise ValueError(f"Failed to decrypt API key: {e}")


def create_evolution_client(
    instance_data: dict,
    encryption_key: str
) -> EvolutionClient:
    """
    Create Evolution client from instance data with encrypted config.

    Args:
        instance_data: Instance data with nested evolution_configs
        encryption_key: Key for decrypting API key

    Returns:
        Configured EvolutionClient
    """
    config = instance_data.get("evolution_configs")
    if not config:
        raise ValueError("Instance has no Evolution config")

    base_url = config.get("base_url")
    encrypted_api_key = config.get("api_key")
    instance_name = instance_data.get("instance_name")

    if not all([base_url, encrypted_api_key, instance_name]):
        raise ValueError("Missing required Evolution config fields")

    api_key = decrypt_api_key(encrypted_api_key, encryption_key)

    return EvolutionClient(base_url, api_key, instance_name)
