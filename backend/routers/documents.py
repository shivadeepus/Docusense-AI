from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from pathlib import Path
import shutil
import uuid
import os

from models.database import get_db, User, Document, WorkspaceMember
from models.schemas import DocumentOut
from services.auth_service import get_current_user
from services.document_processor import document_processor
from services.vector_store import vector_store
from config import settings

router = APIRouter(prefix="/documents", tags=["Documents"])

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

@router.post("/upload/{workspace_id}", response_model=DocumentOut, status_code=201)
async def upload_document(
    workspace_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await _check_workspace_access(db, workspace_id, current_user.id)

    # Validate file
    suffix = Path(file.filename).suffix.lower()
    if suffix not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type {suffix} not supported. Allowed: {settings.ALLOWED_EXTENSIONS}"
        )

    # Read and check size
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.MAX_FILE_SIZE_MB}MB limit")

    # Save to disk
    doc_id = str(uuid.uuid4())
    safe_filename = f"{doc_id}{suffix}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)
    with open(file_path, "wb") as f:
        f.write(content)

    # Create DB record
    doc = Document(
        id=doc_id,
        workspace_id=workspace_id,
        uploaded_by=current_user.id,
        filename=safe_filename,
        original_name=file.filename,
        file_type=suffix,
        file_size=len(content),
        status="processing"
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Process in background
    background_tasks.add_task(
        document_processor.process_document,
        db, doc_id, workspace_id, file_path, suffix, file.filename
    )

    return doc

@router.get("/{workspace_id}", response_model=List[DocumentOut])
async def list_documents(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await _check_workspace_access(db, workspace_id, current_user.id)
    result = await db.execute(
        select(Document)
        .where(Document.workspace_id == workspace_id)
        .order_by(Document.created_at.desc())
    )
    return result.scalars().all()

@router.get("/detail/{doc_id}", response_model=DocumentOut)
async def get_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await _check_workspace_access(db, doc.workspace_id, current_user.id)
    return doc

@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await _check_workspace_access(db, doc.workspace_id, current_user.id)

    # Remove from vector store
    await vector_store.delete_document(doc.workspace_id, doc_id)

    # Remove file
    file_path = os.path.join(settings.UPLOAD_DIR, doc.filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    await db.delete(doc)
    await db.commit()

async def _check_workspace_access(db: AsyncSession, workspace_id: str, user_id: str):
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied to this workspace")
