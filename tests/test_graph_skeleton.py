"""
test_graph_skeleton.py — Pytest for Graph Skeleton & Routing
"""

import pytest
from src.config.graph import build_graph
from src.config.state import create_initial_state


def test_graph_compilation():
    graph = build_graph()
    assert graph is not None


def test_initial_state_structure():
    state = create_initial_state("Build a task manager app")
    assert state["userRequirement"] == "Build a task manager app"
    assert state["pmStatus"] == "idle"
    assert state["tokenBudget"] == 2.0
    assert state["sandboxHealthy"] is False
