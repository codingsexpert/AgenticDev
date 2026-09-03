"""
blueprint_validator.py — Blueprint Validation & Router
"""

from typing import Dict, Any


def blueprint_validator_node(state: Dict[str, Any]) -> Dict[str, Any]:
    print("\n🔍 [Blueprint Validator] Validating architectural blueprint...\n")
    blueprint = state.get("blueprint", {})
    validation = state.get("blueprintValidation", {"isValid": False, "issues": [], "validationCycles": 0})
    cycles = validation.get("validationCycles", 0) + 1

    issues = []
    if not blueprint.get("entities"):
        issues.append("Missing entities definition.")
    if not blueprint.get("dbSchema", {}).get("tables"):
        issues.append("Missing database schema tables.")
    if not blueprint.get("apiEndpoints"):
        issues.append("Missing API endpoints.")

    is_valid = len(issues) == 0 or cycles >= 3

    print(f"   Validation: {'PASSED' if is_valid else 'ISSUES FOUND'} (Cycle {cycles})")
    if issues:
        for iss in issues:
            print(f"   ⚠️ {iss}")

    return {
        "blueprintValidation": {
            "isValid": is_valid,
            "issues": issues,
            "validationCycles": cycles,
        }
    }


def blueprint_validator_router(state: Dict[str, Any]) -> str:
    val = state.get("blueprintValidation", {})
    if val.get("isValid", False):
        return "__end__"  # routes to plannerAgent in graph.py

    issues = val.get("issues", [])
    if any("entities" in i.lower() for i in issues):
        return "architectStep1"
    if any("schema" in i.lower() or "table" in i.lower() for i in issues):
        return "architectStep2"
    if any("endpoint" in i.lower() or "api" in i.lower() for i in issues):
        return "architectStep3"

    return "__end__"
