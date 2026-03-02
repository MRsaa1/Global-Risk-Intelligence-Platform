"""
NVIDIA cuRAG — GPU-accelerated document RAG (optional).

When enable_curag=True and nvidia-rag is installed, indexes PDFs and text documents
and provides semantic retrieval. When disabled or library missing, acts as a stub
(retrieve returns [], index_documents is a no-op).
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Union

from src.core.config import settings

logger = logging.getLogger(__name__)

_HAS_NVIDIA_RAG = False
_curag_pipeline: Any = None


def _init_curag() -> bool:
    """Lazy init of nvidia-rag pipeline. Returns True if ready for use."""
    global _curag_pipeline, _HAS_NVIDIA_RAG
    if not getattr(settings, "enable_curag", False):
        return False
    if _curag_pipeline is not None:
        return True
    try:
        import nvidia_rag  # type: ignore[import-untyped]
    except ImportError:
        logger.debug(
            "nvidia-rag not installed; cuRAG disabled. "
            "Install with: pip install nvidia-rag (optional extra: curag)"
        )
        return False
    try:
        index_path = getattr(settings, "curag_index_path", "") or None
        # Adapt to actual nvidia-rag API when available (e.g. Pipeline(workspace=index_path))
        if hasattr(nvidia_rag, "RAGPipeline"):
            _curag_pipeline = nvidia_rag.RAGPipeline(workspace=index_path)
        elif hasattr(nvidia_rag, "Pipeline"):
            _curag_pipeline = nvidia_rag.Pipeline(workspace=index_path)
        else:
            # Fallback: assume a default constructor
            _curag_pipeline = nvidia_rag.RAGPipeline(workspace=index_path) if index_path else nvidia_rag.RAGPipeline()
        logger.info("cuRAG pipeline initialized (index_path=%s)", index_path or "in-memory")
        return True
    except Exception as e:
        logger.warning("cuRAG pipeline init failed: %s", e)
        return False


def _text_from_item(item: Union[Path, bytes, str]) -> str:
    """Extract indexable text from a path, bytes (PDF or raw), or string."""
    if isinstance(item, str):
        return item.strip()
    if isinstance(item, bytes):
        # Heuristic: if looks like PDF, parse with grant_guide_parser
        if item[:4] == b"%PDF":
            try:
                from src.services.grant_guide_parser import parse_pdf_from_bytes
                out = parse_pdf_from_bytes(item)
                return (out.get("raw_text") or "") + "\n".join(
                    s.get("content", "") for s in out.get("sections") or []
                )
            except Exception as e:
                logger.debug("PDF parse for cuRAG failed: %s", e)
                return ""
        return item.decode("utf-8", errors="replace")
    if isinstance(item, Path):
        path = item
        if not path.exists():
            logger.warning("cuRAG: path does not exist: %s", path)
            return ""
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            try:
                from src.services.grant_guide_parser import parse_pdf_from_bytes
                raw = path.read_bytes()
                out = parse_pdf_from_bytes(raw)
                return (out.get("raw_text") or "") + "\n".join(
                    s.get("content", "") for s in out.get("sections") or []
                )
            except Exception as e:
                logger.debug("PDF parse for cuRAG failed for %s: %s", path, e)
                return ""
        try:
            return path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            logger.warning("cuRAG: read failed for %s: %s", path, e)
            return ""
    return ""


async def index_documents(items: List[Union[Path, bytes, str]]) -> Dict[str, Any]:
    """
    Index documents for GPU-accelerated RAG. Accepts paths (PDF, text), raw bytes, or strings.

    Returns dict with keys: indexed_count, skipped, errors (list).
    When cuRAG is disabled or nvidia-rag is not installed, returns { indexed_count: 0, skipped: len(items), errors: [] }.
    """
    if not _init_curag():
        return {"indexed_count": 0, "skipped": len(items), "errors": []}
    errors: List[str] = []
    indexed = 0
    texts: List[str] = []
    for i, item in enumerate(items):
        try:
            text = _text_from_item(item)
            if not text.strip():
                continue
            texts.append(text)
            indexed += 1
        except Exception as e:
            errors.append(f"item_{i}: {e}")
    if not texts:
        return {"indexed_count": 0, "skipped": len(items) - indexed, "errors": errors}
    try:
        pipeline = _curag_pipeline
        if hasattr(pipeline, "add_documents"):
            pipeline.add_documents(texts)
        elif hasattr(pipeline, "index"):
            pipeline.index(texts)
        else:
            # Assume OpenAI-compatible or ingest API
            for t in texts:
                if hasattr(pipeline, "add_document"):
                    pipeline.add_document(t)
                else:
                    break
            if not hasattr(pipeline, "add_document"):
                logger.warning("cuRAG pipeline has no add_documents/index/add_document; skipping index")
        return {"indexed_count": indexed, "skipped": len(items) - indexed, "errors": errors}
    except Exception as e:
        logger.warning("cuRAG index_documents failed: %s", e)
        return {"indexed_count": 0, "skipped": len(items), "errors": errors + [str(e)]}


async def retrieve(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Retrieve relevant documents from the cuRAG index.

    Returns list of dicts with at least: title, snippet, source (e.g. "curag"), id.
    When cuRAG is disabled or nvidia-rag is not installed, returns [].
    """
    if not query or not query.strip():
        return []
    if not _init_curag():
        return []
    try:
        pipeline = _curag_pipeline
        if hasattr(pipeline, "retrieve"):
            results = pipeline.retrieve(query, top_k=top_k)
        elif hasattr(pipeline, "search"):
            results = pipeline.search(query, top_k=top_k)
        elif hasattr(pipeline, "query"):
            results = pipeline.query(query, top_k=top_k)
        else:
            logger.warning("cuRAG pipeline has no retrieve/search/query method")
            return []
        # Normalize to list of { title, snippet, source, id }
        out: List[Dict[str, Any]] = []
        raw = results if isinstance(results, list) else getattr(results, "results", []) or []
        for i, r in enumerate(raw[:top_k]):
            if isinstance(r, dict):
                out.append({
                    "source": "curag",
                    "entity": "document",
                    "id": r.get("id", f"curag_{i}"),
                    "title": r.get("title") or r.get("name") or f"Document {i + 1}",
                    "snippet": (r.get("snippet") or r.get("content") or r.get("text") or "")[:1000],
                })
            else:
                out.append({
                    "source": "curag",
                    "entity": "document",
                    "id": getattr(r, "id", f"curag_{i}"),
                    "title": getattr(r, "title", getattr(r, "name", f"Document {i + 1}")),
                    "snippet": (getattr(r, "snippet", None) or getattr(r, "content", None) or getattr(r, "text", None) or "")[:1000],
                })
        return out
    except Exception as e:
        logger.warning("cuRAG retrieve failed: %s", e)
        return []


def is_available() -> bool:
    """Return True if cuRAG is enabled and nvidia-rag is ready for use."""
    return _init_curag()
