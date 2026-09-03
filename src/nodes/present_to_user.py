"""
present_to_user.py — Final Presentation Node
"""

from typing import Dict, Any
from src.utils.sandbox_manager import get_file_list


def present_to_user_node(state: Dict[str, Any]) -> Dict[str, Any]:
    sandbox_id = state.get("sandboxId")
    spec = state.get("clarifiedSpec", {})

    print("\n" + "═" * 60)
    print("  🎉 PROJECT DEVELOPMENT COMPLETE!")
    print("═" * 60)
    if spec:
        print(f"  App Name:    {spec.get('appName', 'App')}")
        print(f"  Description: {spec.get('description', '')}")

    if sandbox_id:
        print(f"  Sandbox ID:  {sandbox_id}")
        files = get_file_list(sandbox_id)
        print(f"  Files Created: {len(files)}")
        for f in files[:15]:
            print(f"    📄 {f}")
        if len(files) > 15:
            print(f"    ... and {len(files) - 15} more files")

    print("═" * 60 + "\n")
    return {"currentPhase": "complete"}
