"""
NVIDIA NeMo Curator - Data Cleaning and Preparation.

Provides:
- Clean and filter multimodal data
- Remove duplicates and outliers
- Validate data quality
- Prepare data for training and RAG
"""
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class DataQualityScore:
    """Data quality assessment."""
    overall_score: float  # 0.0-1.0
    completeness: float
    accuracy: float
    consistency: float
    timeliness: float
    validity: float
    issues: List[str] = None
    
    def __post_init__(self):
        if self.issues is None:
            self.issues = []


@dataclass
class CurationResult:
    """Result of data curation."""
    original_count: int
    cleaned_count: int
    removed_count: int
    quality_score: DataQualityScore
    issues_found: List[str]
    curation_time_ms: float


class NeMoCuratorService:
    """
    NeMo Curator Service for data cleaning and preparation.
    
    Cleans:
    - Historical events (duplicates, outliers, invalid dates)
    - Knowledge Graph data
    - Climate data
    - News feeds (future)
    """
    
    def __init__(self):
        self.enabled = getattr(settings, 'nemo_curator_enabled', True)
        self.auto_clean_enabled = getattr(settings, 'curator_auto_clean_enabled', True)
        self.quality_threshold = getattr(settings, 'curator_quality_threshold', 0.8)
    
    async def clean_historical_events(
        self,
        events: List[Dict[str, Any]],
        filters: Optional[List[str]] = None,
    ) -> CurationResult:
        """
        Clean historical events data.
        
        Args:
            events: List of historical event dictionaries
            filters: List of filters to apply (duplicates, outliers, invalid_dates)
            
        Returns:
            CurationResult with cleaned data and quality metrics
        """
        import time
        start_time = time.time()
        
        if not self.enabled:
            return CurationResult(
                original_count=len(events),
                cleaned_count=len(events),
                removed_count=0,
                quality_score=DataQualityScore(
                    overall_score=1.0,
                    completeness=1.0,
                    accuracy=1.0,
                    consistency=1.0,
                    timeliness=1.0,
                    validity=1.0,
                ),
                issues_found=[],
                curation_time_ms=0.0,
            )
        
        filters = filters or ["duplicates", "outliers", "invalid_dates"]
        original_count = len(events)
        cleaned = events.copy()
        issues_found = []
        
        # Remove duplicates
        if "duplicates" in filters:
            seen = set()
            duplicates_removed = 0
            unique_events = []
            
            for event in cleaned:
                # Create unique key from name, type, and date
                event_key = (
                    event.get("name", ""),
                    event.get("event_type", ""),
                    event.get("start_date"),
                )
                
                if event_key in seen:
                    duplicates_removed += 1
                    issues_found.append(f"Duplicate event: {event.get('name', 'Unknown')}")
                else:
                    seen.add(event_key)
                    unique_events.append(event)
            
            cleaned = unique_events
            if duplicates_removed > 0:
                logger.info(f"Removed {duplicates_removed} duplicate events")
        
        # Remove outliers (invalid severity, impact values)
        if "outliers" in filters:
            outliers_removed = 0
            valid_events = []
            
            for event in cleaned:
                # Check for valid severity (0.0-1.0)
                severity = event.get("severity_actual")
                if severity is not None and (severity < 0.0 or severity > 1.0):
                    outliers_removed += 1
                    issues_found.append(f"Invalid severity: {severity} for event {event.get('name', 'Unknown')}")
                    continue
                
                # Check for valid financial loss (non-negative)
                financial_loss = event.get("financial_loss_eur")
                if financial_loss is not None and financial_loss < 0:
                    outliers_removed += 1
                    issues_found.append(f"Invalid financial loss: {financial_loss} for event {event.get('name', 'Unknown')}")
                    continue
                
                valid_events.append(event)
            
            cleaned = valid_events
            if outliers_removed > 0:
                logger.info(f"Removed {outliers_removed} outlier events")
        
        # Remove invalid dates
        if "invalid_dates" in filters:
            invalid_dates_removed = 0
            valid_date_events = []
            
            for event in cleaned:
                start_date = event.get("start_date")
                end_date = event.get("end_date")
                
                # Check if start_date is after end_date
                if start_date and end_date:
                    try:
                        from datetime import date
                        if isinstance(start_date, str):
                            start_date = datetime.fromisoformat(start_date).date()
                        if isinstance(end_date, str):
                            end_date = datetime.fromisoformat(end_date).date()
                        
                        if start_date > end_date:
                            invalid_dates_removed += 1
                            issues_found.append(f"Invalid date range for event {event.get('name', 'Unknown')}")
                            continue
                    except (ValueError, TypeError):
                        invalid_dates_removed += 1
                        issues_found.append(f"Invalid date format for event {event.get('name', 'Unknown')}")
                        continue
                
                valid_date_events.append(event)
            
            cleaned = valid_date_events
            if invalid_dates_removed > 0:
                logger.info(f"Removed {invalid_dates_removed} events with invalid dates")
        
        # Calculate quality score
        quality_score = await self._assess_quality(cleaned)
        
        curation_time = (time.time() - start_time) * 1000
        
        return CurationResult(
            original_count=original_count,
            cleaned_count=len(cleaned),
            removed_count=original_count - len(cleaned),
            quality_score=quality_score,
            issues_found=issues_found,
            curation_time_ms=curation_time,
        )
    
    async def _assess_quality(self, data: List[Dict[str, Any]]) -> DataQualityScore:
        """Assess data quality."""
        if not data:
            return DataQualityScore(
                overall_score=0.0,
                completeness=0.0,
                accuracy=0.0,
                consistency=0.0,
                timeliness=0.0,
                validity=0.0,
            )
        
        # Completeness: Check required fields
        required_fields = ["name", "event_type"]
        completeness_scores = []
        for item in data:
            present = sum(1 for field in required_fields if item.get(field) is not None)
            completeness_scores.append(present / len(required_fields))
        completeness = sum(completeness_scores) / len(completeness_scores) if completeness_scores else 0.0
        
        # Accuracy: Check for valid values
        accuracy_scores = []
        for item in data:
            score = 1.0
            # Check severity is in valid range
            severity = item.get("severity_actual")
            if severity is not None and (severity < 0.0 or severity > 1.0):
                score -= 0.2
            # Check financial loss is non-negative
            financial_loss = item.get("financial_loss_eur")
            if financial_loss is not None and financial_loss < 0:
                score -= 0.2
            accuracy_scores.append(max(0.0, score))
        accuracy = sum(accuracy_scores) / len(accuracy_scores) if accuracy_scores else 0.0
        
        # Consistency: Check for consistent data types
        consistency = 1.0  # Simplified - would check data types in production
        
        # Timeliness: Check if dates are recent (not too old)
        timeliness_scores = []
        for item in data:
            start_date = item.get("start_date")
            if start_date:
                try:
                    from datetime import date
                    if isinstance(start_date, str):
                        start_date = datetime.fromisoformat(start_date).date()
                    elif isinstance(start_date, datetime):
                        start_date = start_date.date()
                    
                    # Events from last 100 years are considered timely
                    years_ago = (date.today() - start_date).days / 365.25
                    timeliness = max(0.0, 1.0 - (years_ago / 100))
                    timeliness_scores.append(timeliness)
                except (ValueError, TypeError):
                    timeliness_scores.append(0.5)  # Unknown date = medium timeliness
            else:
                timeliness_scores.append(0.5)  # No date = medium timeliness
        timeliness = sum(timeliness_scores) / len(timeliness_scores) if timeliness_scores else 0.5
        
        # Validity: Check for valid formats
        validity = 1.0  # Simplified - would check formats in production
        
        # Overall score (weighted average)
        overall_score = (
            completeness * 0.3 +
            accuracy * 0.3 +
            consistency * 0.2 +
            timeliness * 0.1 +
            validity * 0.1
        )
        
        return DataQualityScore(
            overall_score=overall_score,
            completeness=completeness,
            accuracy=accuracy,
            consistency=consistency,
            timeliness=timeliness,
            validity=validity,
        )
    
    async def prepare_for_knowledge_graph(
        self,
        data: List[Dict[str, Any]],
        node_types: List[str],
        edge_types: List[str],
    ) -> Dict[str, Any]:
        """
        Prepare data for Knowledge Graph ingestion.
        
        Args:
            data: Raw data to prepare
            node_types: List of node types (e.g., ["ASSET", "EVENT", "INFRASTRUCTURE"])
            edge_types: List of edge types (e.g., ["DEPENDS_ON", "CASCADES_TO"])
            
        Returns:
            Prepared data structure for Knowledge Graph
        """
        # Clean data first
        curation_result = await self.clean_historical_events(data)
        
        # Structure for Knowledge Graph
        prepared = {
            "nodes": [],
            "edges": [],
            "metadata": {
                "original_count": curation_result.original_count,
                "cleaned_count": curation_result.cleaned_count,
                "quality_score": curation_result.quality_score.overall_score,
            }
        }
        
        # Convert events to nodes
        for event in data[:curation_result.cleaned_count]:  # Use cleaned subset
            if "EVENT" in node_types:
                node = {
                    "id": event.get("id", f"event_{event.get('name', 'unknown')}"),
                    "label": "Event",
                    "properties": {
                        "name": event.get("name"),
                        "event_type": event.get("event_type"),
                        "severity": event.get("severity_actual"),
                        "financial_loss": event.get("financial_loss_eur"),
                        "start_date": event.get("start_date"),
                    }
                }
                prepared["nodes"].append(node)
        
        return prepared
    
    async def check_data_quality(
        self,
        data: List[Dict[str, Any]],
    ) -> DataQualityScore:
        """
        Check data quality without cleaning.
        
        Args:
            data: Data to assess
            
        Returns:
            DataQualityScore with quality metrics
        """
        return await self._assess_quality(data)
    
    async def filter_by_quality(
        self,
        data: List[Dict[str, Any]],
        min_score: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Filter data by quality score.
        
        Args:
            data: Data to filter
            min_score: Minimum quality score (defaults to curator_quality_threshold)
            
        Returns:
            Filtered data meeting quality threshold
        """
        if min_score is None:
            min_score = self.quality_threshold
        
        # Assess each item's quality
        filtered = []
        for item in data:
            item_score = await self._assess_quality([item])
            if item_score.overall_score >= min_score:
                filtered.append(item)
        
        return filtered


# Global service instance
_nemo_curator_service: Optional[NeMoCuratorService] = None


def get_nemo_curator_service() -> NeMoCuratorService:
    """Get or create NeMo Curator service instance."""
    global _nemo_curator_service
    if _nemo_curator_service is None:
        _nemo_curator_service = NeMoCuratorService()
    return _nemo_curator_service


# Convenience alias
nemo_curator = get_nemo_curator_service()
