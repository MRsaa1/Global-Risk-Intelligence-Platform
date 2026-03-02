"""Decision-Grade Audit Extension API endpoints."""
import csv
import io
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.security import require_permission
from src.models.module_audit_log import ModuleAuditLog
from src.services.audit_extension import (
    audit_extension_service,
    get_ghg_inventory,
    get_osfi_b15_readiness_questions,
    list_ghg_inventory_keys,
    set_ghg_inventory,
    submit_osfi_b15_readiness,
)
from src.services.pdf_report import generate_disclosure_pdf, HAS_PDF

logger = logging.getLogger(__name__)
router = APIRouter()


class LogActionRequest(BaseModel):
    """Log an auditable action."""
    module: str
    action: str
    object_type: str = ""
    object_id: str = ""
    input_data: Optional[dict] = None
    output_data: Optional[dict] = None
    actor: str = "system"
    severity: str = "info"
    details: Optional[dict] = None


class DisclosureRequest(BaseModel):
    """Generate a regulatory disclosure package."""
    framework: str = Field(..., description="TCFD, OSFI_B15, EBA, CSA_NI_51_107, SEC_CLIMATE, ISSB")
    organization: str = "Organization"
    reporting_period: str = "2025-01-01 to 2025-12-31"


class OSFIB15ReadinessSubmit(BaseModel):
    """OSFI B-15 readiness self-assessment answers."""
    answers: dict = Field(..., description="Map question_id to 'yes' | 'no' | 'partial'")


class GHGInventoryPayload(BaseModel):
    """GHG inventory for disclosure (replaces placeholder when set)."""
    organization: str = Field(..., description="Organization name")
    reporting_period: str = Field(..., description="e.g. 2025-01-01 to 2025-12-31")
    scope_1_tonnes_co2e: float = Field(..., ge=0, description="Scope 1 direct emissions")
    scope_2_tonnes_co2e: float = Field(..., ge=0, description="Scope 2 indirect emissions")
    scope_3_tonnes_co2e: Optional[float] = Field(None, ge=0, description="Scope 3 value chain (optional)")
    unit: str = Field("tCO2e", description="Unit of measure")
    source: Optional[str] = Field(None, description="Data source description")


@router.post("/log")
async def log_action(request: LogActionRequest):
    """Log a tamper-evident audit entry with hash chain."""
    entry = audit_extension_service.log_action(
        module=request.module,
        action=request.action,
        object_type=request.object_type,
        object_id=request.object_id,
        input_data=request.input_data,
        output_data=request.output_data,
        actor=request.actor,
        severity=request.severity,
        details=request.details,
    )
    return {"status": "logged", "entry": entry.to_dict()}


@router.get("/chain/verify")
async def verify_chain():
    """Verify the entire audit chain is tamper-free."""
    return audit_extension_service.verify_chain_integrity()


@router.get("/trail/{module}")
async def module_audit_trail(
    module: str,
    limit: int = Query(100, ge=1, le=1000),
):
    """Get audit trail for a specific module."""
    return audit_extension_service.get_module_audit_trail(module, limit)


@router.post("/disclosure")
async def generate_disclosure(request: DisclosureRequest):
    """Generate a one-click regulatory disclosure package."""
    return audit_extension_service.generate_disclosure_package(
        framework=request.framework,
        organization=request.organization,
        reporting_period=request.reporting_period,
    )


@router.post("/disclosure/export-pdf")
async def export_disclosure_pdf(
    request: DisclosureRequest,
    _user=Depends(require_permission("export:data")),
):
    """
    Generate disclosure package and export as PDF (sections in regulatory order).
    Returns PDF with draft watermark if mandatory sections are not all populated.
    """
    if not HAS_PDF:
        raise HTTPException(status_code=503, detail="PDF generation not available. Install reportlab.")
    package = audit_extension_service.generate_disclosure_package(
        framework=request.framework,
        organization=request.organization,
        reporting_period=request.reporting_period,
    )
    if "error" in package:
        raise HTTPException(status_code=400, detail=package["error"])
    pdf_bytes = generate_disclosure_pdf(
        framework_id=request.framework,
        disclosure_package=package,
        organization=request.organization,
        reporting_period=request.reporting_period,
    )
    filename = f"disclosure_{request.framework}_{request.reporting_period or 'report'}.pdf".replace(" ", "_").replace("/", "-")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/frameworks")
async def list_frameworks():
    """List available regulatory frameworks for disclosure export."""
    return audit_extension_service.get_available_frameworks()


@router.get("/stats")
async def audit_stats():
    """Get audit extension statistics."""
    return audit_extension_service.get_stats()


@router.get("/osfi-b15/readiness-questions")
async def osfi_b15_readiness_questions():
    """Get OSFI B-15 readiness self-assessment questionnaire."""
    return get_osfi_b15_readiness_questions()


@router.post("/osfi-b15/readiness-submit")
async def osfi_b15_readiness_submit(request: OSFIB15ReadinessSubmit):
    """Submit OSFI B-15 readiness responses; returns score and gaps."""
    return submit_osfi_b15_readiness(request.answers)


@router.get("/ghg-inventory")
async def get_ghg_inventory_endpoint(
    organization: str = Query(..., description="Organization name"),
    reporting_period: str = Query(..., description="Reporting period"),
):
    """Get stored GHG inventory for organization and reporting period (for disclosure)."""
    data = get_ghg_inventory(organization, reporting_period)
    if data is None:
        return {"organization": organization, "reporting_period": reporting_period, "stored": False}
    return {"stored": True, **data}


@router.get("/ghg-inventory/list")
async def list_ghg_inventory():
    """List all stored (organization, reporting_period) keys."""
    return list_ghg_inventory_keys()


@router.put("/ghg-inventory")
async def put_ghg_inventory(request: GHGInventoryPayload):
    """Store or update GHG inventory; used by disclosure package instead of placeholder."""
    return set_ghg_inventory(
        organization=request.organization,
        reporting_period=request.reporting_period,
        scope_1_tonnes_co2e=request.scope_1_tonnes_co2e,
        scope_2_tonnes_co2e=request.scope_2_tonnes_co2e,
        scope_3_tonnes_co2e=request.scope_3_tonnes_co2e,
        unit=request.unit,
        source=request.source,
    )


@router.get("/export")
async def export_module_audit_trail(
    module: str = Query(..., description="Module id: cip, srs, cityos, fst, etc."),
    from_date: Optional[datetime] = Query(None, description="Start of period (inclusive)"),
    to_date: Optional[datetime] = Query(None, description="End of period (inclusive)"),
    format: str = Query("json", description="json or csv"),
    limit: int = Query(1000, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("view:audit")),
):
    """
    Export audit trail for a strategic module (DB-backed).
    For regulator: filter by module and date range; returns JSON or CSV.
    """
    q = select(ModuleAuditLog).where(ModuleAuditLog.module_id == module.lower().strip())
    if from_date is not None:
        q = q.where(ModuleAuditLog.changed_at >= from_date)
    if to_date is not None:
        q = q.where(ModuleAuditLog.changed_at <= to_date)
    q = q.order_by(ModuleAuditLog.changed_at.desc()).limit(limit)
    result = await db.execute(q)
    rows = result.scalars().all()
    items = [
        {
            "id": r.id,
            "module_id": r.module_id,
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "details": r.details,
            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
            "changed_by": r.changed_by,
        }
        for r in rows
    ]
    if format == "csv":
        buf = io.StringIO()
        if not items:
            buf.write("module_id,action,entity_type,entity_id,changed_at,changed_by\n")
        else:
            w = csv.DictWriter(
                buf,
                fieldnames=["id", "module_id", "action", "entity_type", "entity_id", "changed_at", "changed_by"],
                extrasaction="ignore",
            )
            w.writeheader()
            for it in items:
                w.writerow({k: (it.get(k) or "") for k in w.fieldnames})
        from_ts = (from_date or "").strftime("%Y%m%d") if from_date else "start"
        to_ts = (to_date or "").strftime("%Y%m%d") if to_date else "end"
        filename = f"audit_trail_{module}_{from_ts}_{to_ts}.csv"
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    return {"module": module, "count": len(items), "items": items}
