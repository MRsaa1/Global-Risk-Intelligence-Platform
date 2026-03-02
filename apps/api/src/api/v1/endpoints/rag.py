"""
RAG endpoints — document indexing and retrieval (cuRAG).

POST /rag/documents: ingest PDFs or text for GPU-accelerated RAG.
"""
import logging
from typing import Any, Dict, List, Union

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from src.core.config import settings
from src.services.curag_retriever import index_documents, is_available

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/documents",
    response_model=Dict[str, Any],
    summary="Index documents for cuRAG",
    description="Upload PDF files or send text payloads to index for GPU-accelerated RAG. "
    "Requires ENABLE_CURAG=true and nvidia-rag installed.",
)
async def post_rag_documents(
    files: List[UploadFile] = File(default=[], description="PDF or text files to index"),
    texts_json: str | None = Form(default=None, description='Optional JSON array of strings, e.g. ["text1","text2"]'),
) -> Dict[str, Any]:
    """
    Index documents for cuRAG. Accepts multipart files (PDF/text) and/or form field texts_json with JSON array of strings.
    Returns indexed_count, skipped, errors.
    """
    if not getattr(settings, "enable_curag", False):
        raise HTTPException(
            status_code=503,
            detail="cuRAG is disabled. Set ENABLE_CURAG=true and install nvidia-rag (pip install nvidia-rag).",
        )
    items: List[Union[bytes, str]] = []
    if files:
        for f in files:
            try:
                raw = await f.read()
                if raw:
                    items.append(raw)
            except Exception as e:
                logger.warning("RAG documents: read file %s failed: %s", f.filename, e)
    if texts_json:
        try:
            import json
            parsed = json.loads(texts_json)
            if isinstance(parsed, list):
                items.extend(str(t) for t in parsed)
        except Exception as e:
            logger.warning("RAG documents: parse texts_json failed: %s", e)
    if not items:
        return {"indexed_count": 0, "skipped": 0, "errors": ["No files or texts provided."]}
    result = await index_documents(items)
    return result


@router.get(
    "/status",
    response_model=Dict[str, Any],
    summary="cuRAG and agent validation status",
)
async def get_rag_status() -> Dict[str, Any]:
    """Return cuRAG status and whether Guardrails/Morpheus are enabled (for UI)."""
    return {
        "enable_curag": getattr(settings, "enable_curag", False),
        "available": is_available(),
        "curag_index_path": getattr(settings, "curag_index_path", "") or "(in-memory)",
        "guardrails_enabled": getattr(settings, "nemo_guardrails_enabled", True),
        "morpheus_enabled": getattr(settings, "enable_morpheus", False) and bool((getattr(settings, "morpheus_validation_url", "") or "").strip()),
    }
