"""
src/routes/projects.py — Autonomous AI Dev Team Project Builder Router
"""

import time
import json
import asyncio
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse

from src.guardrails.input_guardrail import validate_user_input
from src.guardrails.security_middleware import (
    global_rate_limiter,
    get_current_user_optional,
)
from src.config.state import create_initial_state
from src.routes.schemas import ProjectStartRequest
from src.routes.state import _event_queues, _thread_states, compiled_graph

router = APIRouter(prefix="/api", tags=["projects"])


def _sync_graph_worker(thread_id: str, requirement: str, token_budget: float, loop: asyncio.AbstractEventLoop):
    queue = _event_queues.get(thread_id)
    config = {
        "configurable": {"thread_id": thread_id},
        "recursion_limit": 500,
    }
    initial_state = create_initial_state(user_requirement=requirement, token_budget=token_budget)

    def push_event(event_type: str, data: Dict[str, Any]):
        if queue:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": event_type, "data": data, "timestamp": time.time()})

    push_event("started", {"thread_id": thread_id, "requirement": requirement})

    try:
        for event in compiled_graph.stream(initial_state, config):
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

        push_event("complete", {
            "thread_id": thread_id,
            "sandbox_id": _thread_states[thread_id].get("sandbox_id", ""),
            "status": "complete"
        })
    except Exception as err:
        push_event("error", {"message": str(err)})
    finally:
        if queue:
            loop.call_soon_threadsafe(queue.put_nowait, None)


async def _run_graph_execution(thread_id: str, requirement: str, token_budget: float):
    loop = asyncio.get_running_loop()
    await asyncio.to_thread(_sync_graph_worker, thread_id, requirement, token_budget, loop)


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

    thread_id = f"project-{int(time.time())}"
    queue = asyncio.Queue()
    _event_queues[thread_id] = queue
    _thread_states[thread_id] = {
        "thread_id": thread_id,
        "requirement": msg,
        "status": "running",
        "logs": [],
        "sandbox_id": "",
    }

    background_tasks.add_task(_run_graph_execution, thread_id, msg, req.tokenBudget)

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
