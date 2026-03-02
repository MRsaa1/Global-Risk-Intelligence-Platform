"""NLP endpoints: sentiment and entity sentiment analysis."""
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.services.nlp_sentiment import analyze_sentiment

router = APIRouter()


class SentimentRequest(BaseModel):
    text: Optional[str] = None
    url: Optional[str] = None
    use_cache: bool = True
    prefer_google: bool = True


@router.post("/sentiment", response_model=dict)
async def post_sentiment(body: SentimentRequest) -> dict:
    """
    Analyze sentiment and entity sentiment for the given text or URL.
    If `url` is provided, fetches the page and uses its text content (strip tags).
    Uses Google Natural Language API or AWS Comprehend when configured; otherwise demo.
    """
    text = body.text
    if body.url and not text:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(body.url)
                r.raise_for_status()
                raw = r.text
            # Simple strip HTML tags for content
            import re
            text = re.sub(r"<[^>]+>", " ", raw)
            text = re.sub(r"\s+", " ", text).strip()[:50000]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {e}")
    if not text:
        raise HTTPException(status_code=400, detail="Provide either 'text' or 'url'")
    result = await analyze_sentiment(
        text,
        use_cache=body.use_cache,
        prefer_google=body.prefer_google,
    )
    return result
