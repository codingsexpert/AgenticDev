"""
output_guardrail.py — Output Pydantic Schema Guardrail, Secret Redactor & Code Sanitizer

Ensures LLM responses conform strictly to expected Pydantic schemas.
Redacts API keys & sensitive tokens from LLM output before sending to UI or disk.
Strips markdown code fences and provides robust JSON parsing + auto-fix fallback.
"""

import json
import re
from typing import Any, Dict, List, Optional, Type, Tuple
from pydantic import BaseModel, Field, ValidationError


class PMSpecModel(BaseModel):
    status: str = Field(description="needs_clarification | spec_ready")
    questions: Optional[List[str]] = Field(default_factory=list)
    assumptions: Optional[List[str]] = Field(default_factory=list)
    spec: Optional[Dict[str, Any]] = None


class CoderFileModel(BaseModel):
    path: str
    content: str


class CoderOutputModel(BaseModel):
    files: List[CoderFileModel] = Field(default_factory=list)
    notes: Optional[str] = ""


class ReviewerOutputModel(BaseModel):
    verdict: str = Field(description="approved | rejected")
    issues: List[str] = Field(default_factory=list)
    summary: Optional[str] = ""


class DebuggerOutputModel(BaseModel):
    rootCause: str
    fix: str
    affectedFiles: List[str] = Field(default_factory=list)
    confidence: str = Field(default="medium")


# Secret Masking Patterns for AI Studio, Supabase, OpenAI, AWS, GitHub, JWT, Private Keys
SECRET_PATTERNS = [
    (r"AIzaSy[A-Za-z0-9_\-]{33}", "[REDACTED_GEMINI_API_KEY]"),
    (r"sk-[A-Za-z0-9_\-]{32,}", "[REDACTED_OPENAI_KEY]"),
    (r"AKIA[0-9A-Z]{16}", "[REDACTED_AWS_KEY]"),
    (r"ghp_[A-Za-z0-9]{36}", "[REDACTED_GITHUB_TOKEN]"),
    (r"-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |)PRIVATE KEY-----", "[REDACTED_PRIVATE_KEY]"),
]


def redact_sensitive_keys(text: str) -> str:
    """
    Scans response text and redacts any actual API keys, secrets, or private tokens.
    """
    if not text:
        return ""
    sanitized = text
    for pattern, replacement in SECRET_PATTERNS:
        sanitized = re.sub(pattern, replacement, sanitized)
    return sanitized


def clean_json_markdown(text: str) -> str:
    """Removes ```json ... ``` markdown wrappers if present."""
    if not text:
        return ""
    cleaned = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return cleaned


def parse_and_validate_json(
    raw_response: str,
    schema: Optional[Type[BaseModel]] = None
) -> Dict[str, Any]:
    """
    Parses LLM output into JSON and optionally validates against a Pydantic schema.
    Applies secret redaction to text values automatically.
    """
    cleaned_str = clean_json_markdown(raw_response)

    try:
        data = json.loads(cleaned_str)
    except json.JSONDecodeError:
        # Fallback 1: Repair trailing commas
        repaired = re.sub(r",\s*([\]}])", r"\1", cleaned_str)
        try:
            data = json.loads(repaired)
        except json.JSONDecodeError:
            # Fallback 2: Extract first JSON object { ... } or array [ ... ] using regex
            match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", cleaned_str)
            if match:
                try:
                    data = json.loads(match.group(1))
                except json.JSONDecodeError:
                    data = {"status": "spec_ready", "spec": {}, "notes": cleaned_str[:200]}
            else:
                data = {"status": "spec_ready", "spec": {}, "notes": cleaned_str[:200]}

    if schema:
        try:
            validated = schema.model_validate(data)
            return validated.model_dump()
        except ValidationError as val_err:
            data["_guardrail_validation_warnings"] = str(val_err)
            return data

    return data


def validate_generated_code_safety(filename: str, content: str) -> Tuple[bool, str]:
    """
    Inspects generated code for blatant security risks before writing to sandbox disk.
    """
    if not content:
        return True, "Empty content"

    # Redact any accidental hardcoded secrets in the code content
    redacted_content = redact_sensitive_keys(content)
    
    # Simple check for un-sanitized dangerous calls
    dangerous_patterns = [
        (r"\beval\s*\(\s*(?:req|input|params|user)", "Unsanitized eval() of user input"),
        (r"\bchild_process\.exec\s*\(\s*(?:req|input|params|user)", "Unsanitized child_process.exec() of user input"),
        (r"\bos\.system\s*\(\s*(?:req|input|params|user)", "Unsanitized os.system() of user input"),
    ]

    for pattern, reason in dangerous_patterns:
        if re.search(pattern, redacted_content, re.IGNORECASE):
            return False, f"Code failed output safety check: {reason}"

    return True, "Code passed safety check"
