from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from slugify import slugify
import uuid

from models.database import get_db, User, Workspace, WorkspaceMember, Document, ChatSession
from models.schemas import WorkspaceCreate, WorkspaceOut
from services.auth_service import get_current_user

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])

@router.post("", response_model=WorkspaceOut, status_code=201)
async def create_workspace(
    payload: WorkspaceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    slug_base = slugify(payload.name)
    slug = slug_base
    suffix = 1
    while True:
        existing = await db.execute(select(Workspace).where(Workspace.slug == slug))
        if not existing.scalar_one_or_none():
            break
        slug = f"{slug_base}-{suffix}"
        suffix += 1

    workspace = Workspace(
        name=payload.name,
        description=payload.description,
        slug=slug,
        color=payload.color,
        icon=payload.icon,
        created_by=current_user.id
    )
    db.add(workspace)
    await db.flush()

    # Add creator as owner
    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=current_user.id,
        role="owner"
    )
    db.add(member)
    await db.commit()
    await db.refresh(workspace)
    return await _enrich_workspace(db, workspace)

@router.get("", response_model=List[WorkspaceOut])
async def list_workspaces(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get workspaces user is a member of
    result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == current_user.id)
        .order_by(Workspace.created_at.desc())
    )
    workspaces = result.scalars().all()
    return [await _enrich_workspace(db, ws) for ws in workspaces]

@router.get("/{workspace_id}", response_model=WorkspaceOut)
async def get_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ws = await _get_workspace_or_404(db, workspace_id, current_user.id)
    return await _enrich_workspace(db, ws)

@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ws = await _get_workspace_or_404(db, workspace_id, current_user.id)
    # Only owner or admin can delete
    member_result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id
        )
    )
    member = member_result.scalar_one_or_none()
    if not member or (member.role != "owner" and current_user.role != "admin"):
        raise HTTPException(status_code=403, detail="Only workspace owner can delete")
    await db.delete(ws)
    await db.commit()

async def _get_workspace_or_404(db: AsyncSession, workspace_id: str, user_id: str) -> Workspace:
    result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(Workspace.id == workspace_id, WorkspaceMember.user_id == user_id)
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws

async def _enrich_workspace(db: AsyncSession, ws: Workspace) -> WorkspaceOut:
    doc_count = await db.execute(
        select(func.count(Document.id)).where(Document.workspace_id == ws.id)
    )
    member_count = await db.execute(
        select(func.count(WorkspaceMember.id)).where(WorkspaceMember.workspace_id == ws.id)
    )
    out = WorkspaceOut.model_validate(ws)
    out.document_count = doc_count.scalar() or 0
    out.member_count = member_count.scalar() or 0
    return out
