"""
Export API Endpoints.

Provides endpoints for exporting data in various formats:
- CSV export for assets, stress tests, alerts, etc.
- PDF reports (delegates to pdf_report service)
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum

from fastapi import APIRouter, Query, HTTPException, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io

from src.services.export_service import export_service
from src.services.pdf_report import generate_pdf_report, HAS_WEASYPRINT

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


# ==================== MOCK DATA (replace with DB queries) ====================

def _get_mock_assets() -> List[dict]:
    """Get mock assets for export."""
    return [
        {
            "id": "asset-001",
            "name": "Munich Office Tower",
            "asset_type": "office",
            "address": "Marienplatz 1",
            "city": "Munich",
            "country": "Germany",
            "latitude": 48.1351,
            "longitude": 11.5820,
            "valuation": 125000000,
            "currency": "EUR",
            "climate_risk_score": 35,
            "financial_risk_score": 28,
            "overall_risk_score": 32,
            "risk_level": "medium",
            "status": "active",
            "created_at": "2024-01-15T10:00:00Z",
            "updated_at": "2026-01-15T14:30:00Z",
        },
        {
            "id": "asset-002",
            "name": "Berlin Data Center",
            "asset_type": "data_center",
            "address": "Alexanderplatz 5",
            "city": "Berlin",
            "country": "Germany",
            "latitude": 52.5200,
            "longitude": 13.4050,
            "valuation": 85000000,
            "currency": "EUR",
            "climate_risk_score": 25,
            "financial_risk_score": 40,
            "overall_risk_score": 33,
            "risk_level": "medium",
            "status": "active",
            "created_at": "2024-02-20T09:00:00Z",
            "updated_at": "2026-01-14T11:45:00Z",
        },
        {
            "id": "asset-003",
            "name": "Hamburg Logistics Hub",
            "asset_type": "logistics",
            "address": "Hafenstraße 88",
            "city": "Hamburg",
            "country": "Germany",
            "latitude": 53.5511,
            "longitude": 9.9937,
            "valuation": 65000000,
            "currency": "EUR",
            "climate_risk_score": 72,
            "financial_risk_score": 35,
            "overall_risk_score": 54,
            "risk_level": "high",
            "status": "active",
            "created_at": "2024-03-10T08:30:00Z",
            "updated_at": "2026-01-10T16:00:00Z",
        },
    ]


def _get_mock_stress_tests() -> List[dict]:
    """Get mock stress tests for export."""
    return [
        {
            "id": "st-001",
            "name": "Hamburg Flood Scenario 2026",
            "test_type": "flood",
            "scenario_name": "100-year flood",
            "region_name": "Hamburg",
            "severity": 0.72,
            "total_loss": 45000000,
            "affected_assets_count": 15,
            "population_affected": 125000,
            "status": "completed",
            "executed_at": "2026-01-15T10:30:00Z",
        },
        {
            "id": "st-002",
            "name": "Munich Seismic Stress Test",
            "test_type": "seismic",
            "scenario_name": "Moderate earthquake M5.5",
            "region_name": "Munich",
            "severity": 0.45,
            "total_loss": 28000000,
            "affected_assets_count": 8,
            "population_affected": 50000,
            "status": "completed",
            "executed_at": "2026-01-14T14:15:00Z",
        },
    ]


def _get_mock_risk_zones() -> List[dict]:
    """Get mock risk zones for export."""
    return [
        {
            "id": "zone-001",
            "name": "Harbor District Critical",
            "zone_level": "critical",
            "zone_type": "flood",
            "affected_assets_count": 45,
            "expected_loss": 25000000,
            "population_affected": 35000,
            "latitude": 53.5451,
            "longitude": 9.9937,
            "radius_km": 2.5,
        },
        {
            "id": "zone-002",
            "name": "Industrial Zone High Risk",
            "zone_level": "high",
            "zone_type": "flood",
            "affected_assets_count": 28,
            "expected_loss": 12000000,
            "population_affected": 15000,
            "latitude": 53.5380,
            "longitude": 10.0123,
            "radius_km": 1.8,
        },
    ]


def _get_mock_alerts() -> List[dict]:
    """Get mock alerts for export."""
    return [
        {
            "id": "alert-001",
            "title": "Flood Warning: Hamburg Region",
            "alert_type": "weather",
            "severity": "high",
            "message": "Heavy rainfall expected in next 48 hours. Flood risk elevated.",
            "exposure": 45000000,
            "created_at": "2026-01-17T08:00:00Z",
            "acknowledged": True,
            "resolved": False,
        },
        {
            "id": "alert-002",
            "title": "Infrastructure Degradation: Berlin Grid",
            "alert_type": "infrastructure",
            "severity": "warning",
            "message": "Power grid stability reduced. Monitor closely.",
            "exposure": 12000000,
            "created_at": "2026-01-16T14:30:00Z",
            "acknowledged": True,
            "resolved": True,
        },
    ]


def _get_mock_historical_events() -> List[dict]:
    """Get mock historical events for export."""
    return [
        {
            "id": "event-001",
            "name": "Elbe Flood 2002",
            "event_type": "flood",
            "severity": "critical",
            "date": "2002-08-12",
            "location": "Dresden, Germany",
            "latitude": 51.0504,
            "longitude": 13.7373,
            "total_damage": 11600000000,
            "casualties": 21,
            "description": "Severe flooding along Elbe river affecting eastern Germany.",
        },
        {
            "id": "event-002",
            "name": "European Heat Wave 2003",
            "event_type": "heat",
            "severity": "critical",
            "date": "2003-08-01",
            "location": "Central Europe",
            "latitude": 48.8566,
            "longitude": 2.3522,
            "total_damage": 13000000000,
            "casualties": 70000,
            "description": "Extreme heat wave across Europe with widespread impacts.",
        },
    ]


# ==================== API ENDPOINTS ====================

@router.get("/assets/csv")
async def export_assets_csv(
    risk_level: Optional[str] = Query(None, description="Filter by risk level"),
    city: Optional[str] = Query(None, description="Filter by city"),
):
    """
    Export assets to CSV file.
    
    Optional filters:
    - risk_level: Filter by risk level (low, medium, high, critical)
    - city: Filter by city name
    """
    # Get assets (replace with actual DB query)
    assets = _get_mock_assets()
    
    # Apply filters
    if risk_level:
        assets = [a for a in assets if a.get("risk_level") == risk_level]
    if city:
        assets = [a for a in assets if city.lower() in a.get("city", "").lower()]
    
    # Export to CSV
    csv_data = export_service.export_assets_csv(assets)
    filename = _get_filename("assets")
    
    return _csv_response(csv_data, filename)


@router.get("/stress-tests/csv")
async def export_stress_tests_csv(
    test_type: Optional[str] = Query(None, description="Filter by test type"),
    region: Optional[str] = Query(None, description="Filter by region"),
):
    """Export stress tests to CSV file."""
    # Get stress tests (replace with actual DB query)
    stress_tests = _get_mock_stress_tests()
    
    # Apply filters
    if test_type:
        stress_tests = [t for t in stress_tests if t.get("test_type") == test_type]
    if region:
        stress_tests = [t for t in stress_tests if region.lower() in t.get("region_name", "").lower()]
    
    # Export to CSV
    csv_data = export_service.export_stress_tests_csv(stress_tests)
    filename = _get_filename("stress_tests")
    
    return _csv_response(csv_data, filename)


@router.get("/risk-zones/csv")
async def export_risk_zones_csv(
    zone_level: Optional[str] = Query(None, description="Filter by zone level"),
):
    """Export risk zones to CSV file."""
    # Get risk zones (replace with actual DB query)
    zones = _get_mock_risk_zones()
    
    # Apply filters
    if zone_level:
        zones = [z for z in zones if z.get("zone_level") == zone_level]
    
    # Export to CSV
    csv_data = export_service.export_risk_zones_csv(zones)
    filename = _get_filename("risk_zones")
    
    return _csv_response(csv_data, filename)


@router.get("/alerts/csv")
async def export_alerts_csv(
    severity: Optional[str] = Query(None, description="Filter by severity"),
    resolved: Optional[bool] = Query(None, description="Filter by resolved status"),
):
    """Export alerts to CSV file."""
    # Get alerts (replace with actual DB query)
    alerts = _get_mock_alerts()
    
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
):
    """Export historical events to CSV file."""
    # Get events (replace with actual DB query)
    events = _get_mock_historical_events()
    
    # Apply filters
    if event_type:
        events = [e for e in events if e.get("event_type") == event_type]
    
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
    if not HAS_WEASYPRINT:
        raise HTTPException(
            status_code=503,
            detail="PDF generation is not available. WeasyPrint is not installed on the server."
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
):
    """
    Generate PDF report for a stress test by ID.
    
    Fetches stress test data from the system and generates a PDF.
    Optionally accepts zones data if not stored in the system.
    """
    if not HAS_WEASYPRINT:
        raise HTTPException(
            status_code=503,
            detail="PDF generation is not available. WeasyPrint is not installed on the server."
        )
    
    # For now, use mock data based on test_id
    # In production, this would fetch from database
    stress_test = _get_mock_stress_test_by_id(test_id)
    
    if not stress_test:
        raise HTTPException(status_code=404, detail=f"Stress test {test_id} not found")
    
    # Use provided zones or get mock zones
    if zones is None:
        zones = _get_mock_risk_zones()
    
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


def _get_mock_stress_test_by_id(test_id: str) -> Optional[Dict[str, Any]]:
    """Get mock stress test by ID."""
    tests = {
        "st-001": {
            "id": "st-001",
            "name": "Hamburg Flood Scenario 2026",
            "test_type": "flood",
            "scenario_name": "100-year flood",
            "region_name": "Hamburg",
            "severity": 0.72,
            "total_loss": 45000000,
            "affected_assets_count": 15,
            "population_affected": 125000,
            "status": "completed",
            "executed_at": "2026-01-15T10:30:00Z",
            "nvidia_enhanced": True,
        },
        "st-002": {
            "id": "st-002",
            "name": "Munich Seismic Stress Test",
            "test_type": "seismic",
            "scenario_name": "Moderate earthquake M5.5",
            "region_name": "Munich",
            "severity": 0.45,
            "total_loss": 28000000,
            "affected_assets_count": 8,
            "population_affected": 50000,
            "status": "completed",
            "executed_at": "2026-01-14T14:15:00Z",
            "nvidia_enhanced": False,
        },
    }
    return tests.get(test_id)


def _get_mock_risk_zones() -> List[Dict[str, Any]]:
    """Get mock risk zones for demonstration."""
    return [
        {
            "id": "zone-1",
            "name": "Downtown Critical Zone",
            "zone_level": "critical",
            "zone_type": "flood",
            "affected_assets_count": 45,
            "expected_loss": 12500000,
            "population_affected": 35000,
            "risk_score": 0.85,
        },
        {
            "id": "zone-2",
            "name": "Harbor Industrial Area",
            "zone_level": "high",
            "zone_type": "flood",
            "affected_assets_count": 28,
            "expected_loss": 8200000,
            "population_affected": 12000,
            "risk_score": 0.72,
        },
        {
            "id": "zone-3",
            "name": "Residential North",
            "zone_level": "medium",
            "zone_type": "flood",
            "affected_assets_count": 120,
            "expected_loss": 4800000,
            "population_affected": 45000,
            "risk_score": 0.55,
        },
        {
            "id": "zone-4",
            "name": "Business Park East",
            "zone_level": "low",
            "zone_type": "flood",
            "affected_assets_count": 35,
            "expected_loss": 1200000,
            "population_affected": 8000,
            "risk_score": 0.32,
        },
    ]


@router.get("/pdf/status")
async def get_pdf_status():
    """Check if PDF generation is available."""
    return {
        "available": HAS_WEASYPRINT,
        "message": "PDF generation is available" if HAS_WEASYPRINT else "WeasyPrint is not installed"
    }
