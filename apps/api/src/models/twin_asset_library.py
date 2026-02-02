"""Digital Twin Asset Library (OpenUSD master + web derivatives).

This table represents the *catalog* of digital-twin 3D assets that can be attached
to our domain objects (Asset/Project) and consumed either in:
- Omniverse (OpenUSD via Nucleus paths)
- Web (GLB/3D Tiles via MinIO/S3)
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class TwinAssetLibraryItem(Base):
    """Catalog row for a reusable digital twin asset."""

    __tablename__ = "twin_asset_library"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # Classification
    domain: Mapped[str] = mapped_column(String(50), default="factory")  # city|factory|finance|other
    kind: Mapped[str] = mapped_column(String(80), default="building")  # factory_plant|city_block|bank_hq|...
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # residential|commercial|industrial|public

    # Human metadata
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[str]] = mapped_column(Text)  # JSON array as text
    license: Mapped[Optional[str]] = mapped_column(String(200))
    source: Mapped[Optional[str]] = mapped_column(String(120))  # nvidia_pack|blueprint|osmn|ifc|custom
    source_url: Mapped[Optional[str]] = mapped_column(String(500))

    # OpenUSD master (Nucleus path or URL)
    usd_path: Mapped[Optional[str]] = mapped_column(String(700))

    # Web derivatives (MinIO object keys)
    glb_object: Mapped[Optional[str]] = mapped_column(String(700))
    thumbnail_object: Mapped[Optional[str]] = mapped_column(String(700))

    # JSON metadata (bounds, LODs, variants)
    extra_metadata: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)

