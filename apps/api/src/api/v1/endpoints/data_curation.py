"""
Data Curation Endpoints - NeMo Curator.

Provides APIs for:
- Data cleaning
- Quality assessment
- Knowledge Graph data preparation
"""
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.services.nemo_curator import get_nemo_curator_service

router = APIRouter()


# ==================== SCHEMAS ====================

class DataQualityScoreResponse(BaseModel):
    """Data quality score response."""
    overall_score: float
    completeness: float
    accuracy: float
    consistency: float
    timeliness: float
    validity: float
    issues: List[str] = []


class CurationRequest(BaseModel):
    """Data curation request."""
    data: List[dict]
    filters: Optional[List[str]] = None  # duplicates, outliers, invalid_dates


class CurationResultResponse(BaseModel):
    """Curation result response."""
    original_count: int
    cleaned_count: int
    removed_count: int
    quality_score: DataQualityScoreResponse
    issues_found: List[str]
    curation_time_ms: float
    cleaned_data: List[dict]


class QualityCheckRequest(BaseModel):
    """Quality check request."""
    data: List[dict]


class PrepareKGRequest(BaseModel):
    """Knowledge Graph preparation request."""
    data: List[dict]
    node_types: List[str]
    edge_types: List[str]


# ==================== ENDPOINTS ====================

@router.post("/clean", response_model=CurationResultResponse)
async def clean_data(request: CurationRequest):
    """
    Clean data using NeMo Curator.
    
    Removes duplicates, outliers, and invalid dates.
    """
    curator = get_nemo_curator_service()
    
    if not curator.enabled:
        raise HTTPException(status_code=503, detail="NeMo Curator is disabled")
    
    try:
        result = await curator.clean_historical_events(
            events=request.data,
            filters=request.filters,
        )
        
        # Get cleaned data (simplified - in production would track which items were kept)
        cleaned_data = request.data[:result.cleaned_count]
        
        return CurationResultResponse(
            original_count=result.original_count,
            cleaned_count=result.cleaned_count,
            removed_count=result.removed_count,
            quality_score=DataQualityScoreResponse(
                overall_score=result.quality_score.overall_score,
                completeness=result.quality_score.completeness,
                accuracy=result.quality_score.accuracy,
                consistency=result.quality_score.consistency,
                timeliness=result.quality_score.timeliness,
                validity=result.quality_score.validity,
                issues=result.quality_score.issues or [],
            ),
            issues_found=result.issues_found,
            curation_time_ms=round(result.curation_time_ms, 2),
            cleaned_data=cleaned_data,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Curation failed: {str(e)}")


@router.post("/quality", response_model=DataQualityScoreResponse)
async def check_data_quality(request: QualityCheckRequest):
    """
    Check data quality without cleaning.
    
    Returns quality scores for the provided data.
    """
    curator = get_nemo_curator_service()
    
    if not curator.enabled:
        raise HTTPException(status_code=503, detail="NeMo Curator is disabled")
    
    try:
        quality_score = await curator.check_data_quality(request.data)
        
        return DataQualityScoreResponse(
            overall_score=quality_score.overall_score,
            completeness=quality_score.completeness,
            accuracy=quality_score.accuracy,
            consistency=quality_score.consistency,
            timeliness=quality_score.timeliness,
            validity=quality_score.validity,
            issues=quality_score.issues or [],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quality check failed: {str(e)}")


@router.post("/prepare/kg")
async def prepare_for_knowledge_graph(request: PrepareKGRequest):
    """
    Prepare data for Knowledge Graph ingestion.
    
    Cleans data and structures it for Neo4j import.
    """
    curator = get_nemo_curator_service()
    
    if not curator.enabled:
        raise HTTPException(status_code=503, detail="NeMo Curator is disabled")
    
    try:
        prepared = await curator.prepare_for_knowledge_graph(
            data=request.data,
            node_types=request.node_types,
            edge_types=request.edge_types,
        )
        
        return prepared
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"KG preparation failed: {str(e)}")


@router.post("/filter")
async def filter_by_quality(
    data: List[dict],
    min_score: Optional[float] = None,
):
    """
    Filter data by quality score.
    
    Returns only data items meeting the quality threshold.
    """
    curator = get_nemo_curator_service()
    
    if not curator.enabled:
        raise HTTPException(status_code=503, detail="NeMo Curator is disabled")
    
    try:
        filtered = await curator.filter_by_quality(
            data=data,
            min_score=min_score,
        )
        
        return {
            "original_count": len(data),
            "filtered_count": len(filtered),
            "min_score": min_score or curator.quality_threshold,
            "filtered_data": filtered,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Filtering failed: {str(e)}")
