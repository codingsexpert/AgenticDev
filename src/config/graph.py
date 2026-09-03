"""
graph.py — LangGraph Python Definition with Full Dev Loop (27 Nodes)
"""

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from src.config.state import AgentState

# Phase 1
from src.agents.pm_agent import pm_agent_node
from src.nodes.human_input import human_input_node

# Phase 2
from src.agents.architect_agent import (
    architect_step1_node,
    architect_step2_node,
    architect_step3_node,
    architect_step4_node,
    architect_step5_node,
)
from src.agents.blueprint_validator import (
    blueprint_validator_node,
    blueprint_validator_router,
)

# Phase 3
from src.agents.planner_agent import planner_agent_node
from src.nodes.setup_sandbox import setup_sandbox_node
from src.nodes.sandbox_health_check import (
    sandbox_health_check_node,
    sandbox_health_router,
)

# Phase 4 — Dev Loop
from src.nodes.select_next_task import select_next_task_node, select_next_task_router
from src.nodes.context_builder import context_builder_node
from src.agents.coder_agent import coder_agent_node
from src.nodes.update_registry import update_registry_node
from src.agents.reviewer_agent import reviewer_agent_node, reviewer_router
from src.agents.executor_agent import executor_agent_node, executor_router
from src.nodes.snapshot_manager import snapshot_manager_node
from src.agents.debugger_agent import debugger_agent_node, debugger_router
from src.nodes.simplify_task import simplify_task_node
from src.nodes.human_escalation import human_escalation_node, human_escalation_router
from src.nodes.phase_verification import phase_verification_node, phase_verification_router
from src.nodes.pattern_extractor import pattern_extractor_node
from src.nodes.state_compactor import state_compactor_node
from src.nodes.present_to_user import present_to_user_node
from src.nodes.deployment_verifier import deployment_verifier_node, deployment_verifier_router


def build_graph(options: dict = None):
    options = options or {}
    checkpointer = options.get("checkpointer") or MemorySaver()

    graph = StateGraph(AgentState)

    # ─── ADD ALL NODES ────────────────────────────────────────

    # Phase 1
    graph.add_node("pmAgent", pm_agent_node)
    graph.add_node("humanInput", human_input_node)

    # Phase 2
    graph.add_node("architectStep1", architect_step1_node)
    graph.add_node("architectStep2", architect_step2_node)
    graph.add_node("architectStep3", architect_step3_node)
    graph.add_node("architectStep4", architect_step4_node)
    graph.add_node("architectStep5", architect_step5_node)
    graph.add_node("blueprintValidator", blueprint_validator_node)

    # Phase 3
    graph.add_node("plannerAgent", planner_agent_node)
    graph.add_node("setupSandbox", setup_sandbox_node)
    graph.add_node("sandboxHealthCheck", sandbox_health_check_node)

    # Phase 4 — Dev Loop
    graph.add_node("selectNextTask", select_next_task_node)
    graph.add_node("contextBuilder", context_builder_node)
    graph.add_node("coderAgent", coder_agent_node)
    graph.add_node("updateRegistry", update_registry_node)
    graph.add_node("reviewerAgent", reviewer_agent_node)
    graph.add_node("executorAgent", executor_agent_node)
    graph.add_node("snapshotManager", snapshot_manager_node)
    graph.add_node("debuggerAgent", debugger_agent_node)
    graph.add_node("simplifyTask", simplify_task_node)
    graph.add_node("humanEscalation", human_escalation_node)
    graph.add_node("phaseVerification", phase_verification_node)
    graph.add_node("patternExtractor", pattern_extractor_node)
    graph.add_node("stateCompactor", state_compactor_node)
    graph.add_node("presentToUser", present_to_user_node)
    graph.add_node("deploymentVerifier", deployment_verifier_node)

    # ─── EDGES & ROUTING ─────────────────────────────────────

    # Phase 1 — PM Agent
    graph.add_edge(START, "pmAgent")

    def pm_router(state: AgentState):
        import re
        req = (state.get("userRequirement") or "").lower()
        simple_pattern = r"\b(html|css|simple|landing\s+page|single\s+page|component|button)\b"
        if re.search(simple_pattern, req, re.IGNORECASE):
            # Skip heavy architecture for simple tasks; go straight to task planning
            return "plannerAgent"
        return "architectStep1"

    graph.add_conditional_edges("pmAgent", pm_router, {
        "plannerAgent": "plannerAgent",
        "architectStep1": "architectStep1"
    })
    graph.add_edge("humanInput", "pmAgent")

    # Phase 2 — Architect
    graph.add_edge("architectStep1", "architectStep2")
    graph.add_edge("architectStep2", "architectStep3")
    graph.add_edge("architectStep3", "architectStep4")
    graph.add_edge("architectStep4", "architectStep5")
    graph.add_edge("architectStep5", "blueprintValidator")

    graph.add_conditional_edges(
        "blueprintValidator",
        blueprint_validator_router,
        {
            "__end__": "plannerAgent",
            "architectStep1": "architectStep1",
            "architectStep2": "architectStep2",
            "architectStep3": "architectStep3",
        },
    )

    # Phase 3 — Planner + Sandbox
    graph.add_edge("plannerAgent", "setupSandbox")
    graph.add_edge("setupSandbox", "sandboxHealthCheck")

    graph.add_conditional_edges(
        "sandboxHealthCheck",
        sandbox_health_router,
        {
            "__end__": "selectNextTask",
            "setupSandbox": "setupSandbox",
        },
    )

    # Phase 4 — Dev Loop
    graph.add_conditional_edges(
        "selectNextTask",
        select_next_task_router,
        {
            "contextBuilder": "contextBuilder",
            "phaseVerification": "phaseVerification",
            "presentToUser": "deploymentVerifier",
        },
    )

    graph.add_edge("contextBuilder", "coderAgent")
    graph.add_edge("coderAgent", "updateRegistry")
    graph.add_edge("updateRegistry", "reviewerAgent")

    graph.add_conditional_edges(
        "reviewerAgent",
        reviewer_router,
        {
            "executorAgent": "executorAgent",
            "coderAgent": "coderAgent",
            "simplifyTask": "simplifyTask",
        },
    )

    graph.add_conditional_edges(
        "executorAgent",
        executor_router,
        {
            "snapshotManager": "snapshotManager",
            "debuggerAgent": "debuggerAgent",
        },
    )

    graph.add_edge("snapshotManager", "selectNextTask")

    graph.add_conditional_edges(
        "debuggerAgent",
        debugger_router,
        {
            "coderAgent": "coderAgent",
            "humanEscalation": "humanEscalation",
        },
    )

    graph.add_conditional_edges(
        "humanEscalation",
        human_escalation_router,
        {
            "selectNextTask": "selectNextTask",
            "coderAgent": "coderAgent",
            "simplifyTask": "simplifyTask",
        },
    )

    graph.add_edge("simplifyTask", "selectNextTask")

    graph.add_conditional_edges(
        "phaseVerification",
        phase_verification_router,
        {"patternExtractor": "patternExtractor"},
    )

    graph.add_edge("patternExtractor", "stateCompactor")
    graph.add_edge("stateCompactor", "selectNextTask")

    graph.add_conditional_edges(
        "deploymentVerifier",
        deployment_verifier_router,
        {"presentToUser": "presentToUser"},
    )

    graph.add_edge("presentToUser", END)

    compiled = graph.compile(checkpointer=checkpointer)
    print("✅ Python StateGraph compiled successfully (27 nodes)")
    return compiled


def create_checkpointer():
    return MemorySaver()
