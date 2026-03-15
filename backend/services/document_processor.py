import os
import json
from pathlib import Path
from typing import List, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.database import Document
from services.vector_store import vector_store
from services.llm_service import llm_service
from config import settings

class DocumentProcessor:

    async def extract_text(self, file_path: str, file_type: str) -> Tuple[str, int]:
        """Extract raw text from document. Returns (text, page_count)."""
        ext = file_type.lower()
        try:
            if ext == ".pdf":
                return await self._extract_pdf(file_path)
            elif ext == ".docx":
                return await self._extract_docx(file_path)
            elif ext in (".txt", ".md"):
                text = Path(file_path).read_text(encoding="utf-8", errors="ignore")
                return text, 1
            else:
                return "", 0
        except Exception as e:
            print(f"Extraction error: {e}")
            return "", 0

    async def _extract_pdf(self, file_path: str) -> Tuple[str, int]:
        import fitz  # PyMuPDF
        doc = fitz.open(file_path)
        pages = []
        for page in doc:
            pages.append(page.get_text())
        doc.close()
        return "\n\n".join(pages), len(pages)

    async def _extract_docx(self, file_path: str) -> Tuple[str, int]:
        from docx import Document as DocxDoc
        doc = DocxDoc(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs), max(1, len(paragraphs) // 30)

    def chunk_text(self, text: str, chunk_size: int = None, overlap: int = None) -> List[dict]:
        """Split text into overlapping chunks with metadata."""
        chunk_size = chunk_size or settings.CHUNK_SIZE
        overlap = overlap or settings.CHUNK_OVERLAP

        words = text.split()
        if not words:
            return []

        chunks = []
        start = 0
        chunk_idx = 0

        while start < len(words):
            end = start + chunk_size
            chunk_words = words[start:end]
            chunk_text = " ".join(chunk_words)

            if len(chunk_text.strip()) > 30:  # skip tiny chunks
                chunks.append({
                    "text": chunk_text,
                    "chunk_index": chunk_idx,
                    "word_start": start,
                    "word_end": min(end, len(words))
                })
                chunk_idx += 1

            start += chunk_size - overlap

        return chunks

    async def process_document(
        self,
        db: AsyncSession,
        doc_id: str,
        workspace_id: str,
        file_path: str,
        file_type: str,
        original_name: str
    ):
        """Full pipeline: extract → chunk → embed → store → summarize."""
        try:
            # Update status
            result = await db.execute(select(Document).where(Document.id == doc_id))
            doc = result.scalar_one_or_none()
            if not doc:
                return

            # Extract text
            text, page_count = await self.extract_text(file_path, file_type)
            if not text:
                doc.status = "error"
                await db.commit()
                return

            # Chunk
            chunks = self.chunk_text(text)
            chunk_texts = [c["text"] for c in chunks]
            chunk_metas = [{"chunk_index": c["chunk_index"], "page": None} for c in chunks]

            # Embed & store in ChromaDB
            num_chunks = await vector_store.add_chunks(
                workspace_id=workspace_id,
                doc_id=doc_id,
                doc_name=original_name,
                chunks=chunk_texts,
                metadatas=chunk_metas
            )

            # Generate summary using LLM (first 2000 chars for speed)
            summary_text = text[:2000]
            summary = await llm_service.summarize(summary_text, original_name)

            # Update document record
            doc.status = "ready"
            doc.chunk_count = num_chunks
            doc.page_count = page_count
            doc.summary = summary
            doc.processed_at = datetime.utcnow()
            await db.commit()

        except Exception as e:
            print(f"Processing error for doc {doc_id}: {e}")
            result = await db.execute(select(Document).where(Document.id == doc_id))
            doc = result.scalar_one_or_none()
            if doc:
                doc.status = "error"
                await db.commit()

document_processor = DocumentProcessor()
