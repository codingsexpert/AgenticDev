"""
context_builder.py — Builds focused context package for the Coder
"""

from typing import Dict, Any


def context_builder_node(state: Dict[str, Any]) -> Dict[str, Any]:
    task = state.get("currentTask")
    blueprint = state.get("blueprint", {})
    spec = state.get("clarifiedSpec", {})
    file_registry = state.get("fileRegistry", [])
    patterns = state.get("projectPatterns", {})

    print("\n📦 [Context Builder] Assembling context package for Coder...")

    context_package = {
        "task": task,
        "appName": spec.get("appName", "app"),
        "authRequired": spec.get("authRequired", False),
        "dbSchema": blueprint.get("dbSchema"),
        "apiEndpoints": blueprint.get("apiEndpoints"),
        "patterns": patterns,
        "existingFiles": [f.get("path") for f in file_registry if isinstance(f, dict)],
    }

    return {"contextPackage": context_package}
