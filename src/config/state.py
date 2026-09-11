"""
state.py — Complete V2 State Definition for AI Dev Team (Python Edition)

In LangGraph Python, state is defined using TypedDict with Annotated reducers.
Every node reads from and writes to this state.
"""

from typing import Annotated, Any, Dict, List, Optional, TypedDict
import operator


def reduce_conversation(existing: List[Any], incoming: Any) -> List[Any]:
    if incoming is None:
        return existing
    if isinstance(incoming, list):
        return existing + incoming
    return existing + [incoming]


def reduce_dict_merge(existing: Dict[str, Any], incoming: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not incoming:
        return existing or {}
    merged = dict(existing or {})
    merged.update(incoming)
    return merged


def reduce_file_registry(existing: List[Dict[str, Any]], incoming: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    if not incoming:
        return existing or []
    if isinstance(incoming, list):
        registry_map = {item.get("path"): item for item in (existing or []) if isinstance(item, dict) and "path" in item}
        for item in incoming:
            if isinstance(item, dict) and "path" in item:
                registry_map[item["path"]] = item
        return list(registry_map.values())
    return existing or []


def reduce_token_usage(existing: Dict[str, Any], incoming: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not existing:
        existing = {
            "calls": [],
            "totalInput": 0,
            "totalOutput": 0,
            "estimatedCost": 0.0,
        }
    if not incoming:
        return existing

    new_calls = incoming.get("newCalls", [])
    added_input = incoming.get("addedInput", 0)
    added_output = incoming.get("addedOutput", 0)
    added_cost = incoming.get("addedCost", 0.0)

    return {
        "calls": existing.get("calls", []) + new_calls,
        "totalInput": existing.get("totalInput", 0) + added_input,
        "totalOutput": existing.get("totalOutput", 0) + added_output,
        "estimatedCost": round(existing.get("estimatedCost", 0.0) + added_cost, 6),
    }


class AgentState(TypedDict, total=False):
    # User Input
    userRequirement: str
    chatHistory: Annotated[List[Any], reduce_conversation]

    # PM Agent
    pmStatus: str  # idle | needs_clarification | spec_ready
    pmQuestions: List[str]
    pmConversation: Annotated[List[Any], reduce_conversation]
    clarifiedSpec: Optional[Dict[str, Any]]

    # Architect Agent
    blueprint: Annotated[Dict[str, Any], reduce_dict_merge]

    # Blueprint Validator
    blueprintValidation: Dict[str, Any]

    # Planner Agent
    taskQueue: Dict[str, Any]
    currentPhaseIndex: int
    currentTaskIndex: int

    # File Registry
    fileRegistry: Annotated[List[Dict[str, Any]], reduce_file_registry]

    # Project Patterns
    projectPatterns: Annotated[Dict[str, Any], reduce_dict_merge]

    # Sandbox
    sandboxId: str
    sandboxHealthy: bool

    # Dev Loop
    currentTask: Optional[Dict[str, Any]]
    taskStatuses: Annotated[Dict[str, Any], reduce_dict_merge]
    contextPackage: Optional[Dict[str, Any]]
    coderOutput: Optional[Dict[str, Any]]

    # Reviewer
    reviewResult: Dict[str, Any]

    # Executor
    executionResult: Dict[str, Any]

    # Debugger
    debugState: Dict[str, Any]

    # User Feedback
    userFeedback: Annotated[List[Any], reduce_conversation]
    feedbackIteration: int
    maxFeedbackIterations: int
    scopeDrift: float
    userSatisfied: bool

    # Deployment
    deploymentConfig: Dict[str, Any]
    deploymentAttempts: int

    # Token Tracking
    tokenUsage: Annotated[Dict[str, Any], reduce_token_usage]
    tokenBudget: float

    # Control & Phase
    currentPhase: str
    error: Optional[str]


def create_initial_state(user_requirement: str = "", chat_history: List[Any] = None, token_budget: float = 2.0) -> AgentState:
    return {
        "userRequirement": user_requirement,
        "chatHistory": chat_history or [],
        "pmStatus": "idle",
        "tokenBudget": token_budget,
        "userSatisfied": False,
        "deploymentConfig": {"platform": "", "files": [], "instructions": []},
        "deploymentAttempts": 0,
        "tokenUsage": {
            "calls": [],
            "totalInput": 0,
            "totalOutput": 0,
            "estimatedCost": 0.0,
        },
        "tokenBudget": token_budget,
        "currentPhase": "pm",
        "error": None,
    }
