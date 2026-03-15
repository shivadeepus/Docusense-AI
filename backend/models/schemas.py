from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# ── Auth ──────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str = "analyst"
    department: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    department: Optional[str]
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# ── Workspaces ────────────────────────────────────────────────
class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#2563eb"
    icon: str = "folder"

class WorkspaceOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    slug: str
    color: str
    icon: str
    created_by: str
    created_at: datetime
    document_count: int = 0
    member_count: int = 0
    model_config = {"from_attributes": True}

# ── Documents ─────────────────────────────────────────────────
class DocumentOut(BaseModel):
    id: str
    workspace_id: str
    filename: str
    original_name: str
    file_type: str
    file_size: int
    status: str
    chunk_count: int
    page_count: int
    summary: Optional[str]
    tags: Optional[str]
    created_at: datetime
    processed_at: Optional[datetime]
    model_config = {"from_attributes": True}

# ── Chat ──────────────────────────────────────────────────────
class ChatSessionCreate(BaseModel):
    workspace_id: str
    title: Optional[str] = "New Chat"

class ChatSessionOut(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

class ChatMessageOut(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    sources: Optional[str]
    tokens_used: int
    created_at: datetime
    model_config = {"from_attributes": True}

class AskRequest(BaseModel):
    session_id: str
    question: str
    workspace_id: str

class SourceChunk(BaseModel):
    doc_id: str
    doc_name: str
    chunk: str
    score: float
    page: Optional[int] = None

class AskResponse(BaseModel):
    answer: str
    sources: List[SourceChunk]
    session_id: str
    message_id: str
    tokens_used: int

# ── Analytics ─────────────────────────────────────────────────
class WorkspaceStats(BaseModel):
    total_documents: int
    total_chats: int
    total_messages: int
    total_chunks: int
    recent_activity: List[dict]
