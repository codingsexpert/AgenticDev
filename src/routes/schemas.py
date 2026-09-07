"""
src/routes/schemas.py — Pydantic Request & Response Schemas for API Endpoints
"""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel


class ProjectStartRequest(BaseModel):
    requirement: str
    model: Optional[str] = "gemini-1.5-flash"
    techStack: Optional[str] = "python-fastapi"
    database: Optional[str] = "supabase"
    tokenBudget: Optional[float] = 2.0
    attachments: Optional[List[Dict[str, Any]]] = None


class ChatMessage(BaseModel):
    role: str
    content: str
    attachments: Optional[List[Dict[str, Any]]] = None


class RunCodeRequest(BaseModel):
    code: str
    language: str


class SaveFileRequest(BaseModel):
    content: str
    path: str


class ChatStreamRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = "gemini-1.5-flash"
    thread_id: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    mode: Optional[str] = "chat"


class QuestionAnswerRequest(BaseModel):
    thread_id: str
    answers: Dict[str, str]


class AuthSignUpRequest(BaseModel):
    email: str
    password: str
    name: str


class AuthLoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    email: str
    name: Optional[str] = None
    avatar: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    reset_token: str
    new_password: str


class ChatSaveRequest(BaseModel):
    thread_id: str
    title: str
    messages: List[Dict[str, Any]]
    mode: Optional[str] = "chat"
    node_history: Optional[List[Any]] = None
    user_id: Optional[str] = None


class ChatRenameRequest(BaseModel):
    title: str


class RenameFileRequest(BaseModel):
    old_path: str
    new_path: str


class DeployRequest(BaseModel):
    token: str
