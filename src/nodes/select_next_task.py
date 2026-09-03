"""
select_next_task.py — Task Selection Node & Router
Selects the next pending task from task queue.
"""

from typing import Dict, Any


def select_next_task_node(state: Dict[str, Any]) -> Dict[str, Any]:
    task_queue = state.get("taskQueue", {})
    phases = task_queue.get("phases", [])
    phase_idx = state.get("currentPhaseIndex", 0)
    task_idx = state.get("currentTaskIndex", 0)
    task_statuses = state.get("taskStatuses", {})

    if phase_idx >= len(phases):
        print("\n🎉 [Task Scheduler] All phases complete!")
        return {"currentTask": None}

    current_phase = phases[phase_idx]
    tasks = current_phase.get("tasks", [])

    if task_idx >= len(tasks):
        print(f"\n✅ [Task Scheduler] Phase {phase_idx + 1} complete. Verifying phase...")
        return {"currentTask": None, "_phaseComplete": True}

    task = tasks[task_idx]
    print(f"\n📌 [Task Scheduler] Selected Task [{task.get('taskId')}]: {task.get('title')}")

    return {
        "currentTask": task,
        "taskStatuses": {task.get("taskId"): "in_progress"},
    }


def select_next_task_router(state: Dict[str, Any]) -> str:
    if state.get("_phaseComplete", False):
        return "phaseVerification"

    task = state.get("currentTask")
    if task:
        return "contextBuilder"

    return "presentToUser"
