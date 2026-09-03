# 🤖 AI Dev Team — Multi-Agent Software Development System (Python Edition)

An autonomous multi-agent software development system built with **LangGraph Python**, **Google GenAI (Gemini)**, **Pydantic Guardrails**, and a **Docker-Free Pure Local Sandbox**.

---

## Key Features

1. **Python Native**: Built on LangGraph Python (`langgraph`), Pydantic v2, and `google-genai`.
2. **Built-in Guardrails Framework**:
   - **Input Guardrail**: Requirement sanitization & prompt injection prevention.
   - **Output Guardrail**: Strict JSON markdown cleaner & Pydantic schema validator.
   - **Execution Guardrail**: Local sandbox path boundaries & unsafe command blocking.
3. **Docker-Free Pure Local Sandbox**:
   - Runs isolated file operations and local process checks in `./sandboxes/sandbox-<id>`.
   - Uses local Git for automatic task snapshotting (`git tag`) and 3-tier rollback.
4. **Dynamic Tech Stack Support**:
   - No hardcoded tech stack restrictions. System adapts to Python FastAPI/Flask, Node.js Express, React/Vite, HTML/CSS/JS, SQLite, PostgreSQL, etc.
5. **No Hardcoded Secrets**: Dynamic JWT secret generation and configurable environment variables.

---

## Quick Start

### 1. Prerequisites

- Python 3.10+
- A Gemini API Key ([Get one from Google AI Studio](https://aistudio.google.com/apikey))

### 2. Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Set your GEMINI_API_KEY in .env file
echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env
```

### 3. Run CLI

```bash
# Option 1: Pass requirement directly
python main.py "Build a task manager web app with categories and due dates"

# Option 2: Interactive mode
python main.py

# Option 3: Resume thread checkpoint
python main.py --resume project-1774880000
```

---

## Testing

Run the automated Pytest test suite:

```bash
python -m pytest tests/
```

- `test_graph_skeleton.py`: Verifies LangGraph Python state machine graph wiring.
- `test_guardrails.py`: Verifies Input, Output, and Execution safety guardrails.
- `test_sandbox_manager.py`: Verifies local filesystem sandbox & subprocess execution without Docker.

---

## Project Structure

```
ai-dev-team/
├── main.py                     # Main CLI entry point
├── requirements.txt            # Python dependencies
├── .env                        # Environment configuration
├── src/
│   ├── config/
│   │   ├── state.py            # AgentState definition & Annotated reducers
│   │   └── graph.py            # LangGraph Python (27 nodes + routers)
│   ├── guardrails/
│   │   ├── input_guardrail.py  # Prompt injection & input validation
│   │   ├── output_guardrail.py # Pydantic schema validation & JSON cleaner
│   │   └── execution_guardrail.py # Sandbox path & command safety boundaries
│   ├── agents/
│   │   ├── pm_agent.py         # PM Agent — requirement → spec
│   │   ├── architect_agent.py  # 5-step architect agent
│   │   ├── blueprint_validator.py # Blueprint consistency check
│   │   ├── planner_agent.py    # Task queue generator
│   │   ├── coder_agent.py      # Code generator
│   │   ├── reviewer_agent.py   # Code reviewer
│   │   ├── executor_agent.py   # Local syntax & runtime checker
│   │   └── debugger_agent.py   # 3-tier error debugger
│   ├── nodes/
│   │   ├── human_input.py      # Terminal input node
│   │   ├── setup_sandbox.py    # Local sandbox workspace scaffold
│   │   ├── select_next_task.py # Task queue scheduler
│   │   └── ...                 # Context, snapshot, compaction nodes
│   └── utils/
│       ├── gemini_client.py    # Gemini API wrapper with budget controls
│       ├── sandbox_manager.py  # Docker-free local filesystem manager
│       └── token_tracker.py    # Token cost tracker
└── tests/
    ├── test_graph_skeleton.py
    ├── test_guardrails.py
    └── test_sandbox_manager.py
```
