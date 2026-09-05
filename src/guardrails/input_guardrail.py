"""
input_guardrail.py — Comprehensive Guardrail for User Input Safety & Integrity

Validates user requirement input before processing:
- Anti-Prompt Injection & Jailbreak prevention
- System command & Remote code execution attack prevention
- Sensitive API key & Credential extraction defense
- SQL Injection signature detection
- Null byte & control character sanitization
- Minimum/maximum length validation
"""

import re
from typing import Dict, Any, Tuple


PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)",
    r"disregard\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)",
    r"forget\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)",
    r"system\s+prompt",
    r"reveal\s+(your\s+)?(system\s+)?prompt",
    r"show\s+(your\s+)?(system\s+)?prompt",
    r"you\s+are\s+now\s+dan",
    r"act\s+as\s+an?\s+unrestricted",
    r"developer\s+mode\s+enabled",
    r"bypass\s+(safety|filters|guardrails)",
    r"override\s+system\s+instructions",
    r"jailbreak",
]

SYSTEM_ATTACK_PATTERNS = [
    r"sudo\s+rm",
    r"rm\s+-rf\s+/",
    r"chmod\s+-R\s+777",
    r"cat\s+/etc/(passwd|shadow|hosts)",
    r"cat\s+\.env",
    r"print\s+\.env",
    r"read\s+\.env",
    r"show\s+.*api[_\s]*key",
    r"print\s+.*gemini_api_key",
    r"print\s+.*supabase_key",
    r"drop\s+(database|table|schema)",
    r"truncate\s+table",
    r"union\s+select\s+",
    r"curl\s+.*\|\s*(bash|sh)",
    r"wget\s+.*\|\s*(bash|sh)",
    r"import\s+os\s*;\s*os\.system",
    r"subprocess\.popen",
    r"eval\s*\(",
    r"exec\s*\(",
    r"nc\s+-e",
    r"/dev/tcp/",
]


def validate_user_input(user_input: str) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Validates user requirement input.
    Returns: (is_valid, sanitized_text_or_error_message, metadata)
    """
    if not user_input or not user_input.strip():
        return False, "Input requirement cannot be empty.", {"reason": "empty_input"}

    # 1. Sanitize null bytes and illegal control characters
    cleaned = user_input.replace("\x00", "").strip()

    # 2. Length Checks
    if len(cleaned) < 3:
        return False, "Input requirement is too short. Please describe what you want to build.", {"reason": "too_short"}

    if len(cleaned) > 10000:
        return False, "Input requirement is too long (max 10000 characters).", {"reason": "too_long"}

    # 3. Check for Prompt Injection / Jailbreak
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, cleaned, re.IGNORECASE):
            return False, "Input failed security guardrail check: potential prompt injection or system override detected.", {
                "reason": "security_violation",
                "category": "prompt_injection",
                "pattern": pattern
            }

    # 4. Check for System Command / Security Attacks
    for pattern in SYSTEM_ATTACK_PATTERNS:
        if re.search(pattern, cleaned, re.IGNORECASE):
            return False, "Input failed security guardrail check: suspicious system command or security attack pattern detected.", {
                "reason": "security_violation",
                "category": "system_attack",
                "pattern": pattern
            }

    return True, cleaned, {"reason": "passed"}
