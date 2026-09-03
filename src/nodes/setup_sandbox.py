"""
setup_sandbox.py — Node for Scaffold Sandbox Workspace Creation
"""

from typing import Dict, Any
from src.utils.sandbox_manager import create_sandbox


def setup_sandbox_node(state: Dict[str, Any]) -> Dict[str, Any]:
    print("\n📦 [Setup Sandbox] Creating local filesystem sandbox workspace...\n")
    blueprint = state.get("blueprint", {})

    folder_struct = blueprint.get("folderStructure")
    dependencies = blueprint.get("dependencies")
    db_schema = blueprint.get("dbSchema")

    sandbox_id = create_sandbox(
        folder_structure=folder_struct,
        dependencies=dependencies,
        db_schema=db_schema,
    )

    print(f"   ✅ Sandbox initialized: {sandbox_id}")
    return {"sandboxId": sandbox_id}
