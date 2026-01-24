"""
Bulk Operations Service.

Handles bulk uploads and batch processing:
- CSV/Excel asset upload
- Bulk stress test execution
- Batch risk calculations
"""
import csv
import io
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4
import logging

from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)


class BulkOperationResult(BaseModel):
    """Result of a bulk operation."""
    success: bool
    total_records: int
    processed: int
    succeeded: int
    failed: int
    errors: List[Dict[str, Any]]
    created_ids: List[str]
    processing_time_ms: int


class AssetCSVRow(BaseModel):
    """Expected structure for asset CSV import."""
    name: str
    asset_type: Optional[str] = "commercial_office"
    address: Optional[str] = None
    city: Optional[str] = None
    country_code: str = "DE"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    valuation: Optional[float] = None
    currency: str = "EUR"
    year_built: Optional[int] = None
    gross_floor_area_m2: Optional[float] = None
    floors_above_ground: Optional[int] = None
    tags: Optional[str] = None  # Comma-separated
    description: Optional[str] = None


class BulkOperationsService:
    """Service for bulk data operations."""
    
    def __init__(self):
        self.max_batch_size = 1000
        
        # Asset type mapping for flexible input
        self.asset_type_mapping = {
            "office": "commercial_office",
            "commercial_office": "commercial_office",
            "retail": "commercial_retail",
            "commercial_retail": "commercial_retail",
            "industrial": "industrial_manufacturing",
            "industrial_manufacturing": "industrial_manufacturing",
            "logistics": "industrial_logistics",
            "industrial_logistics": "industrial_logistics",
            "data_center": "industrial_data_center",
            "industrial_data_center": "industrial_data_center",
            "hotel": "hospitality_hotel",
            "hospitality_hotel": "hospitality_hotel",
            "residential": "residential_multifamily",
            "residential_multifamily": "residential_multifamily",
            "mixed_use": "mixed_use",
            "infrastructure": "infrastructure_transport",
            "infrastructure_transport": "infrastructure_transport",
            "energy": "infrastructure_energy",
            "infrastructure_energy": "infrastructure_energy",
        }
    
    def _parse_csv(self, content: bytes) -> Tuple[List[Dict], List[str]]:
        """
        Parse CSV content into list of dictionaries.
        
        Returns:
            Tuple of (parsed_rows, header_errors)
        """
        errors = []
        rows = []
        
        try:
            # Try to decode with different encodings
            for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
                try:
                    text_content = content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                errors.append("Could not decode file. Please use UTF-8 encoding.")
                return [], errors
            
            # Parse CSV
            reader = csv.DictReader(io.StringIO(text_content))
            
            # Validate required columns
            required_columns = {'name'}
            if reader.fieldnames:
                fieldnames_lower = {f.lower().strip() for f in reader.fieldnames}
                missing = required_columns - fieldnames_lower
                if missing:
                    errors.append(f"Missing required columns: {', '.join(missing)}")
                    return [], errors
            
            # Parse rows
            for i, row in enumerate(reader, start=2):  # Start at 2 (header is 1)
                # Normalize keys to lowercase
                normalized_row = {k.lower().strip(): v.strip() if v else None for k, v in row.items()}
                normalized_row['_row_number'] = i
                rows.append(normalized_row)
            
            if not rows:
                errors.append("CSV file is empty or contains no data rows.")
                
        except Exception as e:
            errors.append(f"CSV parsing error: {str(e)}")
        
        return rows, errors
    
    def _validate_asset_row(self, row: Dict, row_num: int) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Validate a single asset row.
        
        Returns:
            Tuple of (validated_data, error_message)
        """
        try:
            # Extract and convert values
            name = row.get('name')
            if not name:
                return None, f"Row {row_num}: 'name' is required"
            
            # Asset type normalization
            asset_type = row.get('asset_type', 'commercial_office')
            if asset_type:
                asset_type = self.asset_type_mapping.get(
                    asset_type.lower().strip().replace(' ', '_'),
                    'commercial_office'
                )
            
            # Parse numeric fields
            def parse_float(val):
                if val is None or val == '':
                    return None
                try:
                    return float(str(val).replace(',', '.'))
                except ValueError:
                    return None
            
            def parse_int(val):
                if val is None or val == '':
                    return None
                try:
                    return int(float(str(val).replace(',', '.')))
                except ValueError:
                    return None
            
            # Validate coordinates
            latitude = parse_float(row.get('latitude'))
            longitude = parse_float(row.get('longitude'))
            
            if latitude is not None and (latitude < -90 or latitude > 90):
                return None, f"Row {row_num}: Invalid latitude {latitude}"
            if longitude is not None and (longitude < -180 or longitude > 180):
                return None, f"Row {row_num}: Invalid longitude {longitude}"
            
            # Parse tags
            tags = []
            tags_str = row.get('tags')
            if tags_str:
                tags = [t.strip() for t in tags_str.split(',') if t.strip()]
            
            validated = {
                'name': name.strip(),
                'asset_type': asset_type,
                'address': row.get('address'),
                'city': row.get('city'),
                'country_code': (row.get('country_code') or 'DE').upper()[:2],
                'region': row.get('region'),
                'postal_code': row.get('postal_code'),
                'latitude': latitude,
                'longitude': longitude,
                'current_valuation': parse_float(row.get('valuation')),
                'valuation_currency': (row.get('currency') or 'EUR').upper()[:3],
                'year_built': parse_int(row.get('year_built')),
                'gross_floor_area_m2': parse_float(row.get('gross_floor_area_m2') or row.get('floor_area')),
                'floors_above_ground': parse_int(row.get('floors_above_ground') or row.get('floors')),
                'tags': tags,
                'description': row.get('description'),
            }
            
            return validated, None
            
        except Exception as e:
            return None, f"Row {row_num}: Validation error - {str(e)}"
    
    def parse_assets_csv(self, content: bytes) -> Tuple[List[Dict], List[Dict]]:
        """
        Parse and validate assets from CSV.
        
        Returns:
            Tuple of (valid_assets, errors)
        """
        import time
        start_time = time.time()
        
        # Parse CSV
        rows, parse_errors = self._parse_csv(content)
        
        if parse_errors:
            return [], [{'row': 0, 'error': e} for e in parse_errors]
        
        # Validate each row
        valid_assets = []
        errors = []
        
        for row in rows:
            row_num = row.pop('_row_number', 0)
            validated, error = self._validate_asset_row(row, row_num)
            
            if error:
                errors.append({'row': row_num, 'error': error})
            elif validated:
                valid_assets.append(validated)
        
        logger.info(
            f"CSV parsing complete: {len(valid_assets)} valid, {len(errors)} errors, "
            f"{int((time.time() - start_time) * 1000)}ms"
        )
        
        return valid_assets, errors
    
    def generate_sample_csv(self) -> bytes:
        """Generate a sample CSV template for asset upload."""
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            'name', 'asset_type', 'address', 'city', 'country_code',
            'latitude', 'longitude', 'valuation', 'currency',
            'year_built', 'gross_floor_area_m2', 'floors_above_ground',
            'tags', 'description'
        ])
        
        # Sample rows
        sample_data = [
            ['Munich Office Tower', 'office', 'Marienplatz 1', 'Munich', 'DE',
             '48.1351', '11.5820', '125000000', 'EUR', '2015', '25000', '12',
             'premium,city-center', 'Class A office building in prime location'],
            ['Berlin Data Center', 'data_center', 'Alexanderplatz 5', 'Berlin', 'DE',
             '52.5200', '13.4050', '85000000', 'EUR', '2020', '15000', '3',
             'tier-3,energy-efficient', 'Modern data center facility'],
            ['Hamburg Logistics Hub', 'logistics', 'Hafenstraße 88', 'Hamburg', 'DE',
             '53.5511', '9.9937', '65000000', 'EUR', '2018', '50000', '2',
             'port,distribution', 'Large logistics warehouse near port'],
        ]
        
        for row in sample_data:
            writer.writerow(row)
        
        return output.getvalue().encode('utf-8-sig')
    
    async def validate_bulk_stress_test(
        self,
        city_ids: List[str],
        test_type: str,
        scenario_name: str,
    ) -> Tuple[bool, List[str]]:
        """
        Validate bulk stress test parameters.
        
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        if not city_ids:
            errors.append("At least one city must be specified")
        
        if len(city_ids) > 50:
            errors.append("Maximum 50 cities per bulk stress test")
        
        valid_test_types = ['flood', 'seismic', 'fire', 'financial', 'pandemic', 'climate']
        if test_type not in valid_test_types:
            errors.append(f"Invalid test type. Valid types: {', '.join(valid_test_types)}")
        
        if not scenario_name:
            errors.append("Scenario name is required")
        
        return len(errors) == 0, errors


# Global service instance
bulk_service = BulkOperationsService()
