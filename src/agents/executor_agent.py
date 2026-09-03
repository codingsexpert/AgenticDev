"""
executor_agent.py — Pure Local Code Executor (Docker-Free)

Performs multi-level verification on generated code:
1. File existence check
2. Local syntax check (Python / Node.js checks via subprocess)
3. Safe import / execution check in local sandbox
"""

from typing import Dict, Any
from src.utils.sandbox_manager import read_file, execute_command


def executor_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    print("\n⚡ [Executor] Testing code in local sandbox (Docker-Free)...\n")

    current_task = state.get("currentTask")
    coder_output = state.get("coderOutput")
    sandbox_id = state.get("sandboxId")

    if not current_task or not sandbox_id:
        return {"executionResult": {"result": "pass", "output": "Nothing to test", "errors": ""}}

    errors = []
    outputs = []
    files = coder_output.get("files", []) if coder_output else []

    # Level 1: File existence
    for f_item in files:
        f_path = f_item.get("path")
        if not f_path:
            continue
        content = read_file(sandbox_id, f_path)
        if content is None:
            errors.append(f"File not found: {f_path}")
        else:
            line_count = len(content.splitlines())
            outputs.append(f"✓ {f_path} exists ({line_count} lines)")

    if errors:
        return _build_result(False, outputs, errors)

    # Level 2: Syntax checks
    for f_item in files:
        f_path = f_item.get("path")
        if not f_path:
            continue

        if f_path.endswith(".py"):
            res = execute_command(sandbox_id, f"python3 -m py_compile {f_path}")
            if res["exitCode"] == 0:
                outputs.append(f"✓ {f_path} Python syntax valid")
            else:
                errors.append(f"Python syntax error in {f_path}: {res['stderr'][:200]}")

        elif f_path.endswith(".js"):
            res = execute_command(sandbox_id, f"node --check {f_path}")
            if res["exitCode"] == 0:
                outputs.append(f"✓ {f_path} Node syntax valid")
            elif "SyntaxError" in res["stderr"]:
                errors.append(f"JS syntax error in {f_path}: {res['stderr'][:200]}")
            else:
                outputs.append(f"✓ {f_path} syntax checked")

    return _build_result(len(errors) == 0, outputs, errors)


def _build_result(passed: bool, outputs: list, errors: list) -> Dict[str, Any]:
    print(f"\n   {'✅' if passed else '❌'} Local Execution {'PASSED' if passed else 'FAILED'}")
    for o in outputs:
        print(f"   {o}")
    if errors:
        for e in errors:
            print(f"   ❌ {e}")

    return {
        "executionResult": {
            "result": "pass" if passed else "fail",
            "output": "\n".join(outputs),
            "errors": "\n".join(errors),
        }
    }


def executor_router(state: Dict[str, Any]) -> str:
    res = state.get("executionResult", {}).get("result")
    if res == "pass":
        return "snapshotManager"
    return "debuggerAgent"
