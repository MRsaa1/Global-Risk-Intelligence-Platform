"""
Lightweight sentiment and threat-level analyzer for OSINT text.

Produces sentiment_score (-1 to 1) and threat_level (0-10). Uses keyword-based
scoring; optional TextBlob if installed for finer sentiment.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional

# Risk/threat keywords (presence increases threat_level)
THREAT_KEYWORDS = [
    "attack", "breach", "crisis", "disaster", "earthquake", "flood", "war", "sanctions",
    "collapse", "crash", "pandemic", "outbreak", "terror", "strike", "invasion",
    "ransomware", "cyber", "exploit", "vulnerability", "crisis", "emergency",
]
# Negative sentiment keywords
NEGATIVE_KEYWORDS = [
    "bad", "worst", "fail", "failure", "decline", "loss", "damage", "destroyed",
    "fear", "risk", "danger", "threat", "collapse", "crisis", "emergency",
]
# Positive (reduce net negative)
POSITIVE_KEYWORDS = [
    "recovery", "stable", "growth", "safe", "resolved", "contained",
]


@dataclass
class SentimentResult:
    """Result of sentiment/threat analysis."""
    sentiment_score: float  # -1 to 1
    threat_level: float     # 0 to 10
    entities: List[str]     # simple place/org hints (e.g. capitalized phrases)


def _tokenize(text: str) -> List[str]:
    if not text or not isinstance(text, str):
        return []
    text = text.lower().strip()
    # Keep alphanumeric and split
    tokens = re.findall(r"[a-z0-9]+", text)
    return tokens


def _extract_entities(text: str, max_entities: int = 10) -> List[str]:
    """Extract likely entities: capitalized multi-word phrases."""
    if not text or not isinstance(text, str):
        return []
    # Match sequences of 2+ capitalized words
    matches = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b", text)
    return list(dict.fromkeys(matches))[:max_entities]


def analyze_sentiment(text: Optional[str]) -> SentimentResult:
    """
    Analyze text for sentiment and threat level.
    Returns SentimentResult(sentiment_score, threat_level, entities).
    """
    if not text or not isinstance(text, str):
        return SentimentResult(sentiment_score=0.0, threat_level=0.0, entities=[])

    tokens = set(_tokenize(text))
    entities = _extract_entities(text)

    # Threat level: count threat keywords, cap at 10
    threat_count = sum(1 for w in THREAT_KEYWORDS if w in tokens)
    threat_level = min(10.0, threat_count * 2.0)  # 0-10

    # Sentiment: negative vs positive keyword balance; optional TextBlob
    neg = sum(1 for w in NEGATIVE_KEYWORDS if w in tokens)
    pos = sum(1 for w in POSITIVE_KEYWORDS if w in tokens)
    raw = pos - neg
    # Normalize to roughly [-1, 1]
    if raw == 0:
        sentiment_score = 0.0
    else:
        sentiment_score = max(-1.0, min(1.0, raw / 5.0))

    # If TextBlob is available, blend with its polarity
    try:
        from textblob import TextBlob
        blob = TextBlob(text[:5000])
        pol = blob.sentiment.polarity
        sentiment_score = (sentiment_score + pol) / 2.0
        sentiment_score = max(-1.0, min(1.0, sentiment_score))
    except ImportError:
        pass

    return SentimentResult(
        sentiment_score=round(sentiment_score, 3),
        threat_level=round(threat_level, 1),
        entities=entities,
    )
