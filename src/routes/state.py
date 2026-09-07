"""
src/routes/state.py — Shared In-Memory State & LangGraph Compilation
"""

import asyncio
from typing import Dict, Any
from src.config.graph import build_graph, create_checkpointer

# Active streams and queues per thread_id
_event_queues: Dict[str, asyncio.Queue] = {}
_thread_states: Dict[str, Dict[str, Any]] = {}
_active_threads: Dict[str, Any] = {}

# Graph Checkpointer and Compiled Execution Graph
checkpointer = create_checkpointer()
compiled_graph = build_graph({"checkpointer": checkpointer})
