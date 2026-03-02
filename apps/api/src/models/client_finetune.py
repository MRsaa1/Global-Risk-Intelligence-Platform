"""Client fine-tuning datasets and runs (Phase C3)."""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class ClientFinetuneDataset(Base):
    """Uploaded client dataset for fine-tuning (portfolios, incidents, precedents)."""
    __tablename__ = "client_finetune_datasets"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    path: Mapped[str] = mapped_column(String(512), nullable=False)  # storage path (dir or S3 key)
    size: Mapped[Optional[int]] = mapped_column(Integer)  # bytes
    status: Mapped[str] = mapped_column(String(20), default="ready", index=True)  # ready | processing | failed
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)

    runs: Mapped[list["ClientFinetuneRun"]] = relationship(
        "ClientFinetuneRun",
        back_populates="dataset",
        cascade="all, delete-orphan",
    )


class ClientFinetuneRun(Base):
    """Single fine-tuning run (Customizer) for a client dataset."""
    __tablename__ = "client_finetune_runs"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    dataset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("client_finetune_datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)  # pending | training | completed | failed
    model_path_or_id: Mapped[Optional[str]] = mapped_column(String(512))  # adapter path or NeMo model_id
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)

    dataset: Mapped["ClientFinetuneDataset"] = relationship("ClientFinetuneDataset", back_populates="runs")
