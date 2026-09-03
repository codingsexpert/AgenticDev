"""
update_registry.py — Updates file registry with generated file interfaces
"""

from typing import Dict, Any


def update_registry_node(state: Dict[str, Any]) -> Dict[str, Any]:
    coder_output = state.get("coderOutput")
    files = coder_output.get("files", []) if coder_output else []

    new_entries = []
    for f in files:
        if isinstance(f, dict) and f.get("path"):
            new_entries.append({
                "path": f.get("path"),
                "lines": f.get("lines", 0),
            })

    print(f"\n📂 [File Registry] Registered {len(new_entries)} files")
    return {"fileRegistry": new_entries}
