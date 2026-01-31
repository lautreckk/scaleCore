"""
Variable replacement for campaign messages.
Supports {{nome}}, {{empresa}}, {{email}}, {{custom.fieldname}}, etc.
"""

import re
from typing import Optional


def replace_variables(text: str, lead: Optional[dict]) -> str:
    """
    Replace template variables in text with lead data.

    Supported variables:
    - {{nome}} - Lead name
    - {{empresa}} - Lead company
    - {{email}} - Lead email
    - {{telefone}} or {{phone}} - Lead phone
    - {{source}} - Lead source
    - {{status}} - Lead status
    - {{custom.fieldname}} - Custom field value

    Args:
        text: Message template with variables
        lead: Lead data dict from Supabase

    Returns:
        Text with variables replaced
    """
    if not text:
        return ""

    if not lead:
        # Remove all variables if no lead data
        return re.sub(r"\{\{[^}]+\}\}", "", text)

    result = text

    # Standard field mappings
    field_mappings = {
        "nome": lead.get("name", ""),
        "name": lead.get("name", ""),
        "empresa": lead.get("company", ""),
        "company": lead.get("company", ""),
        "email": lead.get("email", ""),
        "telefone": lead.get("phone", ""),
        "phone": lead.get("phone", ""),
        "source": lead.get("source", ""),
        "origem": lead.get("source", ""),
        "status": lead.get("status", ""),
    }

    # Replace standard variables (case-insensitive)
    for var_name, value in field_mappings.items():
        pattern = re.compile(r"\{\{" + var_name + r"\}\}", re.IGNORECASE)
        result = pattern.sub(str(value) if value else "", result)

    # Handle custom fields {{custom.fieldname}}
    custom_pattern = re.compile(r"\{\{custom\.([^}]+)\}\}", re.IGNORECASE)
    custom_fields = lead.get("custom_fields") or {}

    def replace_custom(match):
        field_name = match.group(1)
        # Try exact match first
        if field_name in custom_fields:
            return str(custom_fields[field_name])
        # Try case-insensitive match
        for key, value in custom_fields.items():
            if key.lower() == field_name.lower():
                return str(value) if value else ""
        return ""

    result = custom_pattern.sub(replace_custom, result)

    # Clean up any remaining unmatched variables
    result = re.sub(r"\{\{[^}]+\}\}", "", result)

    return result


def extract_variables(text: str) -> list[str]:
    """
    Extract all variable names from a template.

    Args:
        text: Message template

    Returns:
        List of variable names (e.g., ["nome", "empresa", "custom.cargo"])
    """
    if not text:
        return []

    pattern = re.compile(r"\{\{([^}]+)\}\}")
    matches = pattern.findall(text)
    return list(set(matches))


def validate_template(text: str) -> dict:
    """
    Validate a message template for common issues.

    Returns:
        {
            "valid": bool,
            "variables": list of found variables,
            "warnings": list of warning messages
        }
    """
    result = {
        "valid": True,
        "variables": [],
        "warnings": []
    }

    if not text:
        return result

    variables = extract_variables(text)
    result["variables"] = variables

    known_vars = {
        "nome", "name", "empresa", "company", "email",
        "telefone", "phone", "source", "origem", "status"
    }

    for var in variables:
        lower_var = var.lower()
        # Check if it's a custom field
        if lower_var.startswith("custom."):
            continue
        # Check if it's a known variable
        if lower_var not in known_vars:
            result["warnings"].append(f"Unknown variable: {{{{{var}}}}}")

    return result
