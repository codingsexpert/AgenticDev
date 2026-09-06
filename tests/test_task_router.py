"""
test_task_router.py — Unit Tests for Intelligent Task Router & Complexity Classifier
"""

import pytest
from src.utils.task_router import classify_task, TaskClassification


def test_level_0_greetings():
    for text in ["hi", "hey", "hello!", "thanks", "good morning", "kaise ho", "ok"]:
        res = classify_task(text)
        assert res.level == 0
        assert res.category == "conversation"
        assert res.skip_rag is True
        assert res.skip_web_search is True
        assert res.skip_sandbox is True
        assert "chatAgent" in res.required_agents


def test_level_1_simple_qa():
    for text in ["what is Python?", "explain recursion in computer science", "convert this to JSON"]:
        res = classify_task(text)
        assert res.level == 1
        assert res.skip_rag is True
        assert res.skip_sandbox is True


def test_level_2_research_and_weather():
    res_web = classify_task("search web for latest AI news")
    assert res_web.level == 2
    assert res_web.category == "research"
    assert res_web.skip_web_search is False

    res_weather = classify_task("what is the weather in Delhi")
    assert res_weather.level == 2
    assert res_weather.category == "weather_query"


def test_level_2_data_analysis_attachments():
    attachments = [{"name": "sales.csv", "type": "text/csv"}]
    res = classify_task("Analyze this sales data", attachments=attachments)
    assert res.level == 2
    assert res.category == "data_analysis"
    assert res.skip_sandbox is False


def test_level_3_code_fix():
    prompt = "fix this function: def add(a, b): return a - b"
    res = classify_task(prompt)
    assert res.level == 3
    assert res.category == "code_fix"
    assert "coderAgent" in res.required_agents
    assert res.skip_sandbox is False


def test_level_4_full_app_build():
    res_build_mode = classify_task("Build me a landing page", mode="build")
    assert res_build_mode.level == 4
    assert res_build_mode.category == "full_app_build"
    assert "plannerAgent" in res_build_mode.required_agents

    res_prompt_intent = classify_task("Build a complete SaaS web application with auth and database")
    assert res_prompt_intent.level == 4
    assert res_prompt_intent.category == "full_app_build"
