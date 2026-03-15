from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List
import json
import uuid
from datetime import datetime

from models.database import get_db, User, ChatSession, ChatMessage, WorkspaceMember
from models.schemas import (
    ChatSessionCreate, ChatSessionOut, ChatMessageOut, AskRequest, AskResponse, SourceChunk
)
from services.auth_service import get_current_user
from services.vector_store import vector_store
from services.llm_service import llm_service

router = APIRouter(prefix="/chat", tags=["Chat"])

# ── Sessions ──────────────────────────────────────────────────

@router.post("/sessions", response_model=ChatSessionOut, status_code=201)
async def create_session(
    payload: ChatSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await _check_access(db, payload.workspace_id, current_user.id)
    session = ChatSession(
        workspace_id=payload.workspace_id,
        user_id=current_user.id,
        title=payload.title or "New Chat"
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session

@router.get("/sessions/{workspace_id}", response_model=List[ChatSessionOut])
async def list_sessions(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await _check_access(db, workspace_id, current_user.id)
    result = await db.execute(
        select(ChatSession)
        .where(
            ChatSession.workspace_id == workspace_id,
            ChatSession.user_id == current_user.id
        )
        .order_by(ChatSession.updated_at.desc())
    )
    return result.scalars().all()

@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(ChatSession).where(
        ChatSession.id == session_id, ChatSession.user_id == current_user.id
    ))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()

# ── Messages ──────────────────────────────────────────────────

@router.get("/messages/{session_id}", response_model=List[ChatMessageOut])
async def get_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(ChatSession).where(
        ChatSession.id == session_id, ChatSession.user_id == current_user.id
    ))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    msgs = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return msgs.scalars().all()

# ── Q&A (RAG) ─────────────────────────────────────────────────

@router.post("/ask", response_model=AskResponse)
async def ask(
    payload: AskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await _check_access(db, payload.workspace_id, current_user.id)

    # Validate session
    session_result = await db.execute(select(ChatSession).where(
        ChatSession.id == payload.session_id, ChatSession.user_id == current_user.id
    ))
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # Save user message
    user_msg = ChatMessage(
        session_id=payload.session_id,
        role="user",
        content=payload.question
    )
    db.add(user_msg)
    await db.flush()

    # RAG: retrieve relevant chunks
    try:
        chunks = await vector_store.search(
            workspace_id=payload.workspace_id,
            query=payload.question,
            top_k=5
        )
    except Exception as e:
        print(f"Search failed: {e}")
        chunks = []

    # Generate answer
    try:
        result = await llm_service.answer(payload.question, chunks)
        answer_text = result["answer"]
        tokens = result["tokens"]
    except Exception as e:
        print(f"LLM failed: {e}")
        answer_text = "Sorry, I encountered an error generating a response. Please try again."
        tokens = 0

    # Build source references
    sources = [
        SourceChunk(
            doc_id=c["doc_id"],
            doc_name=c["doc_name"],
            chunk=c["content"][:300],
            score=c["score"],
            page=int(c["page"]) if c.get("page") not in (None, "", "None") else None
        )
        for c in chunks[:3]
    ]

    # Save assistant message
    assistant_msg = ChatMessage(
        session_id=payload.session_id,
        role="assistant",
        content=answer_text,
        sources=json.dumps([s.model_dump() for s in sources]),
        tokens_used=tokens
    )
    db.add(assistant_msg)

    # Auto-generate title on first message
    msg_count_result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == payload.session_id)
    )
    msg_count = len(msg_count_result.scalars().all())
    if msg_count <= 2 and session.title in ("New Chat", ""):
        new_title = await llm_service.generate_chat_title(payload.question)
        session.title = new_title

    session.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(assistant_msg)

    return AskResponse(
        answer=answer_text,
        sources=sources,
        session_id=payload.session_id,
        message_id=assistant_msg.id,
        tokens_used=tokens
    )

@router.post("/ask/stream")
async def ask_stream(
    payload: AskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Streaming version of Q&A for real-time token output."""
    await _check_access(db, payload.workspace_id, current_user.id)

    chunks = await vector_store.search(
        workspace_id=payload.workspace_id,
        query=payload.question,
        top_k=5
    )

    sources = [
        {"doc_id": c["doc_id"], "doc_name": c["doc_name"], "score": c["score"]}
        for c in chunks[:3]
    ]

    async def event_stream():
        # Send sources first
        yield f"data: {json.dumps({'type': 'sources', 'data': sources})}\n\n"

        # Stream tokens
        async for token in llm_service.answer_stream(payload.question, chunks):
            yield f"data: {json.dumps({'type': 'token', 'data': token})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

async def _check_access(db: AsyncSession, workspace_id: str, user_id: str):
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")