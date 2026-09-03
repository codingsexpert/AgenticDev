"""
human_escalation.py — Human Escalation Node & Router
Handles terminal escalation when Debugger exhausts automated repair attempts.
"""

from typing import Dict, Any


def human_escalation_node(state: Dict[str, Any]) -> Dict[str, Any]:
    task = state.get("currentTask") or {}
    exec_res = state.get("executionResult", {})
    errors = exec_res.get("errors", "Unknown error")

    print("\n🆘 [Human Escalation Required]")
    print(f"   Task: {task.get('title')}")
    print(f"   Error: {errors}")
    print("\nOptions: (1) Skip task, (2) Provide guide instruction, (3) Simplify task")

    try:
        ans = input("Choose option (1/2/3) [default: 1]: ").strip()
        if ans == "2":
            instruction = input("Enter guide instruction for Coder: ").strip()
            return {"_escalationChoice": "guide", "userFeedback": [{"role": "user", "feedback": instruction}]}
        elif ans == "3":
            return {"_escalationChoice": "simplify"}
    except (EOFError, KeyboardInterrupt):
        pass

    return {"_escalationChoice": "skip"}


def human_escalation_router(state: Dict[str, Any]) -> str:
    choice = state.get("_escalationChoice", "skip")
    if choice == "guide":
        return "coderAgent"
    elif choice == "simplify":
        return "simplifyTask"

    return "selectNextTask"
