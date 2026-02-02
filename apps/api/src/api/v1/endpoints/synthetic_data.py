"""
Synthetic Data Endpoints - NeMo Data Designer.

Provides APIs for:
- Generate synthetic stress test scenarios
- Create cascade failure examples
- Augment historical data
"""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.services.nemo_data_designer import get_nemo_data_designer_service

router = APIRouter()


# ==================== SCHEMAS ====================

class GenerateScenariosRequest(BaseModel):
    """Scenario generation request."""
    scenario_type: str = Field(..., description="Type: flood, earthquake, drought, hurricane, etc.")
    region: str = Field(..., description="Geographic region")
    count: int = Field(10, ge=1, le=100, description="Number of scenarios to generate")
    severity_range: List[float] = Field([0.5, 1.0], description="Min and max severity (0.0-1.0)")
    parameters: dict = Field(default_factory=dict, description="Additional parameters")


class CascadeGenerationRequest(BaseModel):
    """Cascade generation request."""
    trigger_type: str = Field(..., description="Trigger type: power_grid_failure, flood, etc.")
    depth: int = Field(3, ge=1, le=5, description="Cascade depth (levels)")
    count: int = Field(5, ge=1, le=50, description="Number of examples to generate")


class AugmentDataRequest(BaseModel):
    """Data augmentation request."""
    base_event: dict = Field(..., description="Base historical event")
    variations: int = Field(5, ge=1, le=20, description="Number of variations")
    variation_range: float = Field(0.2, ge=0.0, le=1.0, description="Variation range (0.2 = ±20%)")


# ==================== ENDPOINTS ====================

@router.post("/scenarios")
async def generate_scenarios(request: GenerateScenariosRequest):
    """
    Generate synthetic stress test scenarios.
    
    Creates realistic scenarios for stress testing based on templates or LLM generation.
    """
    designer = get_nemo_data_designer_service()
    
    if not designer.enabled:
        raise HTTPException(status_code=503, detail="NeMo Data Designer is disabled")
    
    try:
        result = await designer.generate_stress_test_scenarios(
            scenario_type=request.scenario_type,
            region=request.region,
            count=request.count,
            severity_range=tuple(request.severity_range),
            **request.parameters,
        )
        
        return {
            "scenarios_generated": result.scenarios_generated,
            "generation_time_ms": round(result.generation_time_ms, 2),
            "model_used": result.model_used,
            "scenarios": [
                {
                    "scenario_id": s.scenario_id,
                    "name": s.name,
                    "scenario_type": s.scenario_type,
                    "severity": s.severity,
                    "region": s.region,
                    "parameters": s.parameters,
                    "generated_at": s.generated_at,
                }
                for s in result.scenarios
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scenario generation failed: {str(e)}")


@router.post("/cascade")
async def generate_cascade_examples(request: CascadeGenerationRequest):
    """
    Generate cascade failure examples.
    
    Creates examples of cascading failures for training and analysis.
    """
    designer = get_nemo_data_designer_service()
    
    if not designer.enabled:
        raise HTTPException(status_code=503, detail="NeMo Data Designer is disabled")
    
    try:
        examples = await designer.generate_cascade_examples(
            trigger_type=request.trigger_type,
            depth=request.depth,
            count=request.count,
        )
        
        return {
            "examples_generated": len(examples),
            "examples": examples,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cascade generation failed: {str(e)}")


@router.post("/augment")
async def augment_historical_data(request: AugmentDataRequest):
    """
    Augment historical event with variations.
    
    Creates variations of a base historical event for data augmentation.
    """
    designer = get_nemo_data_designer_service()
    
    if not designer.enabled:
        raise HTTPException(status_code=503, detail="NeMo Data Designer is disabled")
    
    try:
        augmented = await designer.augment_historical_data(
            base_event=request.base_event,
            variations=request.variations,
            variation_range=request.variation_range,
        )
        
        return {
            "original_event": request.base_event,
            "variations_generated": len(augmented),
            "augmented_events": augmented,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data augmentation failed: {str(e)}")
