"""
src/routes/projects.py — Autonomous AI Dev Team Project Builder Router
"""

import time
import json
import asyncio
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse, FileResponse
import os
import shutil

from src.guardrails.input_guardrail import validate_user_input
from src.guardrails.security_middleware import (
    global_rate_limiter,
    get_current_user_optional,
)
from src.config.state import create_initial_state
from src.routes.schemas import ProjectStartRequest
from src.routes.state import _event_queues, _thread_states, compiled_graph

router = APIRouter(prefix="/api", tags=["projects"])


def _sync_graph_worker(thread_id: str, requirement: str, token_budget: float, chat_history: list, user_email: str, langsmith_api_key: str, loop: asyncio.AbstractEventLoop):
    if langsmith_api_key:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = langsmith_api_key
        os.environ["LANGCHAIN_PROJECT"] = "AI Dev Team"
        try:
            import litellm
            litellm.success_callback = ["langsmith"]
            litellm.failure_callback = ["langsmith"]
        except Exception:
            pass

    queue = _event_queues.get(thread_id)
    config = {
        "configurable": {"thread_id": thread_id},
        "recursion_limit": 500,
    }
    initial_state = create_initial_state(user_requirement=requirement, chat_history=chat_history, token_budget=token_budget)

    def push_event(event_type: str, data: Dict[str, Any]):
        if queue:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": event_type, "data": data, "timestamp": time.time()})

    push_event("started", {"thread_id": thread_id, "requirement": requirement})

    try:
        max_retries = 3
        retries = 0
        while retries < max_retries:
            try:
                # First attempt uses initial_state, subsequent retries use None to resume from checkpoint natively
                input_state = initial_state if retries == 0 else None
                
                for event in compiled_graph.stream(input_state, config):
                    for node_name, state_delta in event.items():
                        if isinstance(state_delta, dict):
                            sandbox_id = state_delta.get("sandboxId") or _thread_states[thread_id].get("sandbox_id", "")
                            if sandbox_id:
                                _thread_states[thread_id]["sandbox_id"] = sandbox_id

                            push_event("node_update", {
                                "node": node_name,
                                "state_delta": {
                                    "pmStatus": state_delta.get("pmStatus"),
                                    "pmQuestions": state_delta.get("pmQuestions"),
                                    "currentTask": state_delta.get("currentTask"),
                                    "reviewResult": state_delta.get("reviewResult"),
                                    "executionResult": state_delta.get("executionResult"),
                                    "tokenUsage": state_delta.get("tokenUsage"),
                                    "sandboxId": sandbox_id,
                                }
                            })

                # At the end of successful run, deduct cost
                final_cost = 0.0
                if "tokenUsage" in state_delta and isinstance(state_delta["tokenUsage"], dict):
                    final_cost = state_delta["tokenUsage"].get("estimatedCost", 0.0)
                
                if user_email and final_cost > 0:
                    try:
                        from src.routes.auth import load_users, save_users
                        from src.utils.memory_manager import save_user_profile
                        users = load_users()
                        email_key = user_email.lower()
                        if email_key in users:
                            users[email_key]["token_budget"] = max(0.0, users[email_key].get("token_budget", 5.0) - final_cost)
                            users[email_key]["total_cost"] = users[email_key].get("total_cost", 0.0) + final_cost
                            save_users(users)
                            save_user_profile(users[email_key])
                    except Exception as e:
                        print(f"Failed to deduct user budget: {e}")

                push_event("complete", {
                    "thread_id": thread_id,
                    "sandbox_id": _thread_states[thread_id].get("sandbox_id", ""),
                    "status": "complete"
                })
                break  # Break out of retry loop if successful
            except Exception as err:
                retries += 1
                if retries >= max_retries:
                    push_event("error", {"message": f"Graph execution failed permanently after {max_retries} attempts: {str(err)}"})
                    break
                else:
                    push_event("error", {"message": f"Graph execution interrupted ({str(err)}). Retrying from checkpoint ({retries}/{max_retries})..."})
                    time.sleep(2)


    finally:
        if queue:
            loop.call_soon_threadsafe(queue.put_nowait, None)


from concurrent.futures import ThreadPoolExecutor
_graph_executor = ThreadPoolExecutor(max_workers=5)

async def _run_graph_execution(thread_id: str, requirement: str, token_budget: float, chat_history: list, user_email: str = None, langsmith_api_key: str = None):
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(_graph_executor, _sync_graph_worker, thread_id, requirement, token_budget, chat_history, user_email, langsmith_api_key, loop)


@router.post("/projects/start")
async def start_project(
    req: ProjectStartRequest,
    background_tasks: BackgroundTasks,
    request: Request = None,
    user: Dict[str, Any] = Depends(get_current_user_optional)
):
    if request:
        allowed, limit_msg = global_rate_limiter.check_rate_limit(user.get("id"), is_user=True, max_requests=10, window_seconds=60)
        if not allowed:
            raise HTTPException(status_code=429, detail=limit_msg)
    is_valid, msg, meta = validate_user_input(req.requirement)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Guardrail check failed: {msg}")

    thread_id = req.thread_id or f"project-{int(time.time())}"
    queue = asyncio.Queue()
    _event_queues[thread_id] = queue
    _thread_states[thread_id] = {
        "thread_id": thread_id,
        "requirement": msg,
        "status": "running",
        "logs": [],
        "sandbox_id": "",
    }

    final_budget = req.tokenBudget
    user_email = None
    if user and user.get("authenticated"):
        user_email = user.get("email")
        from src.routes.auth import load_users
        users = load_users()
        email_key = user_email.lower()
        if email_key in users:
            db_budget = users[email_key].get("token_budget", 5.0)
            final_budget = db_budget if db_budget < req.tokenBudget else req.tokenBudget
            
            if final_budget <= 0.01:
                raise HTTPException(status_code=402, detail="Insufficient token budget. Please top up using Stripe in settings.")

    background_tasks.add_task(_run_graph_execution, thread_id, msg, final_budget, req.messages or [], user_email, req.langsmithApiKey)

    return {
        "thread_id": thread_id,
        "message": "Project pipeline started successfully",
        "stream_url": f"/api/stream/{thread_id}",
    }


@router.get("/stream/{thread_id}")
async def stream_project_events(thread_id: str):
    queue = _event_queues.get(thread_id)
    if not queue:
        raise HTTPException(status_code=404, detail="Thread SSE queue not found")

    async def event_generator():
        while True:
            item = await queue.get()
            if item is None:
                break
            yield f"data: {json.dumps(item)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/projects/{thread_id}/download")
async def download_project(thread_id: str):
    if thread_id not in _thread_states:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    sandbox_id = _thread_states[thread_id].get("sandbox_id")
    if not sandbox_id:
        raise HTTPException(status_code=404, detail="No sandbox associated with this project")
        
    from src.utils.sandbox_manager import get_sandbox_path
    sandbox_path = get_sandbox_path(sandbox_id)
    
    if not os.path.exists(sandbox_path):
        raise HTTPException(status_code=404, detail="Sandbox folder not found on disk")
        
    zip_filename = f"{sandbox_id}.zip"
    zip_path = os.path.join("/tmp", zip_filename)
    
    shutil.make_archive(zip_path.replace('.zip', ''), 'zip', sandbox_path)
    
    return FileResponse(zip_path, media_type="application/zip", filename=f"project_{thread_id}.zip")
