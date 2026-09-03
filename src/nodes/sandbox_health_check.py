"""
sandbox_health_check.py — Sandbox Health Check Node & Router
"""

from typing import Dict, Any
from src.utils.sandbox_manager import get_sandbox_info


def sandbox_health_check_node(state: Dict[str, Any]) -> Dict[str, Any]:
    sandbox_id = state.get("sandboxId")
    info = get_sandbox_info(sandbox_id) if sandbox_id else None

    healthy = info.get("healthy", False) if info else False
    print(f"\n🏥 [Sandbox Health Check] Status: {'HEALTHY' if healthy else 'UNHEALTHY'}")

    return {"sandboxHealthy": healthy}


def sandbox_health_router(state: Dict[str, Any]) -> str:
    healthy = state.get("sandboxHealthy", False)
    if healthy:
        return "__end__"  # routes to selectNextTask in graph.py
    return "setupSandbox"
