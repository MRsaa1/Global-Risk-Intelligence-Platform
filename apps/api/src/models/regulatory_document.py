"""Regulatory documents and chunks for RAG — normative text by framework and jurisdiction."""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class RegulatoryDocument(Base):
    """
    Catalog of normative documents (Basel, DORA, NIS2, etc.) by framework and jurisdiction.
    """
    __tablename__ = "regulatory_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    framework_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    jurisdiction: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(String(1024))
    document_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="summary"
    )  # full_text | summary | article_list
    file_path: Mapped[Optional[str]] = mapped_column(String(1024))
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)

    chunks: Mapped[list["RegulatoryDocumentChunk"]] = relationship(
        "RegulatoryDocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan",
    )


class RegulatoryDocumentChunk(Base):
    """
    Chunk of normative text for RAG retrieval (by framework_id, jurisdiction, optional article_id).
    """
    __tablename__ = "regulatory_document_chunks"
    __table_args__ = (
        Index("ix_regulatory_document_chunks_doc_article", "document_id", "article_id", unique=False),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    document_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("regulatory_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    article_id: Mapped[Optional[str]] = mapped_column(String(128), index=True)  # e.g. Art. 92, CRR 411
    chunk_index: Mapped[int] = mapped_column(default=0)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding_vector: Mapped[Optional[str]] = mapped_column(Text)  # JSON array or null if not embedded
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)

    document: Mapped["RegulatoryDocument"] = relationship(
        "RegulatoryDocument",
        back_populates="chunks",
    )


