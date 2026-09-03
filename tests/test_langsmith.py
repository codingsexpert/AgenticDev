"""
test_langsmith.py — Pytest for LangSmith Tracing Helper
"""

import os
import pytest
from src.utils.langsmith_tracer import init_langsmith_tracer


def test_langsmith_tracer_disabled():
    os.environ["LANGCHAIN_TRACING_V2"] = "false"
    status = init_langsmith_tracer()
    assert status["enabled"] is False
    assert status["status"] == "disabled"


def test_langsmith_tracer_enabled_with_key():
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = "test-langsmith-key"
    os.environ["LANGCHAIN_PROJECT"] = "test-project"

    status = init_langsmith_tracer()
    assert status["enabled"] is True
    assert status["project"] == "test-project"
    assert status["status"] == "active"
