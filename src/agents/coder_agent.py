"""
coder_agent.py — Coder Agent (Python Edition)

Generates full code files for assigned tasks and writes them into local sandbox workspace.
Output is validated with CoderOutputModel Pydantic guardrail.
"""

import json
from typing import Dict, Any
from src.utils.llm_client import call_llm
from src.utils.token_tracker import make_token_delta
from src.utils.sandbox_manager import write_file
from src.guardrails.output_guardrail import CoderOutputModel

CODER_PROMPT = """You are the Coder Agent in an AI software development team.

ROLE: Senior full-stack developer who writes complete, working code.

GOAL: Write ALL files listed in the task cleanly and completely without placeholders or TODO comments.

OUTPUT FORMAT (strict JSON):
{
  "files": [
    {
      "path": "backend/src/index.js",
      "content": "// Complete code here"
    }
  ],
  "notes": "Brief implementation summary"
}

RULES:
- Write 100% complete, functional code. No empty placeholders or missing imports.
- Make code robust, well-structured, and compliant with project patterns.
- INTERCONNECTIVITY: You MUST properly connect all generated files to each other so the application works out-of-the-box. (e.g., HTML must link to CSS/JS with `<link>`/`<script>`, React components must `import` each other, Python files must `import` their modules, backend must serve frontend, etc.). The user should NEVER have to manually link or connect files you generated.
- If using Supabase for DB/Auth:
  - Python: Use `from supabase import create_client, Client`, initialize with `os.getenv("SUPABASE_URL")` and `os.getenv("SUPABASE_KEY")`.
  - JS/TS: Use `import { createClient } from '@supabase/supabase-js'`.
"""


def coder_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    print("\n💻 [Coder Agent] Writing code...\n")

    current_task = state.get("currentTask")
    context_pkg = state.get("contextPackage")
    sandbox_id = state.get("sandboxId")

    if not current_task or not sandbox_id:
        print("   ⚠️ Missing task or sandbox")
        return {"coderOutput": None}

    user_prompt = f"TASK: {current_task.get('title')}\n"
    user_prompt += f"DESCRIPTION: {current_task.get('description', '')}\n"
    files_to_create = current_task.get("filesToCreate", [])
    user_prompt += f"FILES TO CREATE:\n" + "\n".join(f"  - {f}" for f in files_to_create) + "\n\n"

    if context_pkg:
        user_prompt += f"CONTEXT PACKAGE:\n{json.dumps(context_pkg, indent=2)}\n\n"

    review_issues = state.get("reviewResult", {}).get("issues", [])
    if review_issues and state.get("reviewResult", {}).get("verdict") == "rejected":
        user_prompt += "\n⚠️ FIX THESE ISSUES FROM PREVIOUS REVIEW:\n"
        for iss in review_issues:
            user_prompt += f"  - {iss}\n"

    result = call_llm(
        system_prompt=CODER_PROMPT,
        user_prompt=user_prompt,
        agent_name="coderAgent",
        current_cost=state.get("tokenUsage", {}).get("estimatedCost", 0.0),
        token_budget=state.get("tokenBudget", 2.0),
        schema=CoderOutputModel,
        enable_web_search=True,
    )

    output = result["parsed"]
    files = output.get("files", [])

    files_written = 0
    for f_item in files:
        f_path = f_item.get("path")
        f_content = f_item.get("content")
        if f_path and f_content:
            try:
                write_file(sandbox_id, f_path, f_content)
                files_written += 1
                line_count = len(f_content.splitlines())
                print(f"   ✅ Written: {f_path} ({line_count} lines)")
            except Exception as err:
                print(f"   ❌ Failed to write {f_path}: {str(err)}")

    print(f"\n   📝 {files_written} files written to local sandbox")

    return {
        "coderOutput": {
            "files": [{"path": f.get("path"), "lines": len(f.get("content", "").splitlines())} for f in files],
            "notes": output.get("notes", ""),
        },
        "tokenUsage": make_token_delta("coderAgent", result["tokens"]),
    }
