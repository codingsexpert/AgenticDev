"""
debugger_agent.py — Debugger Agent (3-Tier Escalation in Python)
"""

from typing import Dict, Any
from src.utils.llm_client import call_llm
from src.utils.token_tracker import make_token_delta
from src.utils.sandbox_manager import read_file, rollback
from src.guardrails.output_guardrail import DebuggerOutputModel

DEBUGGER_PROMPT = """You are the Debugger Agent in an AI software development team.

ROLE: Expert debugger who reads error tracebacks and identifies root causes.

GOAL: Analyze the execution error and provide a SPECIFIC fix for the Coder.

OUTPUT FORMAT (strict JSON):
{
  "rootCause": "Exact error cause",
  "fix": "Specific fix required",
  "affectedFiles": ["file1.js"],
  "confidence": "high" | "medium" | "low"
}
"""


def debugger_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    debug_state = state.get("debugState") or {"tier": 1, "attempts": 0, "maxAttempts": 3, "rollbackAttempted": False}
    tier = debug_state.get("tier", 1)
    attempts = debug_state.get("attempts", 0)

    print(f"\n🐛 [Debugger] Analyzing error (Tier {tier}, Attempt {attempts + 1})...\n")

    current_task = state.get("currentTask")
    exec_res = state.get("executionResult", {})
    sandbox_id = state.get("sandboxId")
    errors = exec_res.get("errors", "Unknown execution error")

    # Tier 2.5 Rollback
    if tier == 2 and attempts >= 2 and not debug_state.get("rollbackAttempted", False):
        print("   🔄 Tier 2.5: Attempting rollback to last good git snapshot...")
        rb_res = rollback(sandbox_id, "v0.0.0")
        if rb_res.get("success"):
            print("   ✅ Rolled back cleanly. Retrying task.")
            return {
                "debugState": {**debug_state, "rollbackAttempted": True, "tier": 1, "attempts": 0},
                "reviewResult": {"verdict": "", "issues": [], "reviewCycle": 0},
                "executionResult": {"result": "", "output": "", "errors": ""},
            }

    # Tier 3 Human Escalation
    if tier >= 3 or (tier == 2 and attempts >= 2):
        print("   🆘 Escalating to human — debugger exhausted automated attempts")
        return {"debugState": {**debug_state, "tier": 3}}

    context_files = ""
    failing_files = current_task.get("filesToCreate", []) if current_task else []
    for fp in failing_files:
        content = read_file(sandbox_id, fp)
        if content:
            context_files += f"\n--- {fp} ---\n{content}\n"

    user_prompt = f"ERROR:\n{errors}\n\nTASK: {current_task.get('title') if current_task else ''}\nFILES:\n{context_files}"

    result = call_llm(
        system_prompt=DEBUGGER_PROMPT,
        user_prompt=user_prompt,
        agent_name="debuggerAgent",
        current_cost=state.get("tokenUsage", {}).get("estimatedCost", 0.0),
        token_budget=state.get("tokenBudget", 2.0),
        schema=DebuggerOutputModel,
        enable_web_search=True,
    )

    debug_info = result["parsed"]
    print(f"   🔍 Root cause: {debug_info.get('rootCause')}")
    print(f"   🔧 Fix: {debug_info.get('fix')}")

    new_attempts = attempts + 1
    should_promote = new_attempts >= debug_state.get("maxAttempts", 3)
    new_tier = tier + 1 if should_promote else tier

    return {
        "debugState": {
            "tier": new_tier,
            "attempts": 0 if should_promote else new_attempts,
            "maxAttempts": 2 if new_tier == 2 else 3,
            "rollbackAttempted": debug_state.get("rollbackAttempted", False),
        },
        "reviewResult": {
            "verdict": "rejected",
            "issues": [debug_info.get("rootCause"), debug_info.get("fix")],
            "reviewCycle": 0,
        },
        "tokenUsage": make_token_delta("debuggerAgent", result["tokens"]),
    }


def debugger_router(state: Dict[str, Any]) -> str:
    debug_state = state.get("debugState", {})
    if debug_state.get("tier", 1) >= 3:
        return "humanEscalation"
    return "coderAgent"
