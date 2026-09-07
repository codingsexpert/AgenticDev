"""
src/routes/__init__.py — API Routers Package Initializer
"""

from src.routes.auth import router as auth_router
from src.routes.chats import router as chats_router
from src.routes.sandboxes import router as sandboxes_router
from src.routes.projects import router as projects_router
from src.routes.rag import router as rag_router
from src.routes.system import router as system_router

__all__ = [
    "auth_router",
    "chats_router",
    "sandboxes_router",
    "projects_router",
    "rag_router",
    "system_router",
]
