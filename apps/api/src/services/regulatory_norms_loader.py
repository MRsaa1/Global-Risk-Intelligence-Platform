"""
Regulatory norms loader — ingest normative document chunks into regulatory_documents and
regulatory_document_chunks for RAG. Supports loading from files (Markdown/JSON) and optional
vector embedding (when embedding service is available).
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.regulatory_document import RegulatoryDocument, RegulatoryDocumentChunk

logger = logging.getLogger(__name__)

# Default path for normative content (apps/api/data/regulatory_norms)
DEFAULT_NORMS_PATH = Path(__file__).resolve().parents[2] / "data" / "regulatory_norms"


async def ensure_document(
    db: AsyncSession,
    framework_id: str,
    jurisdiction: str,
    title: str,
    source_url: Optional[str] = None,
    document_type: str = "summary",
) -> RegulatoryDocument:
    """Get or create a regulatory document record."""
    r = await db.execute(
        select(RegulatoryDocument).where(
            RegulatoryDocument.framework_id == framework_id,
            RegulatoryDocument.jurisdiction == jurisdiction,
        )
    )
    doc = r.scalar_one_or_none()
    if doc:
        return doc
    doc = RegulatoryDocument(
        framework_id=framework_id,
        jurisdiction=jurisdiction,
        title=title,
        source_url=source_url,
        document_type=document_type,
    )
    db.add(doc)
    await db.flush()
    return doc


async def ingest_chunk(
    db: AsyncSession,
    document_id: str,
    content: str,
    article_id: Optional[str] = None,
    chunk_index: int = 0,
) -> RegulatoryDocumentChunk:
    """Insert or replace one chunk."""
    chunk = RegulatoryDocumentChunk(
        document_id=document_id,
        article_id=article_id,
        chunk_index=chunk_index,
        content=content,
    )
    db.add(chunk)
    await db.flush()
    return chunk


async def load_norms_from_dir(
    db: AsyncSession,
    path: Optional[Path] = None,
) -> Dict[str, int]:
    """
    Load normative content from a directory. Expects structure:
    {path}/{framework_id}/{jurisdiction}.json (or .md)
    JSON format: { "title": "...", "source_url": "...", "chunks": [ {"article_id": "Art. 92", "content": "..."}, ... ] }
    Or .md: single chunk per file, filename = article_id or "main".
    Returns counts: { "documents": N, "chunks": M }.
    """
    base = path or DEFAULT_NORMS_PATH
    if not base.exists():
        logger.warning("Regulatory norms path does not exist: %s", base)
        return {"documents": 0, "chunks": 0}

    doc_count = 0
    chunk_count = 0
    for framework_dir in base.iterdir():
        if not framework_dir.is_dir():
            continue
        framework_id = framework_dir.name
        for file_path in framework_dir.glob("*.*"):
            if file_path.suffix not in (".json", ".md"):
                continue
            jurisdiction = file_path.stem
            if file_path.suffix == ".json":
                try:
                    data = json.loads(file_path.read_text(encoding="utf-8"))
                except Exception as e:
                    logger.warning("Failed to load %s: %s", file_path, e)
                    continue
                title = data.get("title", f"{framework_id} — {jurisdiction}")
                source_url = data.get("source_url")
                doc = await ensure_document(
                    db, framework_id, jurisdiction, title, source_url, "summary"
                )
                doc_count += 1
                for i, c in enumerate(data.get("chunks", [])):
                    article_id = c.get("article_id")
                    content = c.get("content", "")
                    if content:
                        await ingest_chunk(db, doc.id, content, article_id, i)
                        chunk_count += 1
            else:
                title = f"{framework_id} — {jurisdiction}"
                doc = await ensure_document(db, framework_id, jurisdiction, title, None, "summary")
                doc_count += 1
                content = file_path.read_text(encoding="utf-8")
                if content.strip():
                    await ingest_chunk(db, doc.id, content.strip(), file_path.stem, 0)
                    chunk_count += 1
    return {"documents": doc_count, "chunks": chunk_count}


async def retrieve_regulatory_chunks(
    db: AsyncSession,
    framework_id: str,
    jurisdiction: str,
    query: Optional[str] = None,
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    """
    Retrieve regulatory document chunks for a framework and jurisdiction.
    If query is given, filter chunks that contain the query (case-insensitive substring).
    Otherwise return up to top_k chunks for that framework/jurisdiction.
    """
    docs_q = (
        select(RegulatoryDocument.id)
        .where(
            RegulatoryDocument.framework_id == framework_id,
            RegulatoryDocument.jurisdiction == jurisdiction,
        )
    )
    result = await db.execute(docs_q)
    doc_ids = [r[0] for r in result.all()]
    if not doc_ids:
        return []

    chunk_q = (
        select(RegulatoryDocumentChunk)
        .where(RegulatoryDocumentChunk.document_id.in_(doc_ids))
        .order_by(RegulatoryDocumentChunk.chunk_index, RegulatoryDocumentChunk.article_id)
    )
    if query and query.strip():
        chunk_q = chunk_q.where(
            RegulatoryDocumentChunk.content.ilike(f"%{query.strip()}%")
        )
    chunk_q = chunk_q.limit(top_k)
    rows = (await db.execute(chunk_q)).scalars().all()
    return [
        {
            "id": c.id,
            "document_id": c.document_id,
            "article_id": c.article_id,
            "content": c.content,
            "chunk_index": c.chunk_index,
        }
        for c in rows
    ]
