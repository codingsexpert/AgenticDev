"""
setup_sandbox.py — Node for Scaffold Sandbox Workspace Creation
"""

from typing import Dict, Any
from src.utils.sandbox_manager import create_sandbox


def setup_sandbox_node(state: Dict[str, Any]) -> Dict[str, Any]:
    print("\n [Setup Sandbox] Creating local filesystem sandbox workspace...\n")
    blueprint = state.get("blueprint", {})

    if state.get("sandboxId"):
        print(f"\n [Setup Sandbox] Existing sandbox detected: {state.get('sandboxId')}. Skipping creation.\n")
        return {}

    folder_struct = blueprint.get("folderStructure")
    setup_commands = blueprint.get("setupCommands", [])
    db_schema = blueprint.get("dbSchema")

    sandbox_id = create_sandbox(
        folder_structure=folder_struct,
        db_schema=db_schema,
    )

    if setup_commands:
        from src.utils.sandbox_manager import run_setup_commands
        print(f"    Running {len(setup_commands)} setup commands...")
        run_setup_commands(sandbox_id, setup_commands)

    print(f"    Sandbox initialized: {sandbox_id}")
    return {"sandboxId": sandbox_id}
