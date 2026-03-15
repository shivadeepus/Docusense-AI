from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from models.database import get_db, User, Workspace, Document, ChatSession, ChatMessage, WorkspaceMember
from services.auth_service import get_current_user
from services.llm_service import llm_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/workspace/{workspace_id}")
async def workspace_stats(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await _check_access(db, workspace_id, current_user.id)

    doc_count = (await db.execute(
        select(func.count(Document.id)).where(Document.workspace_id == workspace_id)
    )).scalar() or 0

    ready_docs = (await db.execute(
        select(func.count(Document.id)).where(
            Document.workspace_id == workspace_id, Document.status == "ready"
        )
    )).scalar() or 0

    chat_count = (await db.execute(
        select(func.count(ChatSession.id)).where(ChatSession.workspace_id == workspace_id)
    )).scalar() or 0

    # Total messages in this workspace
    msg_result = await db.execute(
        select(func.count(ChatMessage.id))
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .where(ChatSession.workspace_id == workspace_id)
    )
    msg_count = msg_result.scalar() or 0

    total_chunks = (await db.execute(
        select(func.sum(Document.chunk_count)).where(Document.workspace_id == workspace_id)
    )).scalar() or 0

    # Recent documents
    recent_docs = (await db.execute(
        select(Document)
        .where(Document.workspace_id == workspace_id)
        .order_by(Document.created_at.desc())
        .limit(5)
    )).scalars().all()

    return {
        "total_documents": doc_count,
        "ready_documents": ready_docs,
        "processing_documents": doc_count - ready_docs,
        "total_chats": chat_count,
        "total_messages": msg_count,
        "total_chunks_indexed": int(total_chunks),
        "recent_documents": [
            {
                "id": d.id,
                "name": d.original_name,
                "status": d.status,
                "created_at": d.created_at.isoformat()
            } for d in recent_docs
        ]
    }

@router.get("/system")
async def system_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ollama_ok = await llm_service.is_available()
    return {
        "ollama_status": "connected" if ollama_ok else "offline",
        "model": "llama-3.1-8b-instant" if ollama_ok else "demo_mode",
        "embed_model": "nomic-embed-text"
    }

async def _check_access(db: AsyncSession, workspace_id: str, user_id: str):
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")
