"""
langsmith_tracer.py — LangSmith Tracing & Observability Helper

Checks environment variables and provides status for LangSmith tracing.
When LANGCHAIN_TRACING_V2=true and LANGCHAIN_API_KEY are set in .env,
LangGraph automatically traces all graph state transitions, nodes, and agent executions.
"""

import os
from typing import Dict, Any


def init_langsmith_tracer() -> Dict[str, Any]:
    """
    Verifies LangSmith environment variables.
    Returns status dictionary.
    """
    tracing_enabled = os.getenv("LANGCHAIN_TRACING_V2", "false").lower() in ("true", "1")
    api_key = os.getenv("LANGCHAIN_API_KEY", "").strip()
    project = os.getenv("LANGCHAIN_PROJECT", "ai-dev-team")

    if tracing_enabled and api_key:
        print(f"🔍 [LangSmith] Tracing ENABLED → Project: '{project}' (https://smith.langchain.com)")
        return {
            "enabled": True,
            "project": project,
            "status": "active"
        }
    elif tracing_enabled and not api_key:
        print("⚠️ [LangSmith] Tracing is set to true, but LANGCHAIN_API_KEY is missing in .env")
        return {
            "enabled": False,
            "project": project,
            "status": "missing_key"
        }
    else:
        print("ℹ️  [LangSmith] Tracing disabled. (Add LANGCHAIN_TRACING_V2=true & LANGCHAIN_API_KEY to .env to enable)")
        return {
            "enabled": False,
            "project": project,
            "status": "disabled"
        }
