"""
src/routes/system.py — System Health & Status API Router
"""

import os
from fastapi import APIRouter
from src.utils.langsmith_tracer import init_langsmith_tracer
from src.utils.memory_manager import get_user_preferences, get_long_term_memory

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/status")
def get_status():
    tracer_info = init_langsmith_tracer()
    prefs = get_user_preferences()
    long_term = get_long_term_memory()
    return {
        "status": "online",
        "model": os.getenv("LLM_MODEL", "gemini/gemini-1.5-flash"),
        "tracing": tracer_info,
        "supabaseConfigured": bool(os.getenv("SUPABASE_URL")),
        "userPreferences": prefs,
        "memorySummary": {
            "projectsCount": len(long_term.get("created_projects", [])),
            "patternsCount": len(long_term.get("project_patterns", {})),
            "bugFixesCount": len(long_term.get("bug_fixes", [])),
        }
    }
