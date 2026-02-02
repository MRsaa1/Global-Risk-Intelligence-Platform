"""
Export API Endpoints.

Provides endpoints for exporting data in various formats:
- CSV export for assets, stress tests, alerts, etc.
- PDF reports (delegates to pdf_report service)
"""
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum

from fastapi import APIRouter, Query, HTTPException, Body, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import io

from src.core.database import get_db
from src.models.asset import Asset
from src.models.stress_test import StressTest, RiskZone, StressTestReport
from src.models.historical_event import HistoricalEvent
from src.layers.agents.sentinel import sentinel_agent
from src.services.export_service import export_service
from src.services.pdf_report import generate_pdf_report, HAS_PDF, PDF_BACKEND

router = APIRouter()


class ExportFormat(str, Enum):
    CSV = "csv"
    # XLSX = "xlsx"  # Future support


class ExportType(str, Enum):
    ASSETS = "assets"
    STRESS_TESTS = "stress_tests"
    RISK_ZONES = "risk_zones"
    ALERTS = "alerts"
    HISTORICAL_EVENTS = "historical_events"


# ==================== HELPER FUNCTIONS ====================

def _get_filename(export_type: str, format: str = "csv") -> str:
    """Generate filename for export."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{export_type}_{timestamp}.{format}"


def _csv_response(data: bytes, filename: str) -> StreamingResponse:
    """Create CSV download response."""
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "text/csv; charset=utf-8",
        }
    )


# ==================== DB QUERY HELPERS ====================

def _get_risk_level(score: Optional[float]) -> str:
    """Convert risk score to risk level."""
    if score is None:
        return "unknown"
    if score >= 70:
        return "critical"
    if score >= 50:
        return "high"
    if score >= 30:
        return "medium"
    return "low"


def _asset_to_dict(asset: Asset) -> dict:
    """Convert Asset model to export dict."""
    # Calculate overall risk score as average of available scores
    scores = [s for s in [asset.climate_risk_score, asset.physical_risk_score, asset.network_risk_score] if s is not None]
    overall_score = sum(scores) / len(scores) if scores else None
    
    return {
        "id": asset.id,
        "name": asset.name,
        "asset_type": asset.asset_type,
        "address": asset.address,
        "city": asset.city,
        "country": asset.country_code,
        "latitude": asset.latitude,
        "longitude": asset.longitude,
        "valuation": asset.current_valuation,
        "currency": asset.valuation_currency,
        "climate_risk_score": asset.climate_risk_score,
        "physical_risk_score": asset.physical_risk_score,
        "network_risk_score": asset.network_risk_score,
        "overall_risk_score": overall_score,
        "risk_level": _get_risk_level(overall_score),
        "status": asset.status,
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "updated_at": asset.updated_at.isoformat() if asset.updated_at else None,
    }


def _stress_test_to_dict(st: StressTest) -> dict:
    """Convert StressTest model to export dict."""
    return {
        "id": st.id,
        "name": st.name,
        "test_type": st.test_type,
        "scenario_name": st.description or st.name,
        "region_name": st.region_name,
        "severity": st.severity,
        "total_loss": st.expected_loss,
        "affected_assets_count": st.affected_assets_count,
        "status": st.status,
        "executed_at": st.updated_at.isoformat() if st.updated_at else None,
    }


def _risk_zone_to_dict(zone: RiskZone) -> dict:
    """Convert RiskZone model to export dict."""
    return {
        "id": zone.id,
        "name": zone.name,
        "zone_level": zone.zone_level,
        "stress_test_id": zone.stress_test_id,
        "affected_assets_count": zone.affected_assets_count,
        "expected_loss": zone.expected_loss,
        "risk_score": zone.risk_score,
        "latitude": zone.center_latitude,
        "longitude": zone.center_longitude,
        "radius_km": zone.radius_km,
    }


def _alert_to_dict(alert) -> dict:
    """Convert Alert dataclass to export dict."""
    return {
        "id": str(alert.id),
        "title": alert.title,
        "alert_type": alert.alert_type.value if hasattr(alert.alert_type, 'value') else str(alert.alert_type),
        "severity": alert.severity.value if hasattr(alert.severity, 'value') else str(alert.severity),
        "message": alert.message,
        "exposure": alert.exposure,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
        "acknowledged": alert.acknowledged,
        "resolved": alert.resolved,
    }


def _historical_event_to_dict(event: HistoricalEvent) -> dict:
    """Convert HistoricalEvent model to export dict."""
    return {
        "id": event.id,
        "name": event.name,
        "event_type": event.event_type,
        "severity": "critical" if (event.severity_actual or 0) >= 0.7 else "high" if (event.severity_actual or 0) >= 0.5 else "medium",
        "date": event.start_date.isoformat() if event.start_date else None,
        "location": event.region_name,
        "latitude": event.center_latitude,
        "longitude": event.center_longitude,
        "total_damage": event.financial_loss_eur,
        "casualties": event.casualties,
        "description": event.description,
    }


# ==================== API ENDPOINTS ====================

@router.get("/assets/csv")
async def export_assets_csv(
    risk_level: Optional[str] = Query(None, description="Filter by risk level"),
    city: Optional[str] = Query(None, description="Filter by city"),
    db: AsyncSession = Depends(get_db),
):
    """
    Export assets to CSV file.
    
    Optional filters:
    - risk_level: Filter by risk level (low, medium, high, critical)
    - city: Filter by city name
    """
    # Build query
    query = select(Asset)
    
    if city:
        query = query.where(Asset.city.ilike(f"%{city}%"))
    
    result = await db.execute(query)
    db_assets = result.scalars().all()
    
    # Convert to dicts
    assets = [_asset_to_dict(a) for a in db_assets]
    
    # Apply risk_level filter (computed field)
    if risk_level:
        assets = [a for a in assets if a.get("risk_level") == risk_level]
    
    # Export to CSV
    csv_data = export_service.export_assets_csv(assets)
    filename = _get_filename("assets")
    
    return _csv_response(csv_data, filename)


@router.get("/stress-tests/csv")
async def export_stress_tests_csv(
    test_type: Optional[str] = Query(None, description="Filter by test type"),
    region: Optional[str] = Query(None, description="Filter by region"),
    db: AsyncSession = Depends(get_db),
):
    """Export stress tests to CSV file."""
    # Build query
    query = select(StressTest)
    
    if test_type:
        query = query.where(StressTest.test_type == test_type)
    if region:
        query = query.where(StressTest.region_name.ilike(f"%{region}%"))
    
    result = await db.execute(query)
    db_tests = result.scalars().all()
    
    # Convert to dicts
    stress_tests = [_stress_test_to_dict(t) for t in db_tests]
    
    # Export to CSV
    csv_data = export_service.export_stress_tests_csv(stress_tests)
    filename = _get_filename("stress_tests")
    
    return _csv_response(csv_data, filename)


@router.get("/risk-zones/csv")
async def export_risk_zones_csv(
    zone_level: Optional[str] = Query(None, description="Filter by zone level"),
    stress_test_id: Optional[str] = Query(None, description="Filter by stress test ID"),
    db: AsyncSession = Depends(get_db),
):
    """Export risk zones to CSV file."""
    # Build query
    query = select(RiskZone)
    
    if zone_level:
        query = query.where(RiskZone.zone_level == zone_level)
    if stress_test_id:
        query = query.where(RiskZone.stress_test_id == stress_test_id)
    
    result = await db.execute(query)
    db_zones = result.scalars().all()
    
    # Convert to dicts
    zones = [_risk_zone_to_dict(z) for z in db_zones]
    
    # Export to CSV
    csv_data = export_service.export_risk_zones_csv(zones)
    filename = _get_filename("risk_zones")
    
    return _csv_response(csv_data, filename)


@router.get("/alerts/csv")
async def export_alerts_csv(
    severity: Optional[str] = Query(None, description="Filter by severity"),
    resolved: Optional[bool] = Query(None, description="Filter by resolved status"),
):
    """Export alerts to CSV file.
    
    Note: Alerts are stored in-memory by the SENTINEL agent.
    For persistent alerts, consider adding a database table.
    """
    # Get alerts from sentinel agent (in-memory)
    alerts = [_alert_to_dict(a) for a in sentinel_agent.active_alerts.values()]
    
    # Apply filters
    if severity:
        alerts = [a for a in alerts if a.get("severity") == severity]
    if resolved is not None:
        alerts = [a for a in alerts if a.get("resolved") == resolved]
    
    # Export to CSV
    csv_data = export_service.export_alerts_csv(alerts)
    filename = _get_filename("alerts")
    
    return _csv_response(csv_data, filename)


@router.get("/historical-events/csv")
async def export_historical_events_csv(
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    db: AsyncSession = Depends(get_db),
):
    """Export historical events to CSV file."""
    # Build query
    query = select(HistoricalEvent)
    
    if event_type:
        query = query.where(HistoricalEvent.event_type == event_type)
    
    result = await db.execute(query)
    db_events = result.scalars().all()
    
    # Convert to dicts
    events = [_historical_event_to_dict(e) for e in db_events]
    
    # Export to CSV
    csv_data = export_service.export_historical_events_csv(events)
    filename = _get_filename("historical_events")
    
    return _csv_response(csv_data, filename)


@router.post("/custom/csv")
async def export_custom_csv(
    data: List[dict],
    columns: Optional[List[str]] = None,
):
    """
    Export custom data to CSV.
    
    Accepts any list of dictionaries and exports them to CSV format.
    Optionally specify columns to include and their order.
    """
    if not data:
        raise HTTPException(status_code=400, detail="No data provided")
    
    csv_data = export_service.export_to_csv(data, columns=columns)
    filename = _get_filename("custom_export")
    
    return _csv_response(csv_data, filename)


# ==================== PDF REPORT ENDPOINTS ====================

def _pdf_response(data: bytes, filename: str) -> StreamingResponse:
    """Create PDF download response."""
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "application/pdf",
        }
    )


class StressTestPDFRequest(BaseModel):
    """Request body for stress test PDF generation."""
    stress_test: Dict[str, Any]
    zones: List[Dict[str, Any]]
    actions: Optional[List[Dict[str, Any]]] = None
    executive_summary: Optional[str] = None


@router.post("/stress-test/pdf")
async def export_stress_test_pdf(request: StressTestPDFRequest):
    """
    Generate PDF report for a stress test.
    
    Accepts stress test data, risk zones, and optional action plans.
    Returns a professional PDF report suitable for stakeholders.
    """
    if not HAS_PDF:
        raise HTTPException(
            status_code=503,
            detail="PDF generation is not available. Install reportlab (recommended for macOS) or WeasyPrint + system libs. See: https://doc.courtbouillon.org/weasyprint/stable/first_steps.html"
        )
    
    try:
        pdf_bytes = generate_pdf_report(
            stress_test=request.stress_test,
            zones=request.zones,
            actions=request.actions,
            executive_summary=request.executive_summary,
        )
        
        # Generate filename
        test_name = request.stress_test.get("name", "stress_test").replace(" ", "_").lower()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{test_name}_{timestamp}.pdf"
        
        return _pdf_response(pdf_bytes, filename)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate PDF report: {str(e)}"
        )


@router.post("/stress-test/{test_id}/pdf")
async def export_stress_test_pdf_by_id(
    test_id: str,
    zones: Optional[List[Dict[str, Any]]] = Body(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate PDF report for a stress test by ID.
    
    Fetches stress test data from the database and generates a PDF.
    Optionally accepts zones data if not stored in the system.
    """
    if not HAS_PDF:
        raise HTTPException(
            status_code=503,
            detail="PDF generation is not available. Install reportlab (recommended for macOS) or WeasyPrint + system libs. See: https://doc.courtbouillon.org/weasyprint/stable/first_steps.html"
        )
    
    # Fetch stress test from database with zones
    query = select(StressTest).options(selectinload(StressTest.zones)).where(StressTest.id == test_id)
    result = await db.execute(query)
    db_stress_test = result.scalar_one_or_none()
    
    if not db_stress_test:
        raise HTTPException(status_code=404, detail=f"Stress test {test_id} not found")
    
    # Convert to dict for PDF generation
    stress_test = _stress_test_to_dict(db_stress_test)
    
    # Enrich with entity_name/entity_type from report_data when present (for context-aware PDF/LLM)
    report_query = (
        select(StressTestReport)
        .where(StressTestReport.stress_test_id == test_id)
        .order_by(StressTestReport.generated_at.desc())
        .limit(1)
    )
    report_result = await db.execute(report_query)
    latest_report = report_result.scalar_one_or_none()
    if latest_report and latest_report.report_data:
        try:
            data = json.loads(latest_report.report_data)
            if data.get("entity_name"):
                stress_test["entity_name"] = data["entity_name"]
            if data.get("entity_type"):
                stress_test["entity_type"] = data["entity_type"]
            if latest_report.summary:
                stress_test["executive_summary"] = latest_report.summary
        except Exception:
            pass
    
    # Use provided zones or get from database
    if zones is None:
        zones = [_risk_zone_to_dict(z) for z in db_stress_test.zones]
    
    try:
        pdf_bytes = generate_pdf_report(
            stress_test=stress_test,
            zones=zones,
        )
        
        test_name = stress_test.get("name", "stress_test").replace(" ", "_").lower()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{test_name}_{timestamp}.pdf"
        
        return _pdf_response(pdf_bytes, filename)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate PDF report: {str(e)}"
        )


@router.get("/pdf/status")
async def get_pdf_status():
    """Check if PDF generation is available."""
    return {
        "available": HAS_PDF,
        "backend": PDF_BACKEND,
        "message": "PDF generation is available" if HAS_PDF else "PDF generation is not available (install reportlab or WeasyPrint + system libs)"
    }
