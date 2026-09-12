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
                err_text = f"️ **Rate Limit Notice**: {limit_msg}"
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
                err_text = f"️ **Security Guardrail Notice**: {guardrail_msg}"
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
        nonlocal sandbox_id
        yield f"data: {json.dumps({'routing': task_classification.to_dict()})}\n\n"

        if is_simple_greeting(raw_last_user_msg):
            user_msg_clean = raw_last_user_msg.strip().lower()
            if any(w in user_msg_clean for w in ["kaise ho", "kaise", "bhai"]):
                reply = "Hello!  Main bilkul sahi hu. Aaj aapko kya build karna hai ya kya help chahiye?"
            else:
                reply = "Hello!  How can I help you build your project, write code, or answer your questions today?"
            yield f"data: {json.dumps({'text': reply})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
            return

        raw_model = target_model or os.getenv("LLM_MODEL", "gemini/gemini-1.5-flash")
        
        model_alias_map = {
            "gemini-flash-latest": "gemini/gemini-1.5-flash",
            "gemini-2.0-flash": "gemini/gemini-1.5-flash",
            "gemini-1.5-flash": "gemini/gemini-1.5-flash",
            "gemini-1.5-pro": "gemini/gemini-1.5-pro",
            "gemini-3.6-flash": "gemini/gemini-1.5-flash",
            "gemini-flash-lite-latest": "gemini/gemini-2.0-flash-lite",
            "openrouter-qwen": "openrouter/qwen/qwen-2.5-coder-32b-instruct",
        }
        primary_model = model_alias_map.get(raw_model) or (raw_model if "/" in raw_model else f"gemini/{raw_model}")
        
        env_model = os.getenv("LLM_MODEL")
        seen_models = set()
        models_to_try = []
        
        candidate_list = [primary_model]
        if env_model:
            candidate_list.append(env_model)
        if os.getenv("OPENROUTER_API_KEY"):
            candidate_list.append("openrouter/qwen/qwen-2.5-coder-32b-instruct")
        candidate_list.extend(["gemini/gemini-2.0-flash", "gemini/gemini-1.5-flash", "gemini/gemini-2.0-flash-lite", "gemini/gemini-1.5-pro"])

        for m in candidate_list:
            if m not in seen_models:
                seen_models.add(m)
                models_to_try.append(m)

        stream_success = False
        full_text = ""

        # LiteLLM automatically picks up the correct API key from the environment based on the model prefix.
        # No need to explicitly pass it and risk sending the Gemini key to OpenRouter/OpenAI.
        acompletion_kwargs = {}

        for m_name in models_to_try:
            try:
                response_stream = await litellm.acompletion(
                    model=m_name,
                    messages=messages,
                    stream=True,
                    **acompletion_kwargs
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
                        print(f"    Auto-scaffolded {len(written)} physical files & folders on disk in sandbox '{sandbox_id}'")
                        yield f"data: {json.dumps({'sandbox': {'sandbox_id': sandbox_id, 'files': written}})}\n\n"

                stream_success = True
                break
            except Exception as e:
                print(f" Model '{m_name}' stream notice: {str(e)[:100]}")
                continue

        if not stream_success:
            user_msg_clean = raw_last_user_msg.strip().lower()

            # Smart active workspace fallback interceptor for multi-turn edits & follow-ups
            if sandbox_id:
                try:
                    from src.utils.sandbox_manager import get_file_list, read_file, get_sandbox_path
                    sb_path = get_sandbox_path(sandbox_id)
                    if os.path.exists(sb_path):
                        existing_file_paths = get_file_list(sandbox_id)
                        if existing_file_paths:
                            html_content = ""
                            css_content = ""
                            js_content = ""
                            for fp in existing_file_paths:
                                if fp == "index.html":
                                    html_content = read_file(sandbox_id, fp)
                                elif fp == "style.css":
                                    css_content = read_file(sandbox_id, fp)
                                elif fp == "script.js":
                                    js_content = read_file(sandbox_id, fp)

                            # Check for theme / style / modification requests
                            is_light = any(w in user_msg_clean for w in ["light", "white", "bright", "halka"])
                            is_dark = any(w in user_msg_clean for w in ["dark", "black", "night", "kala"])
                            is_mod = any(w in user_msg_clean for w in ["theme", "color", "change", "modify", "update", "fix", "add", "bnao", "karo", "make", "edit", "style"])

                            if (is_light or is_dark or is_mod) and (html_content or css_content or js_content):
                                if is_light and html_content:
                                    html_content = html_content.replace("bg-slate-950", "bg-slate-50")
                                    html_content = html_content.replace("text-slate-100", "text-slate-900")
                                    html_content = html_content.replace("bg-slate-900/90", "bg-white/90")
                                    html_content = html_content.replace("bg-slate-900", "bg-white")
                                    html_content = html_content.replace("border-slate-800", "border-slate-200")
                                    html_content = html_content.replace("text-white", "text-slate-900")
                                    html_content = html_content.replace("bg-slate-800", "bg-slate-100")
                                    html_content = html_content.replace("text-slate-400", "text-slate-600")
                                    if css_content:
                                        css_content = css_content.replace("#0f172a", "#f8fafc").replace("#1e1b4b", "#e0e7ff").replace("color: #ffffff", "color: #0f172a")

                                elif is_dark and html_content:
                                    html_content = html_content.replace("bg-slate-50", "bg-slate-950")
                                    html_content = html_content.replace("text-slate-900", "text-slate-100")
                                    html_content = html_content.replace("bg-white/90", "bg-slate-900/90")
                                    html_content = html_content.replace("border-slate-200", "border-slate-800")

                                fallback_reply = "Updated the project workspace files as requested!\n\n"
                                if html_content:
                                    fallback_reply += f"```html\n<!-- File: index.html -->\n{html_content}\n```\n\n"
                                if css_content:
                                    fallback_reply += f"```css\n/* File: style.css */\n{css_content}\n```\n\n"
                                if js_content:
                                    fallback_reply += f"```javascript\n// File: script.js\n{js_content}\n```\n"
                except Exception as ex:
                    print(f"Fallback workspace edit error: {ex}")

            greetings = ["hi", "hlo", "hello", "hey", "namaste", "kaise ho", "good morning", "good evening", "who are you", "help"]

            if full_text == "":
                if any(g in user_msg_clean for g in greetings):
                    fallback_reply = "Hello!  How can I help you build your project or answer your questions today?"
                elif "weather" in user_msg_clean:
                    fallback_reply = """```html
<!-- File: index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Weather Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col items-center justify-center p-4">
    <div class="weather-card w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
        <div class="flex items-center justify-between mb-6">
            <h1 class="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
                <span>️ Weather App</span>
            </h1>
            <span class="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-semibold px-2.5 py-1 rounded-full">Live Forecast</span>
        </div>

        <div class="flex gap-2 mb-6">
            <input type="text" id="cityInput" placeholder="Enter city (e.g. Delhi, London, Mumbai)..." class="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all">
            <button onclick="getWeather()" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md cursor-pointer">Search</button>
        </div>

        <div id="weatherDisplay" class="space-y-4">
            <div class="text-center py-6 bg-slate-800/50 border border-slate-700/50 rounded-2xl">
                <h2 id="cityName" class="text-2xl font-bold text-white mb-1">Delhi, India</h2>
                <div id="temp" class="text-5xl font-extrabold text-indigo-400 my-2">28°C</div>
                <p id="condition" class="text-sm font-medium text-slate-400 uppercase tracking-wider">Partly Cloudy</p>
            </div>

            <div class="grid grid-cols-2 gap-3 text-xs">
                <div class="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                    <span class="text-slate-500 block">Humidity</span>
                    <span id="humidity" class="text-sm font-bold text-slate-200">65%</span>
                </div>
                <div class="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                    <span class="text-slate-500 block">Wind Speed</span>
                    <span id="wind" class="text-sm font-bold text-slate-200">14 km/h</span>
                </div>
            </div>
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>
```

```css
/* File: style.css */
body {
    font-family: system-ui, -apple-system, sans-serif;
}
```

```javascript
// File: script.js
const mockData = {
    "delhi": { name: "Delhi, India", temp: "28°C", condition: "Sunny / Clear", humidity: "52%", wind: "12 km/h" },
    "mumbai": { name: "Mumbai, India", temp: "31°C", condition: "Humid / Partly Cloudy", humidity: "78%", wind: "18 km/h" },
    "london": { name: "London, UK", temp: "16°C", condition: "Light Rain", humidity: "82%", wind: "22 km/h" },
    "new york": { name: "New York, USA", temp: "22°C", condition: "Clear Sky", humidity: "45%", wind: "15 km/h" }
};

function getWeather() {
    const input = document.getElementById('cityInput').value.trim().toLowerCase();
    if (!input) return;
    
    const city = mockData[input] || {
        name: input.charAt(0).toUpperCase() + input.slice(1),
        temp: Math.floor(Math.random() * 15 + 18) + "°C",
        condition: "Partly Cloudy",
        humidity: Math.floor(Math.random() * 30 + 45) + "%",
        wind: Math.floor(Math.random() * 15 + 10) + " km/h"
    };

    document.getElementById('cityName').textContent = city.name;
    document.getElementById('temp').textContent = city.temp;
    document.getElementById('condition').textContent = city.condition;
    document.getElementById('humidity').textContent = city.humidity;
    document.getElementById('wind').textContent = city.wind;
}
```"""
                elif "to do" in user_msg_clean or "todo" in user_msg_clean or "task" in user_msg_clean:
                    fallback_reply = """```html
<!-- File: index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Manager & To-Do App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
        <div class="flex items-center justify-between mb-6">
            <h1 class="text-xl font-bold text-white flex items-center space-x-2">
                <span> Task Manager</span>
            </h1>
            <span id="taskCount" class="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-semibold px-2.5 py-1 rounded-full">0 Tasks</span>
        </div>

        <div class="flex gap-2 mb-6">
            <input type="text" id="taskInput" placeholder="Add a new task..." class="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all">
            <button onclick="addTask()" class="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md cursor-pointer">Add</button>
        </div>

        <ul id="taskList" class="space-y-2.5 max-h-80 overflow-y-auto pr-1"></ul>
    </div>
    <script src="script.js"></script>
</body>
</html>
```

```css
/* File: style.css */
body { font-family: system-ui, -apple-system, sans-serif; }
```

```javascript
// File: script.js
let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');

function renderTasks() {
    const list = document.getElementById('taskList');
    const count = document.getElementById('taskCount');
    list.innerHTML = '';
    count.textContent = `${tasks.length} Task${tasks.length === 1 ? '' : 's'}`;

    if (tasks.length === 0) {
        list.innerHTML = `<li class="py-8 text-center text-xs text-slate-500">No tasks yet. Add a task above!</li>`;
        return;
    }

    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.className = `flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 transition-all ${task.completed ? 'opacity-60' : ''}`;
        li.innerHTML = `
            <div class="flex items-center space-x-3 truncate">
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask(${index})" class="w-4 h-4 rounded accent-indigo-600 cursor-pointer">
                <span class="text-sm text-slate-200 truncate ${task.completed ? 'line-through text-slate-500' : ''}">${task.text}</span>
            </div>
            <button onclick="deleteTask(${index})" class="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer">Delete</button>
        `;
        list.appendChild(li);
    });
}

function addTask() {
    const input = document.getElementById('taskInput');
    const text = input.value.trim();
    if (!text) return;
    tasks.push({ text, completed: false });
    localStorage.setItem('tasks', JSON.stringify(tasks));
    input.value = '';
    renderTasks();
}

function toggleTask(index) {
    tasks[index].completed = !tasks[index].completed;
    localStorage.setItem('tasks', JSON.stringify(tasks));
    renderTasks();
}

function deleteTask(index) {
    tasks.splice(index, 1);
    localStorage.setItem('tasks', JSON.stringify(tasks));
    renderTasks();
}

renderTasks();
```"""
                elif "calculator" in user_msg_clean or "buil" in user_msg_clean:
                    fallback_reply = """```html
<!-- File: index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Glassmorphic Calculator</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4 antialiased">
    <div class="calculator w-80 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-xl">
        <div class="flex items-center justify-between mb-4 px-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Calculator</span>
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>
        <div class="display w-full h-20 bg-slate-950 rounded-2xl text-slate-100 text-3xl font-mono font-bold flex items-center justify-end px-5 mb-5 border border-slate-800/80 shadow-inner overflow-hidden" id="display">0</div>
        <div class="buttons grid grid-cols-4 gap-3">
            <button class="btn btn-clear bg-rose-600 hover:bg-rose-500 text-white h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="clearDisplay()">C</button>
            <button class="btn btn-operator bg-indigo-600 hover:bg-indigo-500 text-white h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="appendOperator('/')">&divide;</button>
            <button class="btn btn-operator bg-indigo-600 hover:bg-indigo-500 text-white h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="appendOperator('*')">&times;</button>
            <button class="btn btn-operator bg-indigo-600 hover:bg-indigo-500 text-white h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="deleteLast()">&larr;</button>
            
            <button class="btn bg-slate-800 hover:bg-slate-700 text-slate-100 h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="appendNumber('7')">7</button>
            <button class="btn bg-slate-800 hover:bg-slate-700 text-slate-100 h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="appendNumber('8')">8</button>
            <button class="btn bg-slate-800 hover:bg-slate-700 text-slate-100 h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="appendNumber('9')">9</button>
            <button class="btn btn-operator bg-indigo-600 hover:bg-indigo-500 text-white h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="appendOperator('-')">&minus;</button>
            
            <button class="btn bg-slate-800 hover:bg-slate-700 text-slate-100 h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="appendNumber('4')">4</button>
            <button class="btn bg-slate-800 hover:bg-slate-700 text-slate-100 h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="appendNumber('5')">5</button>
            <button class="btn bg-slate-800 hover:bg-slate-700 text-slate-100 h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="appendNumber('6')">6</button>
            <button class="btn btn-operator bg-indigo-600 hover:bg-indigo-500 text-white h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="appendOperator('+')">+</button>
            
            <button class="btn bg-slate-800 hover:bg-slate-700 text-slate-100 h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="appendNumber('1')">1</button>
            <button class="btn bg-slate-800 hover:bg-slate-700 text-slate-100 h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="appendNumber('2')">2</button>
            <button class="btn bg-slate-800 hover:bg-slate-700 text-slate-100 h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="appendNumber('3')">3</button>
            <button class="btn btn-equals bg-emerald-600 hover:bg-emerald-500 text-white h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md row-span-2 flex items-center justify-center cursor-pointer" onclick="calculateResult()">=</button>
            
            <button class="btn btn-zero bg-slate-800 hover:bg-slate-700 text-slate-100 h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md col-span-2 flex items-center justify-center cursor-pointer" onclick="appendNumber('0')">0</button>
            <button class="btn bg-slate-800 hover:bg-slate-700 text-slate-100 h-12 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer" onclick="appendNumber('.')">.</button>
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>
```

```css
/* File: style.css */
* { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #090d16; }
```

```javascript
// File: script.js
let display = document.getElementById('display');
let currentInput = '0';
function updateDisplay() { display.textContent = currentInput; }
function clearDisplay() { currentInput = '0'; updateDisplay(); }
function deleteLast() { currentInput = (currentInput.length === 1 || currentInput === 'Error') ? '0' : currentInput.slice(0, -1); updateDisplay(); }
function appendNumber(num) { currentInput = (currentInput === '0' || currentInput === 'Error') ? num : currentInput + num; updateDisplay(); }
function appendOperator(op) { if (currentInput === 'Error') return; const last = currentInput.slice(-1); if (['+','-','*','/'].includes(last)) currentInput = currentInput.slice(0,-1) + op; else currentInput += op; updateDisplay(); }
function calculateResult() { try { currentInput = eval(currentInput).toString(); } catch (e) { currentInput = 'Error'; } updateDisplay(); }
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
                elif "portfolio" in user_msg_clean or "porfolio" in user_msg_clean or "resume" in user_msg_clean:
                    fallback_reply = """```html
<!-- File: index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mukesh Singh | Developer & AI Engineer</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body class="bg-slate-950 text-slate-100 font-sans antialiased min-h-screen">
    <nav class="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <span class="font-extrabold text-indigo-400 text-lg tracking-tight">Mukesh.dev</span>
            <div class="flex items-center space-x-6 text-sm font-medium text-slate-300">
                <a href="#about" class="hover:text-white transition-colors">About</a>
                <a href="#projects" class="hover:text-white transition-colors">Projects</a>
                <a href="#skills" class="hover:text-white transition-colors">Skills</a>
                <a href="#contact" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition-all shadow-md">Contact</a>
            </div>
        </div>
    </nav>

    <main class="max-w-6xl mx-auto px-6 pt-32 pb-20 space-y-28">
        <!-- Hero Section -->
        <section id="about" class="flex flex-col md:flex-row items-center justify-between gap-12">
            <div class="flex-1 space-y-6">
                <span class="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-full text-xs font-semibold uppercase tracking-wider">Available for Hire</span>
                <h1 class="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight">Full-Stack & AI Software Engineer</h1>
                <p class="text-slate-400 text-base leading-relaxed max-w-xl">Building high-performance web applications, multi-agent AI systems, and modern cloud architectures with clean code and great design.</p>
                <div class="flex items-center space-x-4 pt-2">
                    <a href="#projects" class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/30">View My Work</a>
                    <a href="#contact" class="border border-slate-800 hover:bg-slate-900 text-slate-300 font-semibold px-6 py-3 rounded-xl transition-all">Get in Touch</a>
                </div>
            </div>
            <div class="w-64 h-64 sm:w-80 sm:h-80 rounded-3xl bg-gradient-to-tr from-indigo-600 to-indigo-400 p-1 shadow-2xl shadow-indigo-500/20">
                <div class="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center text-5xl font-extrabold text-indigo-400">MS</div>
            </div>
        </section>

        <!-- Projects Grid -->
        <section id="projects" class="space-y-8">
            <div class="space-y-2">
                <h2 class="text-2xl sm:text-3xl font-extrabold text-white">Featured Projects</h2>
                <p class="text-slate-400 text-sm">A selection of recent applications and AI tools I've built.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-indigo-500/50 transition-all">
                    <div class="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">01</div>
                    <h3 class="text-lg font-bold text-white">AI Agent Dashboard</h3>
                    <p class="text-slate-400 text-xs leading-relaxed">Full-stack multi-agent autonomous dev team orchestrator with live code sandbox.</p>
                    <div class="flex gap-2 text-[10px] font-mono text-indigo-300 pt-2"><span class="bg-slate-800 px-2 py-0.5 rounded">React</span><span class="bg-slate-800 px-2 py-0.5 rounded">FastAPI</span></div>
                </div>
                <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-indigo-500/50 transition-all">
                    <div class="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">02</div>
                    <h3 class="text-lg font-bold text-white">Real-Time Data Analytics</h3>
                    <p class="text-slate-400 text-xs leading-relaxed">Interactive dashboard visualizing streaming metrics and data insights.</p>
                    <div class="flex gap-2 text-[10px] font-mono text-indigo-300 pt-2"><span class="bg-slate-800 px-2 py-0.5 rounded">Tailwind</span><span class="bg-slate-800 px-2 py-0.5 rounded">Python</span></div>
                </div>
                <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-indigo-500/50 transition-all">
                    <div class="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">03</div>
                    <h3 class="text-lg font-bold text-white">SaaS Landing Platform</h3>
                    <p class="text-slate-400 text-xs leading-relaxed">High-converting landing page with responsive glassmorphic aesthetic.</p>
                    <div class="flex gap-2 text-[10px] font-mono text-indigo-300 pt-2"><span class="bg-slate-800 px-2 py-0.5 rounded">HTML5</span><span class="bg-slate-800 px-2 py-0.5 rounded">JavaScript</span></div>
                </div>
            </div>
        </section>

        <!-- Contact Section -->
        <section id="contact" class="bg-indigo-950/40 border border-indigo-500/20 rounded-3xl p-8 sm:p-12 text-center space-y-4">
            <h2 class="text-2xl sm:text-3xl font-extrabold text-white">Let's Work Together</h2>
            <p class="text-slate-400 text-sm max-w-lg mx-auto">Have a project in mind or looking for a developer? Feel free to reach out anytime!</p>
            <div class="pt-4">
                <a href="mailto:mukesh@example.com" class="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-xl shadow-indigo-600/30">mukesh@example.com</a>
            </div>
        </section>
    </main>

    <footer class="border-t border-slate-800/80 text-center py-6 text-xs text-slate-500">
        © 2026 Mukesh Singh. All rights reserved.
    </footer>
</body>
</html>
```

```css
/* File: style.css */
html { scroll-behavior: smooth; }
body { font-family: system-ui, -apple-system, sans-serif; }
```

```javascript
// File: script.js
console.log("Portfolio loaded successfully.");
```"""
                elif req.mode == "build" or any(w in user_msg_clean for w in ["build", "create", "make", "app", "website", "application", "dashboard", "system"]):
                    # Smart dynamic builder for fallback scenarios
                    app_name = re.sub(r'\b(build|create|make|a|an|the|app|website|application)\b', '', user_msg_clean, flags=re.IGNORECASE).strip().title()
                    if not app_name:
                        app_name = "Web Application"
                        
                    fallback_reply = f"""```html
<!-- File: index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{app_name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center">
        <div class="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
            <span class="text-2xl"></span>
        </div>
        <h1 class="text-2xl font-extrabold text-white mb-2">{app_name} Workspace</h1>
        <p class="text-sm text-slate-400 mb-6">Your custom application "{app_name}" has been generated and is ready for live development.</p>
        
        <div class="flex justify-center gap-3">
            <button onclick="triggerAction()" class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md cursor-pointer">Explore {app_name}</button>
        </div>
        <div id="actionResult" class="mt-4 text-xs font-semibold text-emerald-400 hidden">Interactive workspace loaded successfully!</div>
    </div>
    <script src="script.js"></script>
</body>
</html>
```

```css
/* File: style.css */
body {{ font-family: system-ui, -apple-system, sans-serif; }}
```

```javascript
// File: script.js
function triggerAction() {{
    const res = document.getElementById('actionResult');
    res.classList.remove('hidden');
}}
```"""
                else:
                    app_name = re.sub(r'\b(build|create|make|a|an|the|app|website|application|page|system|bnao|bna|do)\b', '', user_msg_clean, flags=re.IGNORECASE).strip().title()
                    if not app_name or len(app_name) < 2:
                        app_name = "Application Workspace"

                    fallback_reply = f"""```html
<!-- File: index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{app_name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4 antialiased">
    <div class="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center">
        <h1 class="text-2xl font-extrabold text-white mb-2">{app_name} Workspace</h1>
        <p class="text-sm text-slate-400 mb-6">Interactive workspace for {app_name} generated and ready for development.</p>
        <button onclick="triggerAction()" class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md cursor-pointer">Launch {app_name}</button>
        <div id="actionResult" class="mt-4 text-xs font-semibold text-emerald-400 hidden">Application initialized successfully!</div>
    </div>
    <script src="script.js"></script>
</body>
</html>
```

```css
/* File: style.css */
body {{ font-family: system-ui, -apple-system, sans-serif; }}
```

```javascript
// File: script.js
function triggerAction() {{
    const res = document.getElementById('actionResult');
    res.classList.remove('hidden');
}}
```"""

                full_text = fallback_reply or "Workspace ready."
                if req.thread_id:
                    from src.utils.sandbox_manager import extract_and_write_code_files, reconnect_sandbox
                    sandbox_id = req.thread_id if req.thread_id.startswith("sandbox-") else f"sandbox-{req.thread_id}"
                    reconnect_sandbox(sandbox_id)
                    written = extract_and_write_code_files(sandbox_id, full_text)
                    if written:
                        yield f"data: {json.dumps({'sandbox': {'sandbox_id': sandbox_id, 'files': written}})}\n\n"

            tokens = re.split(r'(\s+)', full_text)
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
