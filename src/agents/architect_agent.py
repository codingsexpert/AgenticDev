"""
architect_agent.py — Architect Agent (5 Steps in Python)
"""

import json
from typing import Dict, Any
from src.utils.llm_client import call_llm
from src.utils.token_tracker import make_token_delta

NAMING_RULES = """
STRICT NAMING CONVENTION:
- Table names: snake_case + plural (e.g., "users", "todo_items", "categories")
- DB field names: snake_case (e.g., "created_at", "password_hash", "user_id")
- API paths: kebab-case + plural (e.g., "/api/users", "/api/todo-items")
- Foreign key format: "table_name(field)" (e.g., "users(id)")
"""

# STEP 1
STEP1_PROMPT = f"""You are the Architect Agent in an AI software development team.
GOAL: Identify ALL entities and relationships, AND generate a standard naming map.
CRITICAL: Tailor your design to the user's specific tech stack. If the user asks for a simple static site (HTML/CSS/JS) without a backend, DO NOT design database tables or APIs. Leave them empty if not needed.

{NAMING_RULES}

OUTPUT FORMAT (strict JSON):
{{
  "entities": [
    {{
      "name": "TodoItem",
      "tableName": "todo_items",
      "apiPath": "/api/todo-items",
      "modelFile": "todoItem",
      "routeFile": "todoItemRoutes",
      "description": "A task entry",
      "relationships": []
    }}
  ]
}}
"""

# STEP 2
STEP2_PROMPT = f"""You are the Architect Agent designing the database schema.

{NAMING_RULES}
CRITICAL: If the user requested a purely frontend or static app (e.g. HTML/CSS/JS) with no backend, set "databaseType" to "None" and leave "tables" empty.

OUTPUT FORMAT (strict JSON):
{{
  "databaseType": "Supabase (PostgreSQL)" | "SQLite" | "PostgreSQL" | "MongoDB",
  "databaseReason": "Reason for DB choice",
  "tables": [
    {{
      "name": "todo_items",
      "description": "Stores todo entries",
      "fields": [
        {{ "name": "id", "type": "INTEGER/UUID", "constraints": ["PRIMARY KEY"], "description": "ID" }},
        {{ "name": "title", "type": "VARCHAR(255)", "constraints": ["NOT NULL"], "description": "Title" }}
      ],
      "foreignKeys": [],
      "indexes": []
    }}
  ]
}}
"""

# STEP 3
STEP3_PROMPT = f"""You are the Architect Agent designing REST API endpoints.

{NAMING_RULES}
CRITICAL: If the user requested a purely frontend or static app with no backend, leave "apiEndpoints" empty.

OUTPUT FORMAT (strict JSON):
{{
  "apiEndpoints": [
    {{
      "method": "GET",
      "path": "/api/todo-items",
      "description": "Get all items",
      "requiresAuth": false,
      "requestBody": {{}},
      "responseBody": {{ "items": "array" }},
      "relatedTable": "todo_items"
    }}
  ]
}}
"""

# STEP 4
STEP4_PROMPT = """You are the Architect Agent designing frontend pages/components.

OUTPUT FORMAT (strict JSON):
{
  "frontendPages": [
    {
      "name": "DashboardPage",
      "route": "/dashboard",
      "description": "Main page",
      "requiresAuth": false,
      "components": [
        { "name": "TodoList", "description": "List component", "apiCalls": ["/api/todo-items"] }
      ]
    }
  ]
}
"""

# STEP 5
STEP5_PROMPT = """You are the Architect Agent generating project structure and dependencies.
CRITICAL: Tailor the folder structure and dependencies to the requested tech stack. 
- If the user asked for a simple HTML/CSS/JS app, do NOT create 'backend' or 'frontend' folders. Just place files like 'index.html', 'style.css', 'script.js' in the root structure.
- If it's a full-stack app, use 'backend' and 'frontend' modules.

OUTPUT FORMAT (strict JSON):
{
  "folderStructure": "tree-format string showing folder and file structure",
  "dependencies": {
    "project_module_name (e.g. 'root', 'frontend', or 'backend')": {
      "name": "module name",
      "dependencies": {},
      "devDependencies": {}
    }
  }
}
"""


def architect_step1_node(state: Dict[str, Any]) -> Dict[str, Any]:
    print("\n🏗️  [Architect Step 1/5] Identifying entities & naming map...\n")
    spec = state.get("clarifiedSpec", {})
    result = call_llm(
        system_prompt=STEP1_PROMPT,
        user_prompt=f"Project Specification:\n{json.dumps(spec, indent=2)}",
        agent_name="architectStep1",
        current_cost=state.get("tokenUsage", {}).get("estimatedCost", 0.0),
        token_budget=state.get("tokenBudget", 2.0),
    )
    entities = result["parsed"].get("entities", [])
    print(f"   Found {len(entities)} entities")
    return {
        "blueprint": {"entities": entities},
        "tokenUsage": make_token_delta("architectStep1", result["tokens"]),
    }


def architect_step2_node(state: Dict[str, Any]) -> Dict[str, Any]:
    print("\n🏗️  [Architect Step 2/5] Designing database schema...\n")
    blueprint = state.get("blueprint", {})
    spec = state.get("clarifiedSpec", {})
    result = call_llm(
        system_prompt=STEP2_PROMPT,
        user_prompt=f"Entities:\n{json.dumps(blueprint.get('entities', []), indent=2)}\n\nSpec:\n{json.dumps(spec, indent=2)}",
        agent_name="architectStep2",
        current_cost=state.get("tokenUsage", {}).get("estimatedCost", 0.0),
        token_budget=state.get("tokenBudget", 2.0),
    )
    schema = result["parsed"]
    print(f"   DB: {schema.get('databaseType', 'SQLite')}")
    return {
        "blueprint": {"dbSchema": schema},
        "tokenUsage": make_token_delta("architectStep2", result["tokens"]),
    }


def architect_step3_node(state: Dict[str, Any]) -> Dict[str, Any]:
    print("\n🏗️  [Architect Step 3/5] Designing API endpoints...\n")
    blueprint = state.get("blueprint", {})
    result = call_llm(
        system_prompt=STEP3_PROMPT,
        user_prompt=f"Entities:\n{json.dumps(blueprint.get('entities', []), indent=2)}\n\nDB Schema:\n{json.dumps(blueprint.get('dbSchema', {}), indent=2)}",
        agent_name="architectStep3",
        current_cost=state.get("tokenUsage", {}).get("estimatedCost", 0.0),
        token_budget=state.get("tokenBudget", 2.0),
    )
    endpoints = result["parsed"].get("apiEndpoints", [])
    print(f"   Designed {len(endpoints)} API endpoints")
    return {
        "blueprint": {"apiEndpoints": endpoints},
        "tokenUsage": make_token_delta("architectStep3", result["tokens"]),
    }


def architect_step4_node(state: Dict[str, Any]) -> Dict[str, Any]:
    print("\n🏗️  [Architect Step 4/5] Designing frontend pages...\n")
    blueprint = state.get("blueprint", {})
    result = call_llm(
        system_prompt=STEP4_PROMPT,
        user_prompt=f"APIs:\n{json.dumps(blueprint.get('apiEndpoints', []), indent=2)}",
        agent_name="architectStep4",
        current_cost=state.get("tokenUsage", {}).get("estimatedCost", 0.0),
        token_budget=state.get("tokenBudget", 2.0),
    )
    pages = result["parsed"].get("frontendPages", [])
    print(f"   Designed {len(pages)} pages")
    return {
        "blueprint": {"frontendPages": pages},
        "tokenUsage": make_token_delta("architectStep4", result["tokens"]),
    }


def architect_step5_node(state: Dict[str, Any]) -> Dict[str, Any]:
    print("\n🏗️  [Architect Step 5/5] Generating folder structure & dependencies...\n")
    blueprint = state.get("blueprint", {})
    result = call_llm(
        system_prompt=STEP5_PROMPT,
        user_prompt=f"Blueprint Summary:\n{json.dumps(blueprint, indent=2)}",
        agent_name="architectStep5",
        current_cost=state.get("tokenUsage", {}).get("estimatedCost", 0.0),
        token_budget=state.get("tokenBudget", 2.0),
    )
    out = result["parsed"]
    return {
        "blueprint": {
            "folderStructure": out.get("folderStructure", ""),
            "dependencies": out.get("dependencies", {}),
        },
        "tokenUsage": make_token_delta("architectStep5", result["tokens"]),
    }
