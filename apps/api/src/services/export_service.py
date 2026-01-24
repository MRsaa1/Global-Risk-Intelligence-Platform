"""
Export Service - CSV and Excel export functionality.

Supports exporting:
- Assets (with risk metrics)
- Stress test results
- Risk zones
- Portfolio summaries
- Historical events
"""
import csv
import io
from datetime import datetime
from typing import Any, Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class ExportService:
    """Service for exporting data to various formats."""
    
    def __init__(self):
        self.supported_formats = ["csv", "xlsx"]
    
    def _flatten_dict(self, d: dict, parent_key: str = '', sep: str = '_') -> dict:
        """Flatten nested dictionary for CSV export."""
        items = []
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(self._flatten_dict(v, new_key, sep=sep).items())
            elif isinstance(v, list):
                if v and isinstance(v[0], dict):
                    # For list of dicts, just count items
                    items.append((f"{new_key}_count", len(v)))
                else:
                    items.append((new_key, ", ".join(str(x) for x in v)))
            else:
                items.append((new_key, v))
        return dict(items)
    
    def _format_value(self, value: Any) -> str:
        """Format value for CSV export."""
        if value is None:
            return ""
        if isinstance(value, bool):
            return "Yes" if value else "No"
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, float):
            return f"{value:.2f}"
        if isinstance(value, list):
            return ", ".join(str(v) for v in value)
        return str(value)
    
    def export_to_csv(
        self,
        data: List[Dict[str, Any]],
        columns: Optional[List[str]] = None,
        column_labels: Optional[Dict[str, str]] = None,
    ) -> bytes:
        """
        Export data to CSV format.
        
        Args:
            data: List of dictionaries to export
            columns: Optional list of columns to include (in order)
            column_labels: Optional mapping of column names to display labels
            
        Returns:
            CSV file as bytes
        """
        if not data:
            return b""
        
        # Flatten all rows
        flattened_data = [self._flatten_dict(row) for row in data]
        
        # Determine columns
        if columns:
            fieldnames = columns
        else:
            # Get all unique keys from all rows
            all_keys = set()
            for row in flattened_data:
                all_keys.update(row.keys())
            fieldnames = sorted(list(all_keys))
        
        # Create CSV
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        
        # Write header with labels if provided
        if column_labels:
            header_row = {k: column_labels.get(k, k) for k in fieldnames}
            writer.writerow(header_row)
        else:
            writer.writeheader()
        
        # Write data rows
        for row in flattened_data:
            formatted_row = {k: self._format_value(v) for k, v in row.items()}
            writer.writerow(formatted_row)
        
        return output.getvalue().encode('utf-8-sig')  # BOM for Excel compatibility
    
    def export_assets_csv(self, assets: List[Dict[str, Any]]) -> bytes:
        """Export assets to CSV with predefined columns."""
        columns = [
            "id", "name", "asset_type", "address", "city", "country",
            "latitude", "longitude", "valuation", "currency",
            "climate_risk_score", "financial_risk_score", "overall_risk_score",
            "risk_level", "status", "created_at", "updated_at"
        ]
        
        labels = {
            "id": "Asset ID",
            "name": "Asset Name",
            "asset_type": "Type",
            "address": "Address",
            "city": "City",
            "country": "Country",
            "latitude": "Latitude",
            "longitude": "Longitude",
            "valuation": "Valuation",
            "currency": "Currency",
            "climate_risk_score": "Climate Risk",
            "financial_risk_score": "Financial Risk",
            "overall_risk_score": "Overall Risk",
            "risk_level": "Risk Level",
            "status": "Status",
            "created_at": "Created",
            "updated_at": "Updated",
        }
        
        return self.export_to_csv(assets, columns=columns, column_labels=labels)
    
    def export_stress_tests_csv(self, stress_tests: List[Dict[str, Any]]) -> bytes:
        """Export stress test results to CSV."""
        columns = [
            "id", "name", "test_type", "scenario_name", "region_name",
            "severity", "total_loss", "affected_assets_count",
            "population_affected", "status", "executed_at"
        ]
        
        labels = {
            "id": "Test ID",
            "name": "Test Name",
            "test_type": "Type",
            "scenario_name": "Scenario",
            "region_name": "Region",
            "severity": "Severity",
            "total_loss": "Total Loss (€)",
            "affected_assets_count": "Affected Assets",
            "population_affected": "Population Affected",
            "status": "Status",
            "executed_at": "Executed At",
        }
        
        return self.export_to_csv(stress_tests, columns=columns, column_labels=labels)
    
    def export_risk_zones_csv(self, zones: List[Dict[str, Any]]) -> bytes:
        """Export risk zones to CSV."""
        columns = [
            "id", "name", "zone_level", "zone_type",
            "affected_assets_count", "expected_loss", "population_affected",
            "latitude", "longitude", "radius_km"
        ]
        
        labels = {
            "id": "Zone ID",
            "name": "Zone Name",
            "zone_level": "Risk Level",
            "zone_type": "Zone Type",
            "affected_assets_count": "Buildings",
            "expected_loss": "Expected Loss (€)",
            "population_affected": "Population",
            "latitude": "Latitude",
            "longitude": "Longitude",
            "radius_km": "Radius (km)",
        }
        
        return self.export_to_csv(zones, columns=columns, column_labels=labels)
    
    def export_portfolio_summary_csv(self, summary: Dict[str, Any]) -> bytes:
        """Export portfolio summary to CSV."""
        # Convert summary dict to list of key-value pairs
        rows = []
        for key, value in summary.items():
            if isinstance(value, dict):
                for sub_key, sub_value in value.items():
                    rows.append({
                        "metric": f"{key}_{sub_key}",
                        "value": sub_value
                    })
            else:
                rows.append({
                    "metric": key,
                    "value": value
                })
        
        columns = ["metric", "value"]
        labels = {"metric": "Metric", "value": "Value"}
        
        return self.export_to_csv(rows, columns=columns, column_labels=labels)
    
    def export_historical_events_csv(self, events: List[Dict[str, Any]]) -> bytes:
        """Export historical events to CSV."""
        columns = [
            "id", "name", "event_type", "severity", "date",
            "location", "latitude", "longitude",
            "total_damage", "casualties", "description"
        ]
        
        labels = {
            "id": "Event ID",
            "name": "Event Name",
            "event_type": "Type",
            "severity": "Severity",
            "date": "Date",
            "location": "Location",
            "latitude": "Latitude",
            "longitude": "Longitude",
            "total_damage": "Total Damage (€)",
            "casualties": "Casualties",
            "description": "Description",
        }
        
        return self.export_to_csv(events, columns=columns, column_labels=labels)
    
    def export_alerts_csv(self, alerts: List[Dict[str, Any]]) -> bytes:
        """Export alerts to CSV."""
        columns = [
            "id", "title", "alert_type", "severity", "message",
            "exposure", "created_at", "acknowledged", "resolved"
        ]
        
        labels = {
            "id": "Alert ID",
            "title": "Title",
            "alert_type": "Type",
            "severity": "Severity",
            "message": "Message",
            "exposure": "Exposure (€)",
            "created_at": "Created",
            "acknowledged": "Acknowledged",
            "resolved": "Resolved",
        }
        
        return self.export_to_csv(alerts, columns=columns, column_labels=labels)


# Global service instance
export_service = ExportService()


def export_assets_to_csv(assets: List[Dict[str, Any]]) -> bytes:
    """Export assets to CSV."""
    return export_service.export_assets_csv(assets)


def export_stress_tests_to_csv(stress_tests: List[Dict[str, Any]]) -> bytes:
    """Export stress tests to CSV."""
    return export_service.export_stress_tests_csv(stress_tests)


def export_risk_zones_to_csv(zones: List[Dict[str, Any]]) -> bytes:
    """Export risk zones to CSV."""
    return export_service.export_risk_zones_csv(zones)
