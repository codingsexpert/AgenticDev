"""
input_guardrail.py — Guardrail for User Input Safety and Integrity

Validates user input requirements before passing to PM Agent:
- Prompt injection prevention
- System command attack prevention
- Minimum/maximum length & format validation
"""

import re
from typing import Dict, Any, Tuple


SUSPICIOUS_PATTERNS = [
    r"ignore (all )?(previous|above) instructions",
    r"system prompt",
    r"you are now DAN",
    r"bypass (safety|filters)",
    r"sudo rm -rf",
    r"chmod -R 777",
    r"cat /etc/passwd",
    r"drop database",
]


def validate_user_input(user_input: str) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Validates user requirement input.
    Returns: (is_valid, sanitized_text_or_error_message, metadata)
    """
    if not user_input or not user_input.strip():
        return False, "Input requirement cannot be empty.", {"reason": "empty_input"}

    cleaned = user_input.strip()

    if len(cleaned) < 5:
        return False, "Input requirement is too short. Please describe what you want to build.", {"reason": "too_short"}

    if len(cleaned) > 5000:
        return False, "Input requirement is too long (max 5000 characters).", {"reason": "too_long"}

    for pattern in SUSPICIOUS_PATTERNS:
        if re.search(pattern, cleaned, re.IGNORECASE):
            return False, f"Input failed security guardrail check: suspicious pattern detected.", {"reason": "security_violation", "pattern": pattern}

    return True, cleaned, {"reason": "passed"}
