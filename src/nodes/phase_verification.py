"""
phase_verification.py — Phase Verification Node & Router
"""

from typing import Dict, Any


def phase_verification_node(state: Dict[str, Any]) -> Dict[str, Any]:
    phase_idx = state.get("currentPhaseIndex", 0)
    print(f"\n🔍 [Phase Verification] Verifying Phase {phase_idx + 1} deliverables...")

    return {
        "currentPhaseIndex": phase_idx + 1,
        "currentTaskIndex": 0,
        "_phaseComplete": False,
    }


def phase_verification_router(state: Dict[str, Any]) -> str:
    return "patternExtractor"
