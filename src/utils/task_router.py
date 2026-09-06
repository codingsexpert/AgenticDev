"""
task_router.py — Intelligent Task Routing & Complexity Classifier Engine
Classifies incoming user requests into Complexity Levels (0 to 4) to dynamically
select ONLY required agents, tools, and processing pipelines.
"""

import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class TaskClassification:
    level: int  # 0: Conversation, 1: Simple Task/QA, 2: Medium Task, 3: Complex Feature, 4: Full App Build
    category: str  # conversation, simple_qa, code_fix, data_analysis, research, feature_build, full_app_build
    required_agents: List[str] = field(default_factory=list)
    required_tools: List[str] = field(default_factory=list)
    skip_rag: bool = True
    skip_web_search: bool = True
    skip_sandbox: bool = True
    reasoning: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "level": self.level,
            "category": self.category,
            "required_agents": self.required_agents,
            "required_tools": self.required_tools,
            "skip_rag": self.skip_rag,
            "skip_web_search": self.skip_web_search,
            "skip_sandbox": self.skip_sandbox,
            "reasoning": self.reasoning,
        }


# Fast Regex Patterns
GREETINGS_PATTERN = r"^(hi|hey|hello|hola|hallo|heya|yo|good morning|good afternoon|good evening|good night|how are you|how are you doing|kaise ho|kaise ho aap|thanks|thank you|dhanyawad|ok|okay|cool|nice|sup|whats up|what is up|bye|goodbye)[!?.]*$"

SIMPLE_QA_PATTERN = r"^\s*(what is|what are|explain|define|how does|why is|difference between|summarize|translate|format as json|convert to json)\b"

BUILD_INTENT_PATTERN = r"\b(build|create|develop|scaffold|generate|make)\s+a\b.*(app|application|website|dashboard|saas|platform|system|portal|tool|clone|service)"
CODE_FIX_PATTERN = r"\b(fix|debug|refactor|optimize|write|implement|add feature|update|edit)\b.*(code|func|function|class|bug|error|component|script|api)"
RESEARCH_PATTERN = r"\b(search web for|latest news on|current news|search for|who is|what is the latest|compare latest)\b"
WEATHER_PATTERN = r"\b(weather|mausam|temperature|climate)\b"


def classify_task(
    prompt: str,
    mode: str = "chat",
    attachments: Optional[List[Dict[str, Any]]] = None
) -> TaskClassification:
    """
    Intelligently analyzes prompt, mode, and attachments to classify request complexity (0 to 4)
    and determine the exact set of required agents and tools.
    """
    attachments = attachments or []
    clean_prompt = prompt.strip()
    prompt_lower = clean_prompt.lower()
    prompt_len = len(clean_prompt)

    # -------------------------------------------------------------
    # LEVEL 0: Simple Conversation (Instant Fast-Path < 1ms)
    # -------------------------------------------------------------
    if re.match(GREETINGS_PATTERN, prompt_lower, re.IGNORECASE) and not attachments:
        return TaskClassification(
            level=0,
            category="conversation",
            required_agents=["chatAgent"],
            required_tools=[],
            skip_rag=True,
            skip_web_search=True,
            skip_sandbox=True,
            reasoning="Simple greeting detected. Fast-path direct conversational response without agent overhead."
        )

    # -------------------------------------------------------------
    # LEVEL 4: Explicit Build Mode or Full App Creation Intent
    # -------------------------------------------------------------
    if mode == "build" or (re.search(BUILD_INTENT_PATTERN, prompt_lower, re.IGNORECASE) and prompt_len > 30):
        return TaskClassification(
            level=4,
            category="full_app_build",
            required_agents=[
                "pmAgent", "architectAgent", "plannerAgent", "coderAgent",
                "reviewerAgent", "executorAgent", "debuggerAgent", "deploymentVerifier"
            ],
            required_tools=["sandbox", "code_scaffolder"],
            skip_rag=False,
            skip_web_search=False,
            skip_sandbox=False,
            reasoning="Full application development request detected. Activating full multi-agent orchestration pipeline."
        )

    # -------------------------------------------------------------
    # LEVEL 2: Data Analysis (Attachments attached)
    # -------------------------------------------------------------
    if attachments:
        has_csv_or_doc = any(
            att.get("type", "").startswith("text/") or
            att.get("name", "").endswith((".csv", ".txt", ".pdf", ".docx"))
            for att in attachments
        )
        if has_csv_or_doc:
            return TaskClassification(
                level=2,
                category="data_analysis",
                required_agents=["coderAgent", "executorAgent"],
                required_tools=["sandbox", "pandas", "file_parser"],
                skip_rag=True,
                skip_web_search=True,
                skip_sandbox=False,
                reasoning="Document/CSV attachment provided. Activating file parser and pandas sandbox analysis execution."
            )

    # -------------------------------------------------------------
    # LEVEL 2: Live Research / Weather Tool Query
    # -------------------------------------------------------------
    if re.search(RESEARCH_PATTERN, prompt_lower, re.IGNORECASE):
        return TaskClassification(
            level=2,
            category="research",
            required_agents=["researchAgent"],
            required_tools=["web_search"],
            skip_rag=True,
            skip_web_search=False,
            skip_sandbox=True,
            reasoning="Live web search query detected. Activating Research Agent with DuckDuckGo web search tool."
        )

    if re.search(WEATHER_PATTERN, prompt_lower, re.IGNORECASE):
        return TaskClassification(
            level=2,
            category="weather_query",
            required_agents=["toolAgent"],
            required_tools=["weather_api"],
            skip_rag=True,
            skip_web_search=True,
            skip_sandbox=True,
            reasoning="Live weather query detected. Executing targeted Weather tool."
        )

    # -------------------------------------------------------------
    # LEVEL 1: Simple Knowledge / QA / Short Explanation
    # -------------------------------------------------------------
    if re.match(SIMPLE_QA_PATTERN, prompt_lower, re.IGNORECASE) and prompt_len < 300:
        return TaskClassification(
            level=1,
            category="simple_qa",
            required_agents=["knowledgeAgent"],
            required_tools=[],
            skip_rag=True,
            skip_web_search=True,
            skip_sandbox=True,
            reasoning="Simple knowledge or concept explanation question. Direct specialized response without heavy tools."
        )

    # -------------------------------------------------------------
    # LEVEL 3: Medium/Complex Code Fix or Component Modification
    # -------------------------------------------------------------
    if re.search(CODE_FIX_PATTERN, prompt_lower, re.IGNORECASE) or ("```" in clean_prompt and prompt_len > 100):
        return TaskClassification(
            level=3,
            category="code_fix",
            required_agents=["coderAgent", "reviewerAgent"],
            required_tools=["sandbox"],
            skip_rag=True,
            skip_web_search=True,
            skip_sandbox=False,
            reasoning="Code modification or debugging task. Activating Coder Agent, Reviewer Agent, and Sandbox testing."
        )

    # Default Fallback: Level 1 Simple General Response
    return TaskClassification(
        level=1,
        category="general_query",
        required_agents=["chatAgent"],
        required_tools=[],
        skip_rag=True,
        skip_web_search=True,
        skip_sandbox=True,
        reasoning="General question. Standard single-turn response pipeline."
    )
