"""
src/utils/gemini_client.py — Gemini & Universal LLM Initialization Helper
"""
import os

def init_gemini() -> bool:
    """Verifies that an LLM API key (GEMINI_API_KEY or OPENROUTER_API_KEY) is configured."""
    gemini_key = os.getenv("GEMINI_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if not gemini_key and not openrouter_key:
        raise ValueError("Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is configured in environment.")
    return True
