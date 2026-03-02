"""Disinformation module — sources, posts, campaigns, and risk labels.

Stores sources (social, news), posts/articles, labels (bot, coordinated_campaign, fake),
and campaign grouping for alerts when panic/crash risk threshold is exceeded.
"""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class DisinformationSource(Base):
    """Source of content (social, news aggregator, etc.)."""
    __tablename__ = "disinformation_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)  # social, news, rss
    url_pattern: Mapped[Optional[str]] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)


class DisinformationPost(Base):
    """Single post or article with analysis results and labels."""
    __tablename__ = "disinformation_posts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("disinformation_sources.id", ondelete="SET NULL"), index=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    url: Mapped[Optional[str]] = mapped_column(String(1024))
    title: Mapped[Optional[str]] = mapped_column(String(512))
    content: Mapped[Optional[str]] = mapped_column(Text)
    language: Mapped[Optional[str]] = mapped_column(String(10), default="en")
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    # Labels (from NLP / heuristics / fact-check)
    label_bot: Mapped[bool] = mapped_column(Boolean, default=False)
    label_coordinated: Mapped[bool] = mapped_column(Boolean, default=False)
    label_fake: Mapped[bool] = mapped_column(Boolean, default=False)
    sentiment_score: Mapped[Optional[float]] = mapped_column(Float)  # -1..1
    topics: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    risk_score: Mapped[Optional[float]] = mapped_column(Float)  # 0..1 panic/crash risk
    campaign_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)  # FK to campaign, optional
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    analyzed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class DisinformationCampaign(Base):
    """Coordinated campaign grouping posts with aggregate risk."""
    __tablename__ = "disinformation_campaigns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    post_count: Mapped[int] = mapped_column(Integer, default=0)
    risk_score_avg: Mapped[Optional[float]] = mapped_column(Float)
    risk_panic_elevated: Mapped[bool] = mapped_column(Boolean, default=False)  # threshold exceeded → alert
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
