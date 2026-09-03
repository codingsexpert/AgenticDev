"""
snapshot_manager.py — Git Snapshot Manager for Task Progression
"""

import subprocess
from typing import Dict, Any
from src.utils.sandbox_manager import get_sandbox_path


def snapshot_manager_node(state: Dict[str, Any]) -> Dict[str, Any]:
    task = state.get("currentTask", {})
    sandbox_id = state.get("sandboxId")
    task_idx = state.get("currentTaskIndex", 0)
    task_id = task.get("taskId", f"task-{task_idx}")

    print(f"\n📸 [Snapshot Manager] Checkpointing git state after task completion: {task_id}")

    if sandbox_id:
        sandbox_path = get_sandbox_path(sandbox_id)
        try:
            subprocess.run(["git", "add", "-A"], cwd=sandbox_path, capture_output=True, check=True)
            subprocess.run(["git", "commit", "-m", f"Task done: {task_id}"], cwd=sandbox_path, capture_output=True, check=True)
            tag_name = f"v0.{task_idx + 1}.0"
            subprocess.run(["git", "tag", tag_name], cwd=sandbox_path, capture_output=True, check=True)
            print(f"   ✅ Created snapshot tag: {tag_name}")
        except Exception as e:
            print(f"   ⚠️ Git snapshot notice: {str(e)}")

    return {
        "currentTaskIndex": task_idx + 1,
        "taskStatuses": {task_id: "done"},
        "reviewResult": {"verdict": "", "issues": [], "reviewCycle": 0},
        "executionResult": {"result": "", "output": "", "errors": ""},
        "debugState": {"tier": 1, "attempts": 0, "maxAttempts": 3, "rollbackAttempted": False},
    }
