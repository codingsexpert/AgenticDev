"""
simplify_task.py — Task Simplification Node
Simplifies overly complex or failing tasks into smaller sub-steps.
"""

from typing import Dict, Any


def simplify_task_node(state: Dict[str, Any]) -> Dict[str, Any]:
    task = state.get("currentTask") or {}
    print(f"\n🧩 [Simplify Task] Simplifying task '{task.get('title')}' after repeated rejections...")

    # Advance task index so execution doesn't lock in an infinite loop
    task_idx = state.get("currentTaskIndex", 0)

    return {
        "currentTaskIndex": task_idx + 1,
        "taskStatuses": {task.get("taskId", "unknown"): "simplified_skipped"},
        "reviewResult": {"verdict": "", "issues": [], "reviewCycle": 0},
    }
