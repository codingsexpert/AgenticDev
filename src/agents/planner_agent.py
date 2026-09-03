"""
planner_agent.py — Planner Agent
Breaks down architecture blueprint into ordered phases and task queues.
"""

import json
from typing import Dict, Any
from src.utils.llm_client import call_llm
from src.utils.token_tracker import make_token_delta

PLANNER_PROMPT = """You are the Planner Agent in an AI software development team.

ROLE: Lead Tech Architect who creates the task execution plan.

GOAL: Convert blueprint into incremental phases and task queue.

OUTPUT FORMAT (strict JSON):
{
  "phases": [
    {
      "phaseNumber": 1,
      "phaseName": "Scaffolding & Setup",
      "tasks": [
        {
          "taskId": "setup-1",
          "title": "Initialize app project structure",
          "description": "Create base config and entry file",
          "filesToCreate": ["index.html", "style.css", "script.js"],
          "acceptanceCriteria": ["App runs without syntax errors"],
          "canParallelize": false
        }
      ]
    }
  ]
}
"""


def planner_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    print("\n📋 [Planner Agent] Creating task queue...\n")

    blueprint = state.get("blueprint", {})
    spec = state.get("clarifiedSpec", {})

    result = call_llm(
        system_prompt=PLANNER_PROMPT,
        user_prompt=f"Blueprint:\n{json.dumps(blueprint, indent=2)}\n\nSpec:\n{json.dumps(spec, indent=2)}",
        agent_name="plannerAgent",
        current_cost=state.get("tokenUsage", {}).get("estimatedCost", 0.0),
        token_budget=state.get("tokenBudget", 2.0),
    )

    task_queue = result["parsed"]
    phases = task_queue.get("phases", [])
    total_tasks = sum(len(p.get("tasks", [])) for p in phases)

    print(f"   Created {len(phases)} phases with {total_tasks} total tasks")

    return {
        "taskQueue": task_queue,
        "currentPhaseIndex": 0,
        "currentTaskIndex": 0,
        "tokenUsage": make_token_delta("plannerAgent", result["tokens"]),
    }
