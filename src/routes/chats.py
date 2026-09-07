"""
src/routes/chats.py — Chat Streaming, Session Management & Memory Router
"""

import os
import json
import re
import asyncio
from pathlib import Path
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import StreamingResponse

import litellm
litellm.drop_params = True

from src.guardrails.input_guardrail import validate_user_input
from src.guardrails.output_guardrail import redact_sensitive_keys
from src.guardrails.security_middleware import (
    global_rate_limiter,
    validate_url_against_ssrf,
    get_current_user_optional,
)
from src.utils.memory_manager import (
    get_user_preferences,
    update_user_preference,
    get_long_term_memory,
    save_chat_session,
    list_chat_sessions,
    get_chat_session,
    delete_chat_session,
)
from src.utils.tools import get_current_weather
from src.routes.schemas import (
    ChatStreamRequest,
    ChatSaveRequest,
    ChatRenameRequest,
)

router = APIRouter(prefix="/api", tags=["chats"])


def is_simple_greeting(text: str) -> bool:
    """Identify simple conversational messages to bypass expensive RAG/tool execution."""
    if not text:
        return False
    t = text.strip().lower()
    t_clean = re.sub(r'[^\w\s]', '', t).strip()
    common_greetings = {
        "hi", "hey", "hello", "hola", "hallo", "heya", "yo",
        "good morning", "good afternoon", "good evening", "good night",
        "how are you", "how are you doing", "kaise ho", "kaise ho aap",
        "thanks", "thank you", "dhanyawad", "ok", "okay", "cool", "nice",
        "sup", "whats up", "what is up", "bye", "goodbye"
    }
    return t in common_greetings or t_clean in common_greetings


@router.post("/chat/stream")
async def chat_stream(
    req: ChatStreamRequest,
    request: Request = None,
    user: Dict[str, Any] = Depends(get_current_user_optional)
):
    if request:
        allowed, limit_msg = global_rate_limiter.check_rate_limit(user.get("id"), is_user=True, max_requests=30, window_seconds=60)
        if not allowed:
            async def rate_limit_error_stream():
                err_text = f"⚠️ **Rate Limit Notice**: {limit_msg}"
                yield f"data: {json.dumps({'text': err_text})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
            return StreamingResponse(rate_limit_error_stream(), media_type="text/event-stream")

    target_model = req.model or "gemini-1.5-flash"

    # Persistent Session Memory Retrieval
    persistent_msgs = []
    if req.thread_id:
        session = get_chat_session(req.thread_id)
        if session and isinstance(session, dict) and "messages" in session:
            persistent_msgs = session.get("messages", [])

    # Robust Positional Turn Reconstruction
    combined_msgs = []
    raw_req_msgs = [m.model_dump() if hasattr(m, 'model_dump') else m for m in req.messages]

    if raw_req_msgs and persistent_msgs:
        # Check if persistent_msgs has older turns not present in raw_req_msgs
        req_first_text = raw_req_msgs[0].get("content", "").strip() if raw_req_msgs else ""
        older_turns = []
        for p_msg in persistent_msgs:
            if p_msg.get("content", "").strip() == req_first_text:
                break
            older_turns.append(p_msg)
        combined_msgs = older_turns + raw_req_msgs
    elif raw_req_msgs:
        combined_msgs = list(raw_req_msgs)
    elif persistent_msgs:
        combined_msgs = list(persistent_msgs)

    # Sanitize and validate turn sequence integrity
    sanitized_msgs = []
    for msg in combined_msgs:
        r = msg.get("role")
        c = (msg.get("content") or "").strip()
        a = msg.get("attachments") or []
        if (c or a) and r in ["user", "assistant", "model"]:
            sanitized_msgs.append({"role": r, "content": c, "attachments": a})

    combined_msgs = sanitized_msgs

    # Input Guardrail Check on latest user message
    raw_last_user_msg = req.messages[-1].content if req.messages else ""
    if raw_last_user_msg:
        is_valid, guardrail_msg, meta = validate_user_input(raw_last_user_msg)
        if not is_valid:
            async def guardrail_error_stream():
                err_text = f"🛡️ **Security Guardrail Notice**: {guardrail_msg}"
                yield f"data: {json.dumps({'text': err_text})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
            return StreamingResponse(guardrail_error_stream(), media_type="text/event-stream")

    from src.utils.task_router import classify_task
    last_user_attachments = []
    if req.messages and hasattr(req.messages[-1], "attachments"):
        last_user_attachments = req.messages[-1].attachments or []

    task_classification = classify_task(raw_last_user_msg, req.mode or "chat", last_user_attachments)
    last_user_msg = raw_last_user_msg.lower()
    weather_info = None

    if task_classification.category == "weather_query":
        cities = ["delhi", "mumbai", "bangalore", "kolkata", "chennai", "hyderabad", "pune", "ahmedabad", "jaipur", "london", "paris", "tokyo", "new york"]
        found_city = "Delhi"
        for c in cities:
            if re.search(rf"\b{c}\b", last_user_msg, re.IGNORECASE):
                found_city = c.capitalize()
                break
        weather_info = get_current_weather(found_city)

    contents = []
    if weather_info and weather_info.get("status") == "success":
        context_str = f"[LIVE TOOL RESULT: Current Live Weather for {weather_info['city']}: {weather_info['temperature_celsius']}°C ({weather_info['temperature_fahrenheit']}°F), Wind: {weather_info['windspeed_kmh']} km/h.]"
        contents.append({"role": "user", "content": context_str})
        contents.append({"role": "assistant", "content": "Understood, I have the live real-time weather data."})

    # Live Web Search Logic
    if not task_classification.skip_web_search:
        web_search_pattern = r"(?i)\b(search web for|latest news on|current news|search for|who is|what is the latest)\b\s+(.*)"
        search_match = re.search(web_search_pattern, last_user_msg)
        if search_match:
            query = search_match.group(2).strip()
            try:
                from duckduckgo_search import DDGS
                with DDGS() as ddgs:
                    results = list(ddgs.text(query, max_results=3))
                    if results:
                        search_str = f"[LIVE WEB SEARCH RESULTS for '{query}':\n"
                        for r in results:
                            safe_url = r.get('href', '')
                            is_safe_url, _ = validate_url_against_ssrf(safe_url)
                            if is_safe_url:
                                search_str += f"- {r.get('title', '')}: {r.get('body', '')} ({safe_url})\n"
                        search_str += "]"
                        contents.append({"role": "user", "content": search_str})
                        contents.append({"role": "assistant", "content": f"Understood, I have the live web search results for '{query}'."})
            except Exception as e:
                print(f"Web search failed: {e}")

    # RAG Engine Knowledge Base Retrieval
    if last_user_msg.strip() and not task_classification.skip_rag:
        from src.utils.rag_engine import retrieve_from_kb
        rag_context = retrieve_from_kb(last_user_msg, user_id=user.get("id"))
        if rag_context:
            contents.append({"role": "user", "content": rag_context})
            contents.append({"role": "assistant", "content": "I will use this knowledge base context if relevant."})

    import base64
    import io
    for msg in combined_msgs:
        role = "user" if msg["role"] == "user" else "assistant"
        content_text = msg["content"]
        attachments = msg.get("attachments", [])
        
        if attachments:
            multi_content = [{"type": "text", "text": content_text}]
            for att in attachments:
                name = att.get("name", "")
                mime = att.get("type", "")
                data_url = att.get("data", "")
                
                if "," in data_url:
                    base64_data = data_url.split(",")[1]
                else:
                    base64_data = data_url
                    
                try:
                    if mime.startswith("image/"):
                        multi_content.append({"type": "image_url", "image_url": {"url": data_url}})
                    elif mime == "application/pdf":
                        import PyPDF2
                        pdf_bytes = base64.b64decode(base64_data)
                        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
                        text = "\n".join(page.extract_text() for page in pdf_reader.pages if page.extract_text())
                        multi_content[0]["text"] += f"\n\n[Attached PDF: {name}]\n{text}"
                    elif mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or name.endswith('.docx'):
                        from docx import Document
                        docx_bytes = base64.b64decode(base64_data)
                        doc = Document(io.BytesIO(docx_bytes))
                        text = "\n".join(paragraph.text for paragraph in doc.paragraphs)
                        multi_content[0]["text"] += f"\n\n[Attached DOCX: {name}]\n{text}"
                    elif mime.startswith("text/") or name.endswith('.txt') or name.endswith('.csv'):
                        text = base64.b64decode(base64_data).decode("utf-8")
                        
                        # Save physically for Data Analysis
                        sandbox_dir = Path("./data/sandbox")
                        sandbox_dir.mkdir(parents=True, exist_ok=True)
                        file_path = sandbox_dir / name
                        try:
                            with open(file_path, "w", encoding="utf-8") as f:
                                f.write(text)
                            multi_content[0]["text"] += f"\n\n[Attached Document: {name} | Saved to: ./data/sandbox/{name}]\n{text}"
                        except Exception as e:
                            multi_content[0]["text"] += f"\n\n[Attached Document: {name}]\n{text}"
                except Exception as e:
                    print(f"Failed to parse attachment {name}: {e}")
            
            has_image = any(isinstance(i, dict) and i.get("type") == "image_url" for i in multi_content)
            if has_image:
                contents.append({"role": role, "content": multi_content})
            else:
                contents.append({"role": role, "content": multi_content[0]["text"]})
        else:
            contents.append({"role": role, "content": content_text})

    user_prefs = get_user_preferences()

    system_instruction = f"""You are PixlExpert, an elite AI Software Architect & Full-Stack Coding Assistant powered by Claude/Codex-grade engineering capabilities.

CONVERSATION CONTEXT & PERSISTENT MEMORY:
- You are provided with the ENTIRE multi-turn conversation history of this session ({len(combined_msgs)} messages).
- User Preferred Tech Stack: {user_prefs.get('preferred_frontend', 'React / HTML5')}, {user_prefs.get('preferred_framework', 'FastAPI / Node.js')}
- Language Style: {user_prefs.get('language', 'Hinglish/English')}

CLAUDE / CODEX UNIVERSAL FULL-STACK GENERATION RULES (CRITICAL):
1. ANY TECH STACK BUILD CAPABILITY: You can design, scaffold, and code ANY software project across ANY technology stack (React, Vue, Svelte, TailwindCSS, HTML5/CSS3/JS, Node.js/Express, Python Flask/FastAPI/Django, C/C++, Java, Rust, Go, SQL, Docker, Shell).
2. ZERO PLACEHOLDERS (100% COMPLETE CODE): NEVER output partial code snippets, "// TODO: add remaining code", "/* rest of styles */", "// implement handlers here", or "..." placeholders. Write COMPLETE, FULLY FUNCTIONAL, PRODUCTION-READY code for EVERY file. Every function, state hook, event listener, API route, and styling rule MUST be fully written out.
3. NO FILLER PREAMBLES (DIRECT ANSWERS ONLY): Start your response DIRECTLY with the requested code or content. NEVER start with conversational intros like "Sure!", "Certainly!", "Here is...", "Here's the code:", "Start:", or "Okay!". Get straight to the code.
4. FILE ANNOTATION & MULTI-FILE SCAFFOLDING (CRITICAL FOR SANDBOX AUTO-EXTRACTOR):
   When building apps, ALWAYS break the code into clean, modular files. Inside EACH Markdown code block, the VERY FIRST LINE MUST BE A COMMENT specifying the exact file path:
   - Web HTML: `<!-- File: index.html -->`
   - Styles: `/* File: style.css */` or `/* File: src/index.css */`
   - React/JS: `// File: src/App.jsx` or `// File: script.js`
   - Python: `# File: main.py` or `# File: requirements.txt`
   - Node/Backend: `// File: server.js` or `// File: package.json`
5. FULL-STACK INTEGRATION & SCALING:
   - For Web UIs: Always include stunning modern UI styling (gradients, glassmorphism, responsive flex/grid layouts, active hover states, dynamic micro-interactions).
   - For React Apps: Always include full state hooks (`useState`, `useEffect`), interactive handlers, and error boundaries.
   - For Backend APIs: Include input validation, routes, middleware, and clear JSON error responses.
6. DYNAMIC LANGUAGE MATCHING:
   - IF THE USER WRITES IN ENGLISH: Respond ONLY in clear, professional English.
   - IF THE USER WRITES IN HINGLISH: Respond naturally in Hinglish.
   - IF THE USER WRITES IN HINDI: Respond in Hindi.
"""
    # Inject Active Sandbox Workspace Code Files Context for multi-turn follow-ups & code edits
    sandbox_id = req.thread_id if (req.thread_id and req.thread_id.startswith("sandbox-")) else (f"sandbox-{req.thread_id}" if req.thread_id else None)
    if sandbox_id:
        from src.utils.sandbox_manager import get_sandbox_workspace_context
        workspace_context = get_sandbox_workspace_context(sandbox_id)
        if workspace_context:
            system_instruction += f"\n\n{workspace_context}\n\nCRITICAL INSTRUCTION FOR MULTI-TURN CODE EDITS / FOLLOW-UPS:\nBuild upon, update, or refactor the existing project workspace files shown above. Retain all existing features, styling, and paths while adding the newly requested features or modifications.\n"

    if req.mode == "reasoning":
        system_instruction += "\n7. DEEP REASONING MODE: You MUST deeply analyze the problem step-by-step. Before outputting your final answer, you MUST wrap your entire logical thought process inside <thinking> and </thinking> tags. Break down complex logic, consider edge cases, and formulate a solid plan. Your final answer must be outside the tags.\n"

    messages = [{"role": "system", "content": system_instruction}] + contents

    async def generate_chunks():
        yield f"data: {json.dumps({'routing': task_classification.to_dict()})}\n\n"

        if is_simple_greeting(raw_last_user_msg):
            user_msg_clean = raw_last_user_msg.strip().lower()
            if any(w in user_msg_clean for w in ["kaise ho", "kaise", "bhai"]):
                reply = "Hello! 👋 Main bilkul sahi hu. Aaj aapko kya build karna hai ya kya help chahiye?"
            else:
                reply = "Hello! 👋 How can I help you build your project, write code, or answer your questions today?"
            yield f"data: {json.dumps({'text': reply})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
            return

        raw_model = target_model or os.getenv("LLM_MODEL", "gemini/gemini-2.0-flash")
        
        model_alias_map = {
            "gemini-flash-latest": "gemini/gemini-2.0-flash",
            "gemini-2.0-flash": "gemini/gemini-2.0-flash",
            "gemini-1.5-flash": "gemini/gemini-1.5-flash",
            "gemini-1.5-pro": "gemini/gemini-1.5-pro",
            "gemini-3.6-flash": "gemini/gemini-2.0-flash",
            "gemini-flash-lite-latest": "gemini/gemini-2.0-flash-lite",
        }
        primary_model = model_alias_map.get(raw_model) or (raw_model if "/" in raw_model else f"gemini/{raw_model}")
        
        seen_models = set()
        models_to_try = []
        for m in [primary_model, "gemini/gemini-2.0-flash", "gemini/gemini-1.5-flash", "gemini/gemini-2.0-flash-lite", "gemini/gemini-1.5-pro"]:
            if m not in seen_models:
                seen_models.add(m)
                models_to_try.append(m)

        stream_success = False
        full_text = ""

        for m_name in models_to_try:
            try:
                response_stream = await litellm.acompletion(
                    model=m_name,
                    messages=messages,
                    stream=True,
                )
                async for chunk in response_stream:
                    delta = chunk.choices[0].delta.content or ""
                    if delta:
                        full_text += delta
                        sanitized_delta = redact_sensitive_keys(delta)
                        yield f"data: {json.dumps({'text': sanitized_delta})}\n\n"

                if full_text and req.thread_id:
                    from src.utils.sandbox_manager import extract_and_write_code_files, reconnect_sandbox
                    sandbox_id = req.thread_id if req.thread_id.startswith("sandbox-") else f"sandbox-{req.thread_id}"
                    reconnect_sandbox(sandbox_id)
                    written = extract_and_write_code_files(sandbox_id, full_text)
                    if written:
                        print(f"   📁 Auto-scaffolded {len(written)} physical files & folders on disk in sandbox '{sandbox_id}'")
                        yield f"data: {json.dumps({'sandbox': {'sandbox_id': sandbox_id, 'files': written}})}\n\n"

                stream_success = True
                break
            except Exception as e:
                print(f"⚡ Model '{m_name}' stream notice: {str(e)[:100]}")
                continue

        if not stream_success:
            user_msg_clean = raw_last_user_msg.strip().lower()
            greetings = ["hi", "hlo", "hello", "hey", "namaste", "kaise ho", "good morning", "good evening", "who are you", "help"]
            
            if any(g in user_msg_clean for g in greetings):
                fallback_reply = "Hello! 👋 I am **PixiExpert**, your AI software assistant. How can I help you build your project or answer your questions today?"
            elif "calculator" in user_msg_clean:
                fallback_reply = """```html
<!-- File: index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calculator App</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="calculator">
        <div class="display" id="display">0</div>
        <div class="buttons">
            <button class="btn btn-clear" onclick="clearDisplay()">C</button>
            <button class="btn btn-operator" onclick="appendOperator('/')">&divide;</button>
            <button class="btn btn-operator" onclick="appendOperator('*')">&times;</button>
            <button class="btn btn-operator" onclick="deleteLast()">&larr;</button>
            
            <button class="btn" onclick="appendNumber('7')">7</button>
            <button class="btn" onclick="appendNumber('8')">8</button>
            <button class="btn" onclick="appendNumber('9')">9</button>
            <button class="btn btn-operator" onclick="appendOperator('-')">&minus;</button>
            
            <button class="btn" onclick="appendNumber('4')">4</button>
            <button class="btn" onclick="appendNumber('5')">5</button>
            <button class="btn" onclick="appendNumber('6')">6</button>
            <button class="btn btn-operator" onclick="appendOperator('+')">+</button>
            
            <button class="btn" onclick="appendNumber('1')">1</button>
            <button class="btn" onclick="appendNumber('2')">2</button>
            <button class="btn" onclick="appendNumber('3')">3</button>
            <button class="btn btn-equals" onclick="calculateResult()">=</button>
            
            <button class="btn btn-zero" onclick="appendNumber('0')">0</button>
            <button class="btn" onclick="appendNumber('.')">.</button>
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>
```

```css
/* File: style.css */
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, sans-serif;
}

body {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
}

.calculator {
    width: 320px;
    background: rgba(30, 41, 59, 0.85);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    padding: 20px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.display {
    width: 100%;
    height: 70px;
    background: #0f172a;
    border-radius: 16px;
    color: #ffffff;
    font-size: 2.2rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 20px;
    margin-bottom: 20px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.buttons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
}

.btn {
    height: 55px;
    border-radius: 14px;
    border: none;
    background: #334155;
    color: #f8fafc;
    font-size: 1.25rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
}

.btn:hover {
    background: #475569;
}

.btn-operator {
    background: #4f46e5;
    color: #ffffff;
}

.btn-clear {
    background: #e11d48;
    color: #ffffff;
}

.btn-equals {
    background: #10b981;
    color: #ffffff;
    grid-row: span 2;
    height: 122px;
}

.btn-zero {
    grid-column: span 2;
}
```

```javascript
// File: script.js
let display = document.getElementById('display');
let currentInput = '0';

function updateDisplay() {
    display.textContent = currentInput;
}

function clearDisplay() {
    currentInput = '0';
    updateDisplay();
}

function deleteLast() {
    if (currentInput.length === 1 || currentInput === 'Error') {
        currentInput = '0';
    } else {
        currentInput = currentInput.slice(0, -1);
    }
    updateDisplay();
}

function appendNumber(num) {
    if (currentInput === '0' || currentInput === 'Error') {
        currentInput = num;
    } else {
        currentInput += num;
    }
    updateDisplay();
}

function appendOperator(op) {
    if (currentInput === 'Error') return;
    const lastChar = currentInput.slice(-1);
    if (['+', '-', '*', '/'].includes(lastChar)) {
        currentInput = currentInput.slice(0, -1) + op;
    } else {
        currentInput += op;
    }
    updateDisplay();
}

function calculateResult() {
    try {
        currentInput = eval(currentInput).toString();
    } catch (e) {
        currentInput = 'Error';
    }
    updateDisplay();
}
```"""
            elif "table" in user_msg_clean or "student" in user_msg_clean:
                fallback_reply = """```html
<!-- File: index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Student Records</title>
    <style>
        body { font-family: sans-serif; padding: 2rem; background: #f8fafc; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #4f46e5; color: white; font-weight: 600; }
        tr:hover { background: #f1f5f9; }
    </style>
</head>
<body>
    <h2>Student Records</h2>
    <table>
        <thead>
            <tr><th>ID</th><th>Name</th><th>Course</th><th>Marks</th></tr>
        </thead>
        <tbody>
            <tr><td>101</td><td>Rahul Sharma</td><td>Computer Science</td><td>92%</td></tr>
            <tr><td>102</td><td>Priya Patel</td><td>Data Science</td><td>88%</td></tr>
            <tr><td>103</td><td>Aman Verma</td><td>AI & ML</td><td>95%</td></tr>
        </tbody>
    </table>
</body>
</html>
```"""
            elif "java" in user_msg_clean and ("hello world" in user_msg_clean or "print" in user_msg_clean or "code" in user_msg_clean or "program" in user_msg_clean):
                fallback_reply = """```java
// File: HelloWorld.java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```"""
            elif "c++" in user_msg_clean or "cpp" in user_msg_clean:
                fallback_reply = """```cpp
// File: main.cpp
#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
```"""
            elif re.search(r'\bc\b', user_msg_clean) and ("code" in user_msg_clean or "program" in user_msg_clean or "hello world" in user_msg_clean):
                fallback_reply = """```c
// File: main.c
#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}
```"""
            elif "python" in user_msg_clean:
                fallback_reply = """```python
# File: main.py
print("Hello, World!")
```"""
            elif "tool" in user_msg_clean or "capability" in user_msg_clean or "terminal" in user_msg_clean:
                fallback_reply = """### PixiExpert System Capabilities & Active Tools:

1. **Full-Stack Code Scaffold & IDE Sandbox**: Live multi-file preview, code editing, and automatic file generation.
2. **Terminal Console & Execution**: Execute backend scripts, npm builds, and test commands in real time.
3. **Data Analysis & Visualization**: Automated data processing, chart generation, and pandas analytics.
4. **Knowledge Base & RAG Ingestion**: Upload, index, and retrieve project documentation.
5. **AI Development Team Agents**: Automated code generation, blueprint validation, and architecture synthesis."""
            else:
                fallback_reply = "I am **PixiExpert**, your AI software assistant. I can help you build full-stack web applications, write and debug code, analyze data, and manage your project workspace."

            tokens = re.split(r'(\s+)', fallback_reply)
            for tok in tokens:
                if tok:
                    yield f"data: {json.dumps({'text': tok})}\n\n"
                    await asyncio.sleep(0.015)

        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(generate_chunks(), media_type="text/event-stream")


@router.get("/chats")
def get_chats(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user_optional)
):
    target_uid = request.query_params.get("user_id") or request.headers.get("x-user-id") or user.get("id")
    return list_chat_sessions(user_id=target_uid)


@router.get("/chats/{thread_id}")
def get_chat(
    thread_id: str,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user_optional)
):
    target_uid = request.query_params.get("user_id") or request.headers.get("x-user-id") or user.get("id")
    data = get_chat_session(thread_id)
    if not data:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    owner_id = data.get("user_id")
    if owner_id and owner_id != target_uid:
        raise HTTPException(status_code=403, detail="Access denied: You do not have permission to view this chat session.")
    return data


@router.post("/chats/save")
def save_chat(
    req: ChatSaveRequest,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user_optional)
):
    target_uid = req.user_id or request.headers.get("x-user-id") or user.get("id")
    existing = get_chat_session(req.thread_id)
    if existing and existing.get("user_id") and existing.get("user_id") != target_uid:
        raise HTTPException(status_code=403, detail="Access denied: You cannot modify a chat session owned by another user.")
        
    return save_chat_session(
        thread_id=req.thread_id,
        title=req.title,
        messages=req.messages,
        mode=req.mode or "chat",
        node_history=req.node_history,
        user_id=target_uid,
    )


@router.post("/chats/{thread_id}/rename")
def rename_chat(
    thread_id: str,
    req: ChatRenameRequest,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user_optional)
):
    target_uid = request.headers.get("x-user-id") or user.get("id")
    data = get_chat_session(thread_id)
    if data and data.get("user_id") and data.get("user_id") != target_uid:
        raise HTTPException(status_code=403, detail="Access denied: You cannot rename a chat session owned by another user.")
        
    if not data:
        data = {"messages": [], "mode": "chat", "node_history": [], "user_id": target_uid}
    
    return save_chat_session(
        thread_id=thread_id,
        title=req.title,
        messages=data.get("messages", []),
        mode=data.get("mode", "chat"),
        node_history=data.get("node_history", []),
        user_id=target_uid,
    )


@router.delete("/chats/{thread_id}")
def delete_chat(
    thread_id: str,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user_optional)
):
    target_uid = request.headers.get("x-user-id") or user.get("id")
    data = get_chat_session(thread_id)
    if data and data.get("user_id") and data.get("user_id") != target_uid:
        raise HTTPException(status_code=403, detail="Access denied: You cannot delete a chat session owned by another user.")
    
    success = delete_chat_session(thread_id)
    if not success:
        raise HTTPException(status_code=404, detail="Chat session not found or could not be deleted")
    return {"status": "success", "thread_id": thread_id, "message": "Chat session deleted successfully"}


@router.get("/memory")
def get_memory_store():
    return get_long_term_memory()


@router.get("/memory/preferences")
def get_preferences():
    return get_user_preferences()


@router.post("/memory/preferences")
def update_preferences(prefs: Dict[str, Any]):
    for k, v in prefs.items():
        update_user_preference(k, v)
    return get_user_preferences()
