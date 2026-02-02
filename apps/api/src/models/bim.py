"""BIM (Building Information Model) database models."""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, Boolean, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class BIMModel(Base):
    """
    BIM model file metadata and processing status.
    
    Stores information about uploaded IFC files and their processing results.
    """
    __tablename__ = "bim_models"
    
    # Identity
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    
    # File info
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64))  # SHA-256
    
    # IFC metadata
    ifc_schema: Mapped[Optional[str]] = mapped_column(String(20))  # IFC2X3, IFC4, etc.
    application: Mapped[Optional[str]] = mapped_column(String(255))
    author: Mapped[Optional[str]] = mapped_column(String(255))
    organization: Mapped[Optional[str]] = mapped_column(String(255))
    ifc_creation_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Building info
    project_name: Mapped[Optional[str]] = mapped_column(String(255))
    site_name: Mapped[Optional[str]] = mapped_column(String(255))
    building_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Statistics
    element_count: Mapped[int] = mapped_column(Integer, default=0)
    floor_count: Mapped[int] = mapped_column(Integer, default=0)
    space_count: Mapped[int] = mapped_column(Integer, default=0)
    wall_count: Mapped[int] = mapped_column(Integer, default=0)
    door_count: Mapped[int] = mapped_column(Integer, default=0)
    window_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Geometry
    gross_floor_area: Mapped[Optional[float]] = mapped_column(Float)
    
    # Processing status
    processing_status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        comment="pending, processing, completed, failed",
    )
    processing_progress: Mapped[int] = mapped_column(Integer, default=0)
    processing_message: Mapped[Optional[str]] = mapped_column(Text)
    processing_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Storage paths (relative to storage root)
    gltf_path: Mapped[Optional[str]] = mapped_column(String(500))
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(500))
    original_file_path: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Flags
    has_geometry: Mapped[bool] = mapped_column(Boolean, default=False)
    has_thumbnail: Mapped[bool] = mapped_column(Boolean, default=False)
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Errors/warnings
    errors: Mapped[Optional[str]] = mapped_column(Text)  # JSON list
    warnings: Mapped[Optional[str]] = mapped_column(Text)  # JSON list
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))
    
    # Relationships
    elements = relationship("BIMElement", back_populates="bim_model", cascade="all, delete-orphan")
    floors = relationship("BIMFloor", back_populates="bim_model", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<BIMModel {self.id}: {self.file_name}>"


class BIMFloor(Base):
    """
    Floor/storey information from BIM model.
    
    Represents IfcBuildingStorey elements.
    """
    __tablename__ = "bim_floors"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    bim_model_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("bim_models.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    
    # IFC data
    ifc_id: Mapped[Optional[str]] = mapped_column(String(100))
    ifc_global_id: Mapped[Optional[str]] = mapped_column(String(22))
    
    # Floor info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    elevation: Mapped[Optional[float]] = mapped_column(Float)  # in meters
    height: Mapped[Optional[float]] = mapped_column(Float)  # floor to floor height
    
    # Statistics
    element_count: Mapped[int] = mapped_column(Integer, default=0)
    space_count: Mapped[int] = mapped_column(Integer, default=0)
    gross_area: Mapped[Optional[float]] = mapped_column(Float)
    
    # Order
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    
    # Relationship
    bim_model = relationship("BIMModel", back_populates="floors")
    elements = relationship("BIMElement", back_populates="floor")
    
    def __repr__(self) -> str:
        return f"<BIMFloor {self.name}: {self.elevation}m>"


class BIMElement(Base):
    """
    Individual BIM element from IFC file.
    
    Stores element metadata and properties for querying.
    Actual geometry is stored in glTF file.
    """
    __tablename__ = "bim_elements"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    bim_model_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("bim_models.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    floor_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("bim_floors.id", ondelete="SET NULL"),
        index=True,
    )
    
    # IFC identity
    ifc_id: Mapped[str] = mapped_column(String(100), index=True)
    ifc_global_id: Mapped[Optional[str]] = mapped_column(String(22))
    ifc_type: Mapped[str] = mapped_column(String(100), index=True)  # IfcWall, IfcDoor, etc.
    
    # Element info
    name: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    object_type: Mapped[Optional[str]] = mapped_column(String(255))
    tag: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Classification
    classification_code: Mapped[Optional[str]] = mapped_column(String(50))
    classification_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Properties (stored as JSON)
    properties: Mapped[Optional[str]] = mapped_column(Text)  # JSON dict
    quantities: Mapped[Optional[str]] = mapped_column(Text)  # JSON dict (area, volume, etc.)
    materials: Mapped[Optional[str]] = mapped_column(Text)  # JSON list
    
    # Geometry bounds (for spatial queries)
    min_x: Mapped[Optional[float]] = mapped_column(Float)
    min_y: Mapped[Optional[float]] = mapped_column(Float)
    min_z: Mapped[Optional[float]] = mapped_column(Float)
    max_x: Mapped[Optional[float]] = mapped_column(Float)
    max_y: Mapped[Optional[float]] = mapped_column(Float)
    max_z: Mapped[Optional[float]] = mapped_column(Float)
    
    # Risk-relevant properties
    is_structural: Mapped[bool] = mapped_column(Boolean, default=False)
    is_external: Mapped[bool] = mapped_column(Boolean, default=False)
    fire_rating: Mapped[Optional[str]] = mapped_column(String(50))
    load_bearing: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    bim_model = relationship("BIMModel", back_populates="elements")
    floor = relationship("BIMFloor", back_populates="elements")
    
    def __repr__(self) -> str:
        return f"<BIMElement {self.ifc_type}: {self.name or self.ifc_id}>"


class BIMSite(Base):
    """
    Site information from BIM model (IfcSite).
    """
    __tablename__ = "bim_sites"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    bim_model_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("bim_models.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    
    # IFC data
    ifc_id: Mapped[Optional[str]] = mapped_column(String(100))
    ifc_global_id: Mapped[Optional[str]] = mapped_column(String(22))
    
    # Site info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Location
    address: Mapped[Optional[str]] = mapped_column(Text)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    elevation: Mapped[Optional[float]] = mapped_column(Float)
    
    # Area
    land_area: Mapped[Optional[float]] = mapped_column(Float)
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    
    def __repr__(self) -> str:
        return f"<BIMSite {self.name}>"


class BIMBuilding(Base):
    """
    Building information from BIM model (IfcBuilding).
    """
    __tablename__ = "bim_buildings"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    bim_model_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("bim_models.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    site_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("bim_sites.id", ondelete="SET NULL"),
    )
    
    # IFC data
    ifc_id: Mapped[Optional[str]] = mapped_column(String(100))
    ifc_global_id: Mapped[Optional[str]] = mapped_column(String(22))
    
    # Building info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Location within site
    elevation: Mapped[Optional[float]] = mapped_column(Float)
    
    # Statistics
    storey_count: Mapped[int] = mapped_column(Integer, default=0)
    gross_floor_area: Mapped[Optional[float]] = mapped_column(Float)
    footprint_area: Mapped[Optional[float]] = mapped_column(Float)
    
    # Building classification
    occupancy_type: Mapped[Optional[str]] = mapped_column(String(100))
    construction_type: Mapped[Optional[str]] = mapped_column(String(100))
    year_of_construction: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Audit
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    
    def __repr__(self) -> str:
        return f"<BIMBuilding {self.name}>"
