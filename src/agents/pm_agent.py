"""
pm_agent.py — Project Manager Agent (Python Edition)

Generates project specifications from requirements, asking clarifying questions if ambiguous.
Tech stack is dynamic and determined per project requirements.
"""

from typing import Dict, Any
from src.utils.llm_client import call_llm
from src.utils.token_tracker import make_token_delta
from src.guardrails.output_guardrail import PMSpecModel

PM_SYSTEM_PROMPT = """You are the PM Agent in an AI software development team.

ROLE: Senior project manager who converts software requirements into clear, actionable specifications.

GOAL: Analyze the user's project requirement and ALWAYS generate a complete project specification.

RULES:
- NEVER return "needs_clarification" or ask questions.
- Make intelligent, reasonable assumptions for any underspecified details (e.g. tech stack, UI layout, pages, database schemas) and list them under "assumptions".
- ALWAYS return "status": "spec_ready".

OUTPUT FORMAT — You MUST return JSON with "status": "spec_ready":
{
  "status": "spec_ready",
  "spec": {
    "appName": "my-app",
    "description": "One-line description",
    "userRoles": ["admin", "user"],
    "authRequired": false,
    "techStack": {
      "frontend": "React (Vite) or HTML/CSS/JS",
      "backend": "Python FastAPI or Express.js",
      "database": "SQLite or Supabase"
    },
    "features": [
      {
        "name": "Feature Name",
        "description": "What it does",
        "subFeatures": ["sub1", "sub2"],
        "userAccess": ["admin", "user"]
      }
    ],
    "pages": [
      {
        "name": "Page Name",
        "route": "/route",
        "description": "What this page shows",
        "requiresAuth": false
      }
    ],
    "assumptions": ["Assumed standard responsive UI layout", "Assumed SQLite/JSON storage"]
  }
}
"""


def pm_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    print("\n🤖 [PM Agent] Analyzing requirement...\n")

    user_req = state.get("userRequirement", "")
    conversation = state.get("pmConversation", [])

    if not conversation:
        user_prompt = f'User\'s project requirement:\n"{user_req}"'
    else:
        user_prompt = f'Original requirement:\n"{user_req}"\n\nConversation history:\n'
        for entry in conversation:
            if isinstance(entry, dict):
                if entry.get("role") == "pm":
                    user_prompt += f"PM Questions: {entry.get('questions')}\n"
                elif entry.get("role") == "user":
                    user_prompt += f"User Answers: {entry.get('answers')}\n"
        user_prompt += '\nNow generate the FINAL spec incorporating all user answers. Return status: "spec_ready".'

    result = call_llm(
        system_prompt=PM_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        agent_name="pmAgent",
        current_cost=state.get("tokenUsage", {}).get("estimatedCost", 0.0),
        token_budget=state.get("tokenBudget", 2.0),
        schema=PMSpecModel,
    )

    response = result["parsed"]
    token_delta = make_token_delta("pmAgent", result["tokens"])
    status = response.get("status", "spec_ready")

    if status == "needs_clarification":
        questions = response.get("questions", [])
        assumptions = response.get("assumptions", [])
        print("❓ [PM Agent] Need more info. Questions:")
        for idx, q in enumerate(questions, 1):
            print(f"   {idx}. {q}")

        return {
            "pmStatus": "needs_clarification",
            "pmQuestions": questions,
            "pmConversation": [{"role": "pm", "questions": questions, "assumptions": assumptions}],
            "tokenUsage": token_delta,
            "currentPhase": "pm",
        }

    # Spec ready
    spec = response.get("spec") or response
    print("✅ [PM Agent] Spec ready!")
    print(f"   App: {spec.get('appName', 'app')}")
    print(f"   Features: {len(spec.get('features', []))}")

    return {
        "pmStatus": "spec_ready",
        "clarifiedSpec": spec,
        "pmConversation": [{"role": "pm", "spec": spec}],
        "tokenUsage": token_delta,
        "currentPhase": "architect",
    }
