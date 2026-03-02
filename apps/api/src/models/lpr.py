"""LPR (Leader/Persona Risk) module — psychological profile of decision-makers.

Stores entities (persons/organizations), appearances (media events), and derived
metrics (paralinguistics, emotions, topics, course-change flags) for Early Warning
and Command Center dashboards.
"""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class LprEntity(Base):
    """Person or organization tracked for LPR (psychological/behavioral profile)."""
    __tablename__ = "lpr_entities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    external_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), default="person")  # person, organization
    role: Mapped[Optional[str]] = mapped_column(String(255))  # e.g. central_bank_governor, minister
    region: Mapped[Optional[str]] = mapped_column(String(100))
    doctrine_ref: Mapped[Optional[str]] = mapped_column(Text)  # Reference text / doctrine to compare against
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
    extra_data: Mapped[Optional[str]] = mapped_column(Text)


class LprAppearance(Base):
    """Single media appearance (speech, interview, press conference) linked to an LPR entity."""
    __tablename__ = "lpr_appearances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    entity_id: Mapped[str] = mapped_column(String(36), ForeignKey("lpr_entities.id", ondelete="CASCADE"), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(50), default="video")  # video, audio, transcript
    source_url: Mapped[Optional[str]] = mapped_column(String(1024))
    title: Mapped[Optional[str]] = mapped_column(String(512))
    occurred_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    transcript: Mapped[Optional[str]] = mapped_column(Text)
    storage_key: Mapped[Optional[str]] = mapped_column(String(512))  # MinIO/S3 key for media
    language: Mapped[Optional[str]] = mapped_column(String(10), default="en")
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)  # When Riva/Maxine/Vertex ran
    extra_data: Mapped[Optional[str]] = mapped_column(Text)


class LprMetrics(Base):
    """Derived metrics per appearance: paralinguistics, emotions, topics, course-change flags."""
    __tablename__ = "lpr_metrics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    appearance_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lpr_appearances.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Paralinguistics (from Riva or similar)
    pace_wpm: Mapped[Optional[float]] = mapped_column(Float)  # Words per minute
    pause_ratio: Mapped[Optional[float]] = mapped_column(Float)
    stress_score: Mapped[Optional[float]] = mapped_column(Float)  # 0–1
    # Emotions / micro-expressions (from Maxine or Rekognition)
    emotion_scores: Mapped[Optional[str]] = mapped_column(Text)  # JSON: { "neutral": 0.7, "stress": 0.2, ... }
    # Topics (from NLP)
    topics: Mapped[Optional[str]] = mapped_column(Text)  # JSON list or comma-separated
    # Doctrine / course change (from Vertex Gemini)
    contradiction_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    course_change_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    doctrine_notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    extra_data: Mapped[Optional[str]] = mapped_column(Text)
