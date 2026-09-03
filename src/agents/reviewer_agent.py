"""
reviewer_agent.py — Code Reviewer Agent
Reviews generated code for correctness, security, imports, and consistency.
"""

from typing import Dict, Any
from src.utils.llm_client import call_llm
from src.utils.token_tracker import make_token_delta
from src.utils.sandbox_manager import read_file
from src.guardrails.output_guardrail import ReviewerOutputModel

REVIEWER_PROMPT = """You are the Reviewer Agent in an AI software development team.

ROLE: Senior code reviewer.

GOAL: Review written code for syntax correctness, imports, security, and completeness. Approve or reject with actionable feedback.

OUTPUT FORMAT (strict JSON):
{
  "verdict": "approved" | "rejected",
  "issues": ["Issue 1 if rejected", "Issue 2 if rejected"],
  "summary": "One line summary"
}
"""


def reviewer_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    current_cycle = state.get("reviewResult", {}).get("reviewCycle", 0)
    print(f"\n🔍 [Reviewer] Reviewing code (cycle {current_cycle + 1}/3)...\n")

    current_task = state.get("currentTask")
    coder_output = state.get("coderOutput")
    sandbox_id = state.get("sandboxId")

    if not current_task or not coder_output or not coder_output.get("files"):
        print("   ⚠️ Nothing to review")
        return {"reviewResult": {"verdict": "approved", "issues": [], "reviewCycle": 0}}

    code_content = ""
    for f in coder_output.get("files", []):
        f_path = f.get("path")
        if f_path and sandbox_id:
            content = read_file(sandbox_id, f_path)
            if content:
                code_content += f"\n--- {f_path} ---\n{content}\n"

    user_prompt = f"TASK: {current_task.get('title')}\n"
    user_prompt += f"CODE TO REVIEW:\n{code_content}\n"

    result = call_llm(
        system_prompt=REVIEWER_PROMPT,
        user_prompt=user_prompt,
        agent_name="reviewerAgent",
        current_cost=state.get("tokenUsage", {}).get("estimatedCost", 0.0),
        token_budget=state.get("tokenBudget", 2.0),
        schema=ReviewerOutputModel,
    )

    review = result["parsed"]
    verdict = review.get("verdict", "approved")
    issues = review.get("issues", [])

    if verdict == "approved":
        print(f"   ✅ APPROVED: {review.get('summary', 'Code looks good')}")
    else:
        print(f"   ❌ REJECTED: {review.get('summary', 'Issues found')}")
        for iss in issues:
            print(f"   • {iss}")

    return {
        "reviewResult": {
            "verdict": verdict,
            "issues": issues,
            "reviewCycle": current_cycle + 1,
            "summary": review.get("summary", ""),
        },
        "tokenUsage": make_token_delta("reviewerAgent", result["tokens"]),
    }


def reviewer_router(state: Dict[str, Any]) -> str:
    res = state.get("reviewResult", {})
    verdict = res.get("verdict")
    cycle = res.get("reviewCycle", 0)

    if verdict == "approved":
        return "executorAgent"
    if cycle >= 3:
        return "simplifyTask"
    return "coderAgent"
