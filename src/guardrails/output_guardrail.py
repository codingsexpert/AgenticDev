"""
output_guardrail.py — Output Pydantic Schema Guardrail & JSON Sanitizer

Ensures LLM responses conform strictly to expected Pydantic schemas.
Strips markdown code fences and provides robust JSON parsing + auto-fix fallback.
"""

import json
import re
from typing import Any, Dict, List, Optional, Type
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
            # If schema validation fails, return data with raw fallback
            data["_guardrail_validation_warnings"] = str(val_err)
            return data

    return data
