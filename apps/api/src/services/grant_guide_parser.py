"""
Grant guide PDF parser — extract sections and requirements from grant program PDFs.
Used by Grant Writing Assistant to align AI drafts with official requirements.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

try:
    from pypdf import PdfReader
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False


def parse_pdf_from_bytes(data: bytes) -> Dict[str, Any]:
    """
    Extract text and infer sections from a PDF (grant application guide).
    Returns { "raw_text": str, "sections": [ {"title": str, "content": str}, ... ], "requirements": [str] }.
    """
    if not HAS_PYPDF:
        return {
            "raw_text": "",
            "sections": [],
            "requirements": [],
            "error": "pypdf not installed; pip install pypdf for PDF parsing",
        }
    try:
        reader = PdfReader(io := __import__("io").BytesIO(data))
        raw_text = ""
        for page in reader.pages:
            raw_text += (page.extract_text() or "") + "\n"
        raw_text = raw_text.strip()
        sections = _infer_sections(raw_text)
        requirements = _extract_requirements(raw_text)
        return {
            "raw_text": raw_text[:50_000],
            "sections": sections,
            "requirements": requirements,
        }
    except Exception as e:
        logger.warning("Grant guide PDF parse failed: %s", e)
        return {
            "raw_text": "",
            "sections": [],
            "requirements": [],
            "error": str(e),
        }


def _infer_sections(text: str) -> List[Dict[str, str]]:
    """Heuristic: split by common grant doc headings (numbered or all-caps)."""
    # Find header-like lines: "1. Introduction", "Section 2:", "REQUIREMENTS"
    pattern = re.compile(
        r"^(\d+[.)]\s*[A-Za-z][^\n]{2,80}|Section\s+\d+\s*[:.-]?\s*[^\n]*|[A-Z][A-Z\s]{3,50}:?)\s*$",
        re.MULTILINE,
    )
    matches = list(pattern.finditer(text))
    sections: List[Dict[str, str]] = []
    for i, m in enumerate(matches):
        title = m.group(0).strip().strip(".:-") or f"Section {i + 1}"
        end_next = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[m.end() : end_next].strip()
        sections.append({"title": title, "content": content[:8000]})
    if not sections and text.strip():
        sections.append({"title": "Full text", "content": text.strip()[:15000]})
    return sections


def _extract_requirements(text: str) -> List[str]:
    """Extract requirement-like phrases (bullet points, 'must', 'required', 'shall')."""
    requirements: List[str] = []
    lower = text.lower()
    # Simple bullet or numbered lines
    for line in text.split("\n"):
        line = line.strip()
        if not line or len(line) < 15:
            continue
        if any(kw in line.lower() for kw in ("must", "required", "shall", "applicant must", "submit")):
            requirements.append(line[:500])
    return requirements[:100]
