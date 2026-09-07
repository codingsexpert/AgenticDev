# 🤖 AI Dev Team — Multi-Agent Software Development System

An autonomous multi-agent software development system built with **LangGraph Python**, **FastAPI**, **React (Vite)**, **Litellm**, and a **Docker-Free Pure Local Sandbox**. 

It features an interactive **Claude-like Web Dashboard** with real-time streaming, artifact code scaffolding, and a live preview IDE workspace.

---

## 🌟 Key Features

1. **Full-Stack Intelligent Agents**: Powered by LangGraph Python and Litellm (supporting Gemini, OpenAI, Anthropic).
2. **Interactive Web Dashboard**:
   - Modern **React (Vite)** frontend with TailwindCSS.
   - Claude-style Artifact cards for code rendering.
   - **Live Sandbox IDE** with multi-file tabs, syntax highlighting, and live rendering.
3. **Built-in Safety & Guardrails**:
   - **Input Guardrail**: Requirement sanitization & prompt injection prevention.
   - **Output Guardrail**: Strict JSON markdown cleaner & Pydantic schema validator.
   - **Execution Guardrail**: Local sandbox path boundaries & unsafe command blocking.
4. **Docker-Free Pure Local Sandbox**:
   - Runs isolated file operations and local process checks in `sandboxes/sandbox-<id>`.
5. **RAG Knowledge Base & Memory**: 
   - Context-aware chats with document uploads (PDF, DOCX, CSV) and vector retrieval.

---

## 🚀 Quick Start

### 1. Prerequisites

- Python 3.10+
- Node.js 18+
- API Key for your preferred LLM (e.g., Gemini API Key)

### 2. Backend Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Configure your environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY (or other LLM keys)

# Start the FastAPI Backend Server (with hot-reload)
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the Vite Dev Server
npm run dev
```

Visit `http://localhost:5173` in your browser to access the AI Dev Team Dashboard.

---

## 🧪 Testing

Run the automated Pytest test suite for the backend:

```bash
python -m pytest tests/
```

- `test_graph_skeleton.py`: Verifies LangGraph Python state machine graph wiring.
- `test_guardrails.py`: Verifies Input, Output, and Execution safety guardrails.
- `test_sandbox_manager.py`: Verifies local filesystem sandbox.

---

## 📂 Project Structure

```text
ai-dev-team/
├── server.py                   # FastAPI Web Server entry point
├── main.py                     # CLI entry point (optional)
├── requirements.txt            # Python dependencies
├── .env                        # Environment configuration
├── frontend/                   # React + Vite Web UI
│   ├── src/                    
│   │   ├── components/         # UI Components (Artifacts, Chat, etc.)
│   │   ├── routes/             # App routing
│   │   └── App.jsx             # Main React Application
│   └── package.json
├── src/                        # Python Backend
│   ├── routes/                 # FastAPI Endpoints (/chats, /projects, /sandboxes)
│   ├── config/                 # AgentState definition & LangGraph wiring
│   ├── guardrails/             # Security validations
│   ├── agents/                 # PM, Architect, Planner, Coder, Reviewer agents
│   ├── nodes/                  # LangGraph operational nodes
│   └── utils/                  # LLM clients, Sandbox manager, Token tracker
├── data/                       # Local DB, Memory sessions, and RAG Knowledge Base
└── tests/                      # Pytest automation suite
```

---

> **Note**: The `sandboxes/` and `data/sandbox/` directories are used purely for local practice and dynamic code generation by the agents. They are excluded from version control to keep the repository clean.
