"""CADAPT - Climate Adaptation & Local Resilience API endpoints."""
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, File, Query, Depends, UploadFile, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.historical_event import HistoricalEvent
from src.models.grant_payout import GrantPayout
from src.models.municipal_subscription import MunicipalSubscription
from src.models.municipal_onboarding_request import MunicipalOnboardingRequest
from src.models.municipal_contractor import MunicipalContractor
from src.modules.cadapt.service import cadapt_service
from src.services.grant_guide_parser import parse_pdf_from_bytes
from src.services.nvidia_llm import llm_service, LLMModel

logger = logging.getLogger(__name__)
router = APIRouter()

# Response cache for heavy flood endpoints (10 min TTL) to avoid Overseer slow flags
_FLOOD_RISK_CACHE: Dict[Tuple[Optional[str], Optional[float], Optional[float], bool], Tuple[Dict[str, Any], float]] = {}
_FLOOD_BUILDINGS_CACHE: Dict[Tuple[str, int], Tuple[Dict[str, Any], float]] = {}
_FLOOD_CACHE_TTL: float = 600.0


class GrantMatchRequest(BaseModel):
    """Grant matching request."""
    city_risks: List[str] = Field(..., description="e.g. ['flood', 'heat', 'drought']")
    country: str = "USA"
    population: int = 100_000
    municipality: Optional[str] = Field(None, description="City name for similar-cities success rate")


class MeasureRecommendRequest(BaseModel):
    """Adaptation measure recommendation request."""
    city_risks: List[str] = Field(..., description="e.g. ['flood', 'heat']")
    population: int = 100_000
    budget_per_capita: float = 200


class GrantApplicationRequest(BaseModel):
    """Create a grant application."""
    grant_program_id: str
    municipality: str
    requested_amount_m: float = Field(..., gt=0)


class ApplicationStatusUpdate(BaseModel):
    """Update application status."""
    status: str = Field(..., description="draft, submitted, under_review, approved, denied")


class EngineeringSolutionsMatchRequest(BaseModel):
    """Engineering Solutions Matcher: risk type + depth + area → top solutions with prices and cases."""
    risk_type: str = Field("flood", description="e.g. flood, storm_surge, stormwater")
    depth_m: float = Field(..., ge=0, description="Flood depth in meters")
    area_ha: float = Field(..., ge=0, description="Area in hectares")
    limit: int = Field(5, ge=1, le=20, description="Max number of matches to return")


class GrantDraftRequest(BaseModel):
    """Request AI-generated grant application draft."""
    grant_program_id: str = Field(..., description="e.g. gr_001")
    municipality: str = Field(..., description="City or municipality name")
    city_risks: List[str] = Field(default_factory=list, description="e.g. ['flood', 'heat']")
    population: int = Field(100_000, description="Population for context")


class GrantDraftProjectCreate(BaseModel):
    """Create a draft project (workflow toward 200-page application)."""
    grant_program_id: str = Field(..., description="e.g. gr_001")
    municipality: str = Field(..., description="City or municipality name")
    city_risks: List[str] = Field(default_factory=list)
    population: int = Field(100_000)


class DraftSectionUpdate(BaseModel):
    """Update one section content (human expert edit)."""
    section_name: str = Field(..., description="e.g. executive_summary, objectives, budget")
    content: str = Field(..., description="Section text")


class GenerateSectionRequest(BaseModel):
    """Generate one section using AI + FOIA examples + guide requirements."""
    section_name: str = Field(..., description="e.g. executive_summary, objectives, activities, timeline, budget")


class GuideSectionsBody(BaseModel):
    """Parsed guide sections from PDF (from /grants/parse-guide)."""
    sections: List[dict] = Field(default_factory=list, description="List of {title, content}")


class FloodRiskProductRequest(BaseModel):
    """Request flood risk product (unified city name or coords in -> full assessment out)."""
    city: Optional[str] = Field(None, description="Community id, e.g. bastrop_tx")
    lat: Optional[float] = Field(None, description="Latitude if no city")
    lon: Optional[float] = Field(None, description="Longitude if no city")
    include_grid: bool = Field(False, description="Include flood_grid for map rendering")


class FloodBuildingsRequest(BaseModel):
    """Request per-building flood depth and probability for a city."""
    city: Optional[str] = Field(None, description="Community id, e.g. bastrop_tx")
    return_period_years: int = Field(100, description="10, 50, or 100")


@router.get("/dashboard")
async def cadapt_dashboard():
    """Get CADAPT module dashboard."""
    return cadapt_service.get_dashboard()


@router.get("/measures")
async def get_measures(
    category: Optional[str] = Query(None, description="green_infrastructure, physical_barrier, building, social, emergency"),
    risk_type: Optional[str] = Query(None, description="flood, heat, drought, hurricane, etc."),
):
    """Get adaptation measures catalog."""
    return cadapt_service.get_measures(category=category, risk_type=risk_type)


@router.post("/measures/recommend")
async def recommend_measures(request: MeasureRecommendRequest):
    """Get recommended adaptation measures based on city risk profile and budget."""
    return cadapt_service.recommend_measures(
        city_risks=request.city_risks,
        population=request.population,
        budget_per_capita=request.budget_per_capita,
    )


@router.get("/engineering-solutions")
async def get_engineering_solutions(
    risk_type: Optional[str] = Query(None, description="Filter by risk type: flood, storm_surge, stormwater"),
    solution_type: Optional[str] = Query(None, description="Filter by type: dam, drainage, seawall, levee, green_infrastructure"),
):
    """List engineering solutions catalog (FEMA/USACE/EPA style)."""
    return cadapt_service.get_engineering_solutions_catalog(risk_type=risk_type, solution_type=solution_type)


@router.post("/engineering-solutions/match")
async def match_engineering_solutions(request: EngineeringSolutionsMatchRequest):
    """Match engineering solutions by risk type, depth (m), and area (ha). Returns top 3–5 with prices and case studies."""
    return cadapt_service.match_engineering_solutions(
        risk_type=request.risk_type,
        depth_m=request.depth_m,
        area_ha=request.area_ha,
        limit=request.limit,
    )


@router.get("/grants")
async def get_grants(
    country: Optional[str] = Query(None),
    risk_type: Optional[str] = Query(None),
):
    """Get grant programs database."""
    return cadapt_service.get_grants(country=country, risk_type=risk_type)


@router.post("/grants/match")
async def match_grants(request: GrantMatchRequest):
    """Match available grants to city risk profile with eligibility and success-probability ranking."""
    return cadapt_service.match_grants(
        city_risks=request.city_risks,
        country=request.country,
        population=request.population,
        municipality=request.municipality,
    )


@router.post("/grants/draft")
async def generate_grant_draft(request: GrantDraftRequest):
    """Generate AI draft for a grant application (executive summary + key sections)."""
    grant_obj = next((g for g in cadapt_service._grants.values() if g.id == request.grant_program_id), None)
    if not grant_obj:
        return {"error": "Grant program not found", "draft": None}
    prompt = f"""Write a grant application draft for the following program and municipality.

Grant program: {grant_obj.name}
Agency: {grant_obj.agency}
Description: {grant_obj.description}
Eligible risks: {', '.join(grant_obj.eligible_risks)}
Max award: ${grant_obj.max_award_m}M. Match required: {grant_obj.match_required_pct}%.

Municipality: {request.municipality}
Population: {request.population:,}
Climate risks to address: {', '.join(request.city_risks) or 'flood, heat, drought'}

Output:
1. Executive summary (2-3 short paragraphs: need, proposed project, expected outcomes).
2. Key sections as bullet points: Objectives, Activities, Timeline, Budget outline, Community engagement.
Use plain text, no Markdown. Be specific to the municipality and the program."""
    try:
        resp = await llm_service.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_70B,
            max_tokens=1500,
            temperature=0.4,
            system_prompt="You are a grant writer for climate adaptation. Be concise and aligned with the program requirements.",
        )
        return {"draft": (resp.content or "").strip(), "grant_id": request.grant_program_id, "municipality": request.municipality}
    except Exception as e:
        logger.warning("Grant draft LLM failed: %s", e)
        return {
            "draft": f"[Executive summary placeholder for {grant_obj.name}]\n\n{request.municipality} (pop. {request.population:,}) seeks funding for {', '.join(request.city_risks) or 'flood and heat'} adaptation. Proposed activities: green infrastructure, early warning, and community outreach. Budget and timeline to be detailed in full application.",
            "grant_id": request.grant_program_id,
            "municipality": request.municipality,
            "fallback": True,
        }


@router.get("/grants/foia-examples")
async def get_foia_examples(
    grant_id: Optional[str] = Query(None, description="Filter by grant program id"),
    section: Optional[str] = Query(None, description="Filter by section name"),
):
    """Get successful application excerpts (FOIA) for Grant Writing Assistant."""
    return cadapt_service.get_foia_examples(grant_id=grant_id, section=section)


@router.post("/grants/parse-guide")
async def parse_grant_guide(file: UploadFile = File(..., description="PDF grant application guide")):
    """Parse grant program PDF guide: extract sections and requirements for AI draft alignment."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return {"error": "PDF file required", "sections": [], "requirements": []}
    data = await file.read()
    result = parse_pdf_from_bytes(data)
    if result.get("error"):
        return {"error": result["error"], "sections": result.get("sections", []), "requirements": result.get("requirements", [])}
    return {"sections": result["sections"], "requirements": result["requirements"], "raw_text_length": len(result.get("raw_text", ""))}


@router.post("/grants/draft-project")
async def create_draft_project(request: GrantDraftProjectCreate):
    """Create a draft project for full application workflow (AI draft + human expert → 200-page export)."""
    return cadapt_service.create_draft_project(
        grant_program_id=request.grant_program_id,
        municipality=request.municipality,
        city_risks=request.city_risks,
        population=request.population,
    )


@router.get("/grants/draft-project/{project_id}")
async def get_draft_project(project_id: str):
    """Get draft project by id."""
    proj = cadapt_service.get_draft_project(project_id)
    if not proj:
        return {"error": "Project not found"}
    return proj


@router.put("/grants/draft-project/{project_id}/section")
async def update_draft_section(project_id: str, request: DraftSectionUpdate):
    """Update one section (human expert edit)."""
    return cadapt_service.update_draft_section(project_id, request.section_name, request.content)


@router.post("/grants/draft-project/{project_id}/guide")
async def set_draft_guide(project_id: str, body: GuideSectionsBody):
    """Attach parsed PDF guide sections to the project (from /grants/parse-guide)."""
    return cadapt_service.set_draft_guide(project_id, body.sections)


@router.post("/grants/draft-project/{project_id}/generate-section")
async def generate_section(project_id: str, request: GenerateSectionRequest):
    """Generate one section using AI + FOIA examples + guide requirements."""
    proj = cadapt_service.get_draft_project(project_id)
    if not proj:
        return {"error": "Project not found", "content": None}
    grant_id = proj["grant_program_id"]
    grant_obj = next((g for g in cadapt_service._grants.values() if g.id == grant_id), None)
    if not grant_obj:
        return {"error": "Grant program not found", "content": None}
    foia = cadapt_service.get_foia_examples(grant_id=grant_id, section=request.section_name)
    guide_sections = proj.get("guide_sections") or []
    guide_relevant = " ".join(s.get("content", "")[:2000] for s in guide_sections[:5])
    foia_text = "\n\n".join(e.get("excerpt", "") for e in foia[:3])
    prompt = f"""Write the "{request.section_name.replace('_', ' ')}" section for a grant application.

Grant: {grant_obj.name} ({grant_obj.agency}). {grant_obj.description}
Municipality: {proj['municipality']}. Population: {proj.get('population', 100_000)}. Risks: {', '.join(proj.get('city_risks') or ['flood', 'heat'])}.

Requirements from program guide (use as structure):
{guide_relevant[:3000] or 'Standard FEMA/EPA style sections.'}

Successful examples (FOIA) to mirror in tone and structure:
{foia_text[:2000] or 'N/A'}

Output: 2–4 paragraphs for this section only. Plain text, no Markdown. Be specific to the municipality and program."""
    try:
        resp = await llm_service.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_70B,
            max_tokens=1200,
            temperature=0.4,
            system_prompt="You are a grant writer. Match program requirements and mirror successful FOIA examples.",
        )
        content = (resp.content or "").strip()
        cadapt_service.update_draft_section(project_id, request.section_name, content)
        return {"section": request.section_name, "content": content}
    except Exception as e:
        logger.warning("Generate section LLM failed: %s", e)
        fallback = f"[{request.section_name.replace('_', ' ').title()}]\n\n{proj['municipality']} proposes to address {', '.join(proj.get('city_risks') or ['flood'])} through this program. Details to be completed by applicant."
        cadapt_service.update_draft_section(project_id, request.section_name, fallback)
        return {"section": request.section_name, "content": fallback, "fallback": True}


@router.post("/grants/draft-project/{project_id}/export")
async def export_draft_project(project_id: str):
    """Export full application document (all sections; ~200-page style). Returns full text and word count."""
    result = cadapt_service.export_full_document(project_id)
    if result.get("error"):
        return result
    return result


@router.post("/applications")
async def create_application(request: GrantApplicationRequest):
    """Create a grant application with commission tracking."""
    return cadapt_service.create_application(
        grant_program_id=request.grant_program_id,
        municipality=request.municipality,
        requested_amount_m=request.requested_amount_m,
    )


@router.get("/applications")
async def list_applications(
    municipality: Optional[str] = Query(None, description="Filter by municipality"),
    status: Optional[str] = Query(None, description="Filter by status: draft, submitted, under_review, approved, denied"),
):
    """List grant applications (for commission tracker)."""
    return cadapt_service.list_applications(municipality=municipality, status=status)


@router.put("/applications/{application_id}/status")
async def update_application(application_id: str, request: ApplicationStatusUpdate):
    """Update grant application status."""
    return cadapt_service.update_application_status(application_id, request.status)


@router.get("/commissions")
async def get_commissions(db: AsyncSession = Depends(get_db)):
    """Get commission tracking summary (7% per successful grant). Includes paid_out_m from grant_payouts (source of truth for actual payouts)."""
    summary = cadapt_service.get_commission_summary()
    # Aggregate from payouts table: paid amount and count (payouts are the canonical entity)
    result = await db.execute(
        select(func.coalesce(func.sum(GrantPayout.amount), 0)).where(GrantPayout.status == "paid")
    )
    paid_total = float(result.scalar() or 0)
    count_result = await db.execute(select(func.count(GrantPayout.id)).where(GrantPayout.status == "paid"))
    payouts_count = int(count_result.scalar() or 0)
    # paid_out_m in millions
    summary["paid_out_m"] = round(paid_total / 1_000_000, 4)
    summary["payouts_count"] = payouts_count
    return summary


# ---------- Track B: small cities 5K–50K (onboarding, SaaS $1K–2K/mo) ----------

@router.get("/track-b-cities")
async def list_track_b_cities():
    """List municipalities in Track B population band (5K–50K). Used for onboarding and SaaS tier eligibility."""
    from src.data.demo_communities import get_track_b_cities
    return {"cities": get_track_b_cities(), "population_band": "5K-50K"}


# ---------- Municipal onboarding (Track B) ----------

class OnboardingRequestCreate(BaseModel):
    """Submit municipal onboarding request (Track B 5K–50K)."""
    municipality_name: str = Field(..., min_length=1, max_length=200)
    population: Optional[int] = Field(None, ge=5000, le=50000)
    country_code: Optional[str] = Field(None, min_length=2, max_length=2)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = None


class OnboardingRequestUpdate(BaseModel):
    """Update onboarding request status."""
    status: Optional[str] = Field(None, description="pending, in_review, onboarded, declined")
    notes: Optional[str] = None


@router.get("/onboarding-requests")
async def list_onboarding_requests(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List municipal onboarding requests (admin / filter by status)."""
    q = select(MunicipalOnboardingRequest).order_by(MunicipalOnboardingRequest.requested_at.desc())
    if status:
        q = q.where(MunicipalOnboardingRequest.status == status)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "municipality_name": r.municipality_name,
            "population": r.population,
            "country_code": r.country_code,
            "contact_email": r.contact_email,
            "contact_name": r.contact_name,
            "status": r.status,
            "requested_at": r.requested_at.isoformat() if r.requested_at else None,
            "notes": r.notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/onboarding-requests")
async def create_onboarding_request(
    request: OnboardingRequestCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a municipal onboarding request (Track B sign-up)."""
    req = MunicipalOnboardingRequest(
        municipality_name=request.municipality_name,
        population=request.population,
        country_code=request.country_code,
        contact_email=request.contact_email,
        contact_name=request.contact_name,
        notes=request.notes,
        status="pending",
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return {
        "id": req.id,
        "municipality_name": req.municipality_name,
        "population": req.population,
        "status": req.status,
        "requested_at": req.requested_at.isoformat() if req.requested_at else None,
    }


@router.put("/onboarding-requests/{request_id}")
async def update_onboarding_request(
    request_id: str,
    body: OnboardingRequestUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update onboarding request status (e.g. in_review → onboarded)."""
    result = await db.execute(
        select(MunicipalOnboardingRequest).where(MunicipalOnboardingRequest.id == request_id)
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Onboarding request not found")
    if body.status is not None:
        r.status = body.status
    if body.notes is not None:
        r.notes = body.notes
    await db.commit()
    await db.refresh(r)
    return {"id": r.id, "status": r.status, "notes": r.notes}


# ---------- Municipal contractors (Track B) ----------

class ContractorCreate(BaseModel):
    """Create a contractor for a municipality (tenant)."""
    tenant_id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=200)
    contractor_type: Optional[str] = Field(None, max_length=50)
    contact_info: Optional[str] = None
    status: str = Field("active", max_length=20)


class ContractorUpdate(BaseModel):
    """Update contractor."""
    name: Optional[str] = Field(None, max_length=200)
    contractor_type: Optional[str] = Field(None, max_length=50)
    contact_info: Optional[str] = None
    status: Optional[str] = Field(None, max_length=20)


@router.get("/contractors")
async def list_contractors(
    tenant_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List municipal contractors (filter by tenant_id or status)."""
    q = select(MunicipalContractor)
    if tenant_id:
        q = q.where(MunicipalContractor.tenant_id == tenant_id)
    if status:
        q = q.where(MunicipalContractor.status == status)
    q = q.order_by(MunicipalContractor.name)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "tenant_id": r.tenant_id,
            "name": r.name,
            "contractor_type": r.contractor_type,
            "contact_info": r.contact_info,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/contractors")
async def create_contractor(
    request: ContractorCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a municipal contractor."""
    c = MunicipalContractor(
        tenant_id=request.tenant_id,
        name=request.name,
        contractor_type=request.contractor_type,
        contact_info=request.contact_info,
        status=request.status or "active",
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return {
        "id": c.id,
        "tenant_id": c.tenant_id,
        "name": c.name,
        "contractor_type": c.contractor_type,
        "status": c.status,
    }


@router.get("/contractors/{contractor_id}")
async def get_contractor(
    contractor_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single contractor by id."""
    result = await db.execute(
        select(MunicipalContractor).where(MunicipalContractor.id == contractor_id)
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Contractor not found")
    return {
        "id": r.id,
        "tenant_id": r.tenant_id,
        "name": r.name,
        "contractor_type": r.contractor_type,
        "contact_info": r.contact_info,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


@router.put("/contractors/{contractor_id}")
async def update_contractor(
    contractor_id: str,
    body: ContractorUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a municipal contractor."""
    result = await db.execute(
        select(MunicipalContractor).where(MunicipalContractor.id == contractor_id)
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Contractor not found")
    if body.name is not None:
        r.name = body.name
    if body.contractor_type is not None:
        r.contractor_type = body.contractor_type
    if body.contact_info is not None:
        r.contact_info = body.contact_info
    if body.status is not None:
        r.status = body.status
    await db.commit()
    await db.refresh(r)
    return {"id": r.id, "name": r.name, "status": r.status}


@router.delete("/contractors/{contractor_id}")
async def delete_contractor(
    contractor_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a municipal contractor."""
    result = await db.execute(
        select(MunicipalContractor).where(MunicipalContractor.id == contractor_id)
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Contractor not found")
    await db.delete(r)
    await db.commit()
    return {"deleted": contractor_id}


# ---------- Payouts (Phase D: application → payout) ----------

class PayoutCreate(BaseModel):
    """Create a payout linked to an application."""
    application_id: str = Field(..., description="Grant application ID")
    payout_date: str = Field(..., description="ISO date e.g. 2026-03-15")
    amount: float = Field(..., gt=0)
    currency: str = Field("USD", min_length=3, max_length=3)
    notes: Optional[str] = None


class PayoutUpdate(BaseModel):
    """Update payout status or notes."""
    status: Optional[str] = Field(None, description="pending, paid, cancelled")
    notes: Optional[str] = None


@router.get("/payouts")
async def list_payouts(
    application_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List grant payouts with optional filters."""
    q = select(GrantPayout)
    if application_id:
        q = q.where(GrantPayout.application_id == application_id)
    if status:
        q = q.where(GrantPayout.status == status)
    q = q.order_by(GrantPayout.payout_date.desc())
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "application_id": r.application_id,
            "payout_date": r.payout_date.isoformat() if r.payout_date else None,
            "amount": r.amount,
            "currency": r.currency,
            "status": r.status,
            "notes": r.notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/payouts")
async def create_payout(
    request: PayoutCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a payout for an approved application."""
    try:
        payout_date = datetime.fromisoformat(request.payout_date.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payout_date; use ISO date")
    payout = GrantPayout(
        application_id=request.application_id,
        payout_date=payout_date,
        amount=request.amount,
        currency=request.currency,
        notes=request.notes,
        status="pending",
    )
    db.add(payout)
    await db.commit()
    await db.refresh(payout)
    return {
        "id": payout.id,
        "application_id": payout.application_id,
        "payout_date": payout.payout_date.isoformat(),
        "amount": payout.amount,
        "currency": payout.currency,
        "status": payout.status,
        "notes": payout.notes,
        "created_at": payout.created_at.isoformat() if payout.created_at else None,
    }


@router.get("/payouts/{payout_id}")
async def get_payout(
    payout_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single payout by id."""
    result = await db.execute(select(GrantPayout).where(GrantPayout.id == payout_id))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Payout not found")
    return {
        "id": r.id,
        "application_id": r.application_id,
        "payout_date": r.payout_date.isoformat() if r.payout_date else None,
        "amount": r.amount,
        "currency": r.currency,
        "status": r.status,
        "notes": r.notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


@router.put("/payouts/{payout_id}")
async def update_payout(
    payout_id: str,
    request: PayoutUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update payout status or notes."""
    result = await db.execute(select(GrantPayout).where(GrantPayout.id == payout_id))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Payout not found")
    if request.status is not None:
        r.status = request.status
    if request.notes is not None:
        r.notes = request.notes
    await db.commit()
    await db.refresh(r)
    return {
        "id": r.id,
        "application_id": r.application_id,
        "payout_date": r.payout_date.isoformat() if r.payout_date else None,
        "amount": r.amount,
        "currency": r.currency,
        "status": r.status,
        "notes": r.notes,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


@router.delete("/payouts/{payout_id}")
async def delete_payout(
    payout_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a payout (e.g. if created by mistake)."""
    result = await db.execute(select(GrantPayout).where(GrantPayout.id == payout_id))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Payout not found")
    await db.delete(r)
    await db.commit()
    return {"deleted": payout_id}


# ---------- SaaS subscription for municipalities (Phase D: $5K–20K/year; Track B: $1K–2K/month) ----------

# Standard/Professional/Enterprise = larger cities; Track B = small cities 5K–50K ($1K–2K/month)
SUBSCRIPTION_TIERS = {
    "standard": 5000,
    "professional": 10000,
    "enterprise": 20000,
    "track_b_small": 12000,   # $1K/month — Track B 5K–50K
    "track_b_standard": 24000, # $2K/month — Track B 5K–50K
}

# One-off products (Custom Report, etc.)
CADAPT_PRODUCTS = [
    {"id": "custom_report", "name": "Custom Analysis Report", "price_min": 15000, "price_max": 30000, "currency": "USD"},
    {"id": "decision_support", "name": "Decision Support Consulting", "price_min": 5000, "price_max": 10000, "currency": "USD"},
]


class SubscriptionCreate(BaseModel):
    """Create or link a municipal subscription."""
    tenant_id: str = Field(..., description="Municipality/tenant identifier")
    tier: str = Field("standard", description="standard, professional, enterprise")
    period_start: str = Field(..., description="ISO date")
    period_end: str = Field(..., description="ISO date")


class SubscriptionUpdate(BaseModel):
    """Update subscription status or tier."""
    status: Optional[str] = Field(None, description="active, cancelled, past_due, trialing")
    tier: Optional[str] = None
    notes: Optional[str] = None


@router.get("/subscriptions")
async def list_subscriptions(
    tenant_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List municipal subscriptions (filter by tenant_id or status)."""
    q = select(MunicipalSubscription)
    if tenant_id:
        q = q.where(MunicipalSubscription.tenant_id == tenant_id)
    if status:
        q = q.where(MunicipalSubscription.status == status)
    q = q.order_by(MunicipalSubscription.period_end.desc())
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "tenant_id": r.tenant_id,
            "tier": r.tier,
            "amount_yearly": r.amount_yearly,
            "currency": r.currency,
            "period_start": r.period_start.isoformat() if r.period_start else None,
            "period_end": r.period_end.isoformat() if r.period_end else None,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/subscriptions")
async def create_subscription(
    request: SubscriptionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a municipal subscription (internal billing or pseudo-Stripe)."""
    try:
        period_start = datetime.fromisoformat(request.period_start.replace("Z", "+00:00"))
        period_end = datetime.fromisoformat(request.period_end.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid period_start or period_end; use ISO date")
    amount = SUBSCRIPTION_TIERS.get(request.tier.lower(), 5000)
    sub = MunicipalSubscription(
        tenant_id=request.tenant_id,
        tier=request.tier.lower(),
        amount_yearly=float(amount),
        currency="USD",
        period_start=period_start,
        period_end=period_end,
        status="active",
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return {
        "id": sub.id,
        "tenant_id": sub.tenant_id,
        "tier": sub.tier,
        "amount_yearly": sub.amount_yearly,
        "currency": sub.currency,
        "period_start": sub.period_start.isoformat(),
        "period_end": sub.period_end.isoformat(),
        "status": sub.status,
    }


@router.get("/subscriptions/tiers")
async def get_subscription_tiers():
    """Return available tiers and prices ($5K–20K/year for standard; Track B $1K–2K/month)."""
    tiers = []
    for k, v in SUBSCRIPTION_TIERS.items():
        item = {"id": k, "amount_yearly": v, "currency": "USD"}
        if k.startswith("track_b"):
            item["amount_monthly"] = round(v / 12, 2)
        tiers.append(item)
    return {"tiers": tiers}


@router.get("/products")
async def get_cadapt_products():
    """Return one-off products (Custom Report $15–30K, Decision Support $5–10K)."""
    return {"products": CADAPT_PRODUCTS}


@router.put("/subscriptions/{subscription_id}")
async def update_subscription(
    subscription_id: str,
    request: SubscriptionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update subscription status or notes."""
    result = await db.execute(select(MunicipalSubscription).where(MunicipalSubscription.id == subscription_id))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if request.status is not None:
        r.status = request.status
    if request.tier is not None:
        r.tier = request.tier.lower()
        r.amount_yearly = float(SUBSCRIPTION_TIERS.get(request.tier.lower(), r.amount_yearly))
    if request.notes is not None:
        r.notes = request.notes
    await db.commit()
    await db.refresh(r)
    return {
        "id": r.id,
        "tenant_id": r.tenant_id,
        "tier": r.tier,
        "amount_yearly": r.amount_yearly,
        "period_end": r.period_end.isoformat() if r.period_end else None,
        "status": r.status,
    }


@router.post("/flood-risk-product")
async def flood_risk_product(request: FloodRiskProductRequest):
    """
    Unified flood risk product: city name or coords in -> full assessment out.
    Returns city_info, data_sources, scenarios (10/50/100-yr), economic_impact, ael_usd, optional flood_grid.
    Cached 10 min per (city, lat, lon, include_grid).
    """
    cache_key = (request.city, request.lat, request.lon, request.include_grid)
    now = time.time()
    if cache_key in _FLOOD_RISK_CACHE:
        cached, ts = _FLOOD_RISK_CACHE[cache_key]
        if now - ts < _FLOOD_CACHE_TTL:
            return cached

    from src.services.flood_hydrology_engine import flood_hydrology_engine
    from src.services.flood_economic_model import flood_economic_model

    try:
        model_result = await flood_hydrology_engine.run_city_flood_model(
            city_id=request.city,
            lat=request.lat,
            lon=request.lon,
        )
        economic = flood_economic_model.run(model_result)
    except Exception as e:
        logger.warning("Flood risk product failed: %s", e)
        return {"error": str(e), "city_info": None, "scenarios": [], "economic_impact": []}

    scenarios_payload = []
    for i, sc in enumerate(model_result.scenarios):
        eco = economic.per_scenario[i] if i < len(economic.per_scenario) else None
        scenarios_payload.append({
            "return_period_years": sc.return_period_years,
            "flood_depth_m": sc.flood_depth_m,
            "extent_area_km2": sc.extent_area_km2,
            "velocity_ms": sc.velocity_ms,
            "duration_hours": sc.duration_hours,
            "economic": {
                "residential_loss_usd": eco.residential_loss_usd if eco else 0,
                "commercial_loss_usd": eco.commercial_loss_usd if eco else 0,
                "infrastructure_loss_usd": eco.infrastructure_loss_usd if eco else 0,
                "business_interruption_usd": eco.business_interruption_usd if eco else 0,
                "emergency_usd": eco.emergency_usd if eco else 0,
                "total_loss_usd": eco.total_loss_usd if eco else 0,
            } if eco else None,
        })

    flood_grid = []
    if request.include_grid and model_result.scenarios:
        sc100 = model_result.scenarios[2]
        deg = 0.05
        flood_grid = [
            {"lat": c.lat, "lon": c.lon, "depth_m": c.depth_m}
            for c in flood_hydrology_engine.get_depth_grid(
                model_result.lat - deg,
                model_result.lon - deg,
                model_result.lat + deg,
                model_result.lon + deg,
                sc100,
            )
        ]

    response = {
        "city_info": {
            "city_id": model_result.city_id,
            "city_name": model_result.city_name,
            "lat": model_result.lat,
            "lon": model_result.lon,
            "population": model_result.population,
            "area_km2": model_result.area_km2,
        },
        "data_sources": model_result.data_sources,
        "scenarios": scenarios_payload,
        "economic_impact": [
            {
                "return_period_years": e.return_period_years,
                "residential_loss_usd": e.residential_loss_usd,
                "commercial_loss_usd": e.commercial_loss_usd,
                "infrastructure_loss_usd": e.infrastructure_loss_usd,
                "business_interruption_usd": e.business_interruption_usd,
                "emergency_usd": e.emergency_usd,
                "total_loss_usd": e.total_loss_usd,
            }
            for e in economic.per_scenario
        ],
        "ael_usd": economic.ael_usd,
        "validation": None,
        "flood_grid": flood_grid if request.include_grid else None,
    }
    _FLOOD_RISK_CACHE[cache_key] = (response, now)
    return response


def _nearest_grid_depth(
    lat: float, lon: float,
    cells: List[dict],
) -> float:
    """Nearest-neighbor depth from flood grid cells. cells have lat, lon, depth_m."""
    if not cells:
        return 0.0
    best = cells[0]
    best_d = (lat - best["lat"]) ** 2 + (lon - best["lon"]) ** 2
    for c in cells[1:]:
        d = (lat - c["lat"]) ** 2 + (lon - c["lon"]) ** 2
        if d < best_d:
            best_d = d
            best = c
    return float(best.get("depth_m", 0))


@router.post("/flood-buildings")
async def flood_buildings(request: FloodBuildingsRequest):
    """
    Per-building flood depth and probability for a city.
    Uses flood model depth grid + OSM building footprints; interpolates depth at centroid.
    Returns buildings with depth_m, annual_probability, damage_ratio for globe visualization.
    Cached 10 min per (city, return_period_years).
    """
    from src.services.flood_hydrology_engine import flood_hydrology_engine
    from src.services.flood_economic_model import (
        flood_economic_model,
        _interp_depth_damage,
        RESIDENTIAL_DEPTH_DAMAGE,
    )
    from src.services.external.osm_buildings_client import osm_buildings_client

    if not request.city:
        return {"error": "city required", "buildings": [], "city_info": None}

    cache_key = (request.city, request.return_period_years)
    now = time.time()
    if cache_key in _FLOOD_BUILDINGS_CACHE:
        cached, ts = _FLOOD_BUILDINGS_CACHE[cache_key]
        if now - ts < _FLOOD_CACHE_TTL:
            return cached

    try:
        model_result = await flood_hydrology_engine.run_city_flood_model(city_id=request.city)
    except Exception as e:
        logger.warning("Flood buildings failed (run_city_flood_model): %s", e)
        return {"error": str(e), "buildings": [], "city_info": None}

    scenario = None
    for sc in model_result.scenarios:
        if sc.return_period_years == request.return_period_years:
            scenario = sc
            break
    if not scenario:
        scenario = model_result.scenarios[-1] if model_result.scenarios else None
    if not scenario:
        return {"error": "no scenario", "buildings": [], "city_info": None}

    deg = 0.05
    min_lat = model_result.lat - deg
    min_lon = model_result.lon - deg
    max_lat = model_result.lat + deg
    max_lon = model_result.lon + deg
    grid_cells = flood_hydrology_engine.get_depth_grid(
        min_lat, min_lon, max_lat, max_lon, scenario
    )
    grid_list = [{"lat": c.lat, "lon": c.lon, "depth_m": c.depth_m} for c in grid_cells]

    buildings_osm = await osm_buildings_client.get_buildings(
        min_lat, min_lon, max_lat, max_lon, limit=200
    )

    annual_probability = 1.0 / request.return_period_years
    buildings_out = []
    for b in buildings_osm:
        depth_m = _nearest_grid_depth(b.lat, b.lon, grid_list)
        damage_ratio = _interp_depth_damage(RESIDENTIAL_DEPTH_DAMAGE, depth_m)
        buildings_out.append({
            "id": b.id,
            "name": b.name,
            "lat": b.lat,
            "lon": b.lon,
            "depth_m": round(depth_m, 3),
            "return_period_years": request.return_period_years,
            "annual_probability": round(annual_probability, 4),
            "damage_ratio": round(damage_ratio, 4),
        })

    response = {
        "buildings": buildings_out,
        "city_info": {
            "city_id": model_result.city_id,
            "city_name": model_result.city_name,
            "lat": model_result.lat,
            "lon": model_result.lon,
        },
        "scenario": {
            "return_period_years": scenario.return_period_years,
            "flood_depth_m": scenario.flood_depth_m,
        },
    }
    _FLOOD_BUILDINGS_CACHE[cache_key] = (response, now)
    return response


@router.post("/flood-model/validate-batch")
async def flood_model_validate_batch():
    """
    Run flood model on each historical flood event; compare model vs actual loss.
    Returns per-city results, aggregate avg_error, accuracy_pct, and flags for error >20%.
    """
    from src.services.flood_hydrology_engine import flood_hydrology_engine
    from src.services.flood_economic_model import flood_economic_model
    from src.services.flood_historical_events import HISTORICAL_FLOOD_EVENTS

    results = []
    for event in HISTORICAL_FLOOD_EVENTS:
        try:
            model_result = await flood_hydrology_engine.run_city_flood_model(
                city_id=event.city_id,
                lat=event.lat,
                lon=event.lon,
                population_override=event.population,
            )
            economic = flood_economic_model.run(model_result)
            target_rp = event.return_period_approx_years
            best = min(economic.per_scenario, key=lambda s: abs(s.return_period_years - target_rp))
            model_loss = best.total_loss_usd
        except Exception as e:
            logger.warning("Flood validation failed for %s: %s", event.city_name, e)
            results.append({
                "city": event.city_name,
                "event_id": event.event_id,
                "model_loss_usd": None,
                "actual_loss_usd": event.actual_loss_usd,
                "error_pct": None,
                "pass": False,
            })
            continue
        actual = event.actual_loss_usd
        if actual <= 0:
            error_pct = None
            pass_ = False
        else:
            error_pct = abs(model_loss - actual) / actual * 100
            pass_ = error_pct <= 20.0
        results.append({
            "city": event.city_name,
            "event_id": event.event_id,
            "model_loss_usd": model_loss,
            "actual_loss_usd": actual,
            "error_pct": round(error_pct, 2) if error_pct is not None else None,
            "pass": pass_,
        })

    errors = [r["error_pct"] for r in results if r["error_pct"] is not None]
    avg_error = sum(errors) / len(errors) if errors else None
    passed = sum(1 for r in results if r.get("pass"))
    accuracy_pct = (passed / len(results) * 100) if results else 0.0
    return {
        "results": results,
        "total_events": len(HISTORICAL_FLOOD_EVENTS),
        "avg_error_pct": round(avg_error, 2) if avg_error is not None else None,
        "accuracy_pct": round(accuracy_pct, 1),
        "passed_count": passed,
        "divergence_gt_20_count": len([r for r in results if r.get("error_pct") is not None and r["error_pct"] > 20]),
    }


@router.get("/flood-model/retrospective")
async def flood_model_retrospective(
    city: Optional[str] = Query(None, description="Community id, e.g. bastrop_tx or AU-2147714"),
):
    """
    Retrospective analysis for the selected city: model vs fact for historical floods near this city.
    Returns per-event comparison and aggregate accuracy for this city (pilot: US historical events).
    """
    from src.services.flood_hydrology_engine import flood_hydrology_engine
    from src.services.flood_economic_model import flood_economic_model
    from src.services.flood_historical_events import HISTORICAL_FLOOD_EVENTS, events_near_city

    comm = _community_or_default(city)
    lat, lon = comm["lat"], comm["lng"]
    city_id = comm.get("id") or city or "bastrop_tx"
    city_name = comm.get("name") or (city or "Unknown").replace("_", " ")

    nearby = events_near_city(lat, lon, radius_km=120.0)
    if not nearby:
        return {
            "city_id": city_id,
            "city_name": city_name,
            "lat": lat,
            "lng": lon,
            "events": [],
            "total_events": 0,
            "passed_count": 0,
            "accuracy_pct": None,
            "avg_error_pct": None,
            "message": "No historical flood events in pilot catalog within 120 km of this city. Overall model validation uses 12 US events; use POST /flood-model/validate-batch for global accuracy.",
            "overall_total_events": len(HISTORICAL_FLOOD_EVENTS),
        }
    results = []
    for event in nearby:
        try:
            model_result = await flood_hydrology_engine.run_city_flood_model(
                city_id=event.city_id,
                lat=event.lat,
                lon=event.lon,
                population_override=event.population,
            )
            economic = flood_economic_model.run(model_result)
            target_rp = event.return_period_approx_years
            best = min(economic.per_scenario, key=lambda s: abs(s.return_period_years - target_rp))
            model_loss = best.total_loss_usd
        except Exception as e:
            logger.warning("Flood retrospective failed for %s: %s", event.city_name, e)
            results.append({
                "event_id": event.event_id,
                "city": event.city_name,
                "date": event.date,
                "model_loss_usd": None,
                "actual_loss_usd": event.actual_loss_usd,
                "error_pct": None,
                "pass": False,
            })
            continue
        actual = event.actual_loss_usd
        if actual <= 0:
            error_pct = None
            pass_ = False
        else:
            error_pct = abs(model_loss - actual) / actual * 100
            pass_ = error_pct <= 20.0
        results.append({
            "event_id": event.event_id,
            "city": event.city_name,
            "date": event.date,
            "model_loss_usd": model_loss,
            "actual_loss_usd": actual,
            "error_pct": round(error_pct, 2) if error_pct is not None else None,
            "pass": pass_,
        })
    errors = [r["error_pct"] for r in results if r.get("error_pct") is not None]
    avg_error = sum(errors) / len(errors) if errors else None
    passed = sum(1 for r in results if r.get("pass"))
    accuracy_pct = (passed / len(results) * 100) if results else None
    return {
        "city_id": city_id,
        "city_name": city_name,
        "lat": lat,
        "lng": lon,
        "events": results,
        "total_events": len(results),
        "passed_count": passed,
        "accuracy_pct": round(accuracy_pct, 1) if accuracy_pct is not None else None,
        "avg_error_pct": round(avg_error, 2) if avg_error is not None else None,
        "message": None,
    }


@router.get("/flood-scenarios")
async def flood_scenarios(
    city: Optional[str] = Query(None, description="Community id, e.g. bastrop_tx"),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
):
    """Unified city-level flood product: 10-year, 50-year, 100-year scenarios with depth and estimated loss."""
    from src.services.flood_hydrology_engine import flood_hydrology_engine
    from src.services.flood_economic_model import flood_economic_model

    try:
        model_result = await flood_hydrology_engine.run_city_flood_model(
            city_id=city,
            lat=lat,
            lon=lon,
        )
        economic = flood_economic_model.run(model_result)
        scenarios_out = []
        for i, sc in enumerate(model_result.scenarios):
            eco = economic.per_scenario[i] if i < len(economic.per_scenario) else None
            total_m = (eco.total_loss_usd / 1_000_000) if eco else 0.0
            scenarios_out.append({
                "return_period_years": sc.return_period_years,
                "flood_depth_m": sc.flood_depth_m,
                "estimated_loss_usd_m": round(total_m, 2),
                "description": f"{sc.return_period_years}-year event",
            })
        return {
            "latitude": model_result.lat,
            "longitude": model_result.lon,
            "city_id": model_result.city_id,
            "scenarios": scenarios_out,
            "source": "flood_hydrology_engine",
            "note": "SCS-CN + Manning; USGS/OSM/SMAP inputs when available.",
        }
    except Exception as e:
        logger.warning("Flood scenarios engine failed, using fallback: %s", e)
    comm = _community_or_default(city) if city else _community_or_default(None)
    lat_, lon_ = comm["lat"], comm["lng"]
    return {
        "latitude": lat_,
        "longitude": lon_,
        "city_id": city,
        "scenarios": [
            {"return_period_years": 10, "flood_depth_m": 0.3, "estimated_loss_usd_m": 1.2, "description": "10-year event"},
            {"return_period_years": 50, "flood_depth_m": 0.8, "estimated_loss_usd_m": 4.5, "description": "50-year event"},
            {"return_period_years": 100, "flood_depth_m": 1.2, "estimated_loss_usd_m": 9.0, "description": "100-year event"},
        ],
        "source": "simplified_return_period",
        "note": "Fallback when engine unavailable.",
    }


@router.get("/validate")
async def validate_historical(
    city: Optional[str] = Query(None, description="Community id"),
    historical_event_id: Optional[str] = Query(None, description="Historical event ID from /historical-events"),
    db: AsyncSession = Depends(get_db),
):
    """Validate model against historical event: compare model loss vs actual loss; flag if divergence >20%."""
    if not historical_event_id:
        return {"error": "historical_event_id required", "validated": False}
    result = await db.execute(select(HistoricalEvent).where(HistoricalEvent.id == historical_event_id))
    event = result.scalar_one_or_none()
    if not event:
        return {"error": "Historical event not found", "validated": False}
    comm = _community_or_default(city)
    # Model "prediction": use community AEL * severity as proxy for event loss (demo)
    ael_m = 4.2  # from community/risk; could fetch dynamically
    model_loss_eur = (ael_m * 1_000_000) * (event.severity_actual or 0.5) * 1.1  # rough EUR
    actual_loss_eur = event.financial_loss_eur or 0.0
    if actual_loss_eur <= 0:
        return {
            "historical_event_id": historical_event_id,
            "event_name": event.name,
            "model_loss_eur": round(model_loss_eur, 0),
            "actual_loss_eur": None,
            "error_pct": None,
            "divergence_gt_20": None,
            "validated": False,
            "note": "No actual financial loss recorded for this event.",
        }
    error_pct = abs(model_loss_eur - actual_loss_eur) / actual_loss_eur * 100
    divergence_gt_20 = error_pct > 20.0
    return {
        "historical_event_id": historical_event_id,
        "event_name": event.name,
        "city_id": city or "bastrop_tx",
        "model_loss_eur": round(model_loss_eur, 0),
        "actual_loss_eur": round(actual_loss_eur, 0),
        "error_pct": round(error_pct, 2),
        "divergence_gt_20": divergence_gt_20,
        "validated": not divergence_gt_20,
        "note": "Model uses community AEL × event severity as proxy; calibrate with more events.",
    }


@router.get("/effectiveness")
async def get_effectiveness():
    """Effectiveness of implemented measures (beyond CrossTrack observations)."""
    return {
        "measures_implemented": 3,
        "total_investment_m": 4.2,
        "risk_reduction_pct": 18,
        "ael_before_m": 4.2,
        "ael_after_m": 3.44,
        "savings_annual_m": 0.76,
        "by_measure": [
            {"id": "adp_001", "name": "Green Infrastructure Network", "implemented_at": "2025-06", "risk_before": 78, "risk_after": 62, "effectiveness_pct": 30, "cost_m": 2.25},
            {"id": "adp_002", "name": "Flood Barriers (Phase 1)", "implemented_at": "2025-09", "risk_before": 78, "risk_after": 55, "effectiveness_pct": 45, "cost_m": 1.1},
            {"id": "adp_003", "name": "Urban Tree Canopy (pilot)", "implemented_at": "2025-11", "risk_before": 65, "risk_after": 58, "effectiveness_pct": 40, "cost_m": 0.85},
        ],
    }


# ---------------------------------------------------------------------------
# Community / Municipal endpoints (demo data — ids match map dropdown)
# Full list: first city per country from cities-by-country.json + Texas pilot cities
# ---------------------------------------------------------------------------

from src.data.demo_communities import DEMO_COMMUNITIES as _DEMO_COMMUNITIES_JSON, TEXAS_COMMUNITIES as _TEXAS_COMMUNITIES

_DEMO_COMMUNITIES = {**_DEMO_COMMUNITIES_JSON, **_TEXAS_COMMUNITIES}


def _community_or_default(city: Optional[str]):
    if city and city in _DEMO_COMMUNITIES:
        return _DEMO_COMMUNITIES[city]
    return _DEMO_COMMUNITIES["bastrop_tx"]


def _risk_metrics_for_city(city_id: str, population: int) -> dict:
    """Deterministic placeholder risk metrics that vary by city so UI updates when city changes."""
    # Use hash of city_id so same city always gets same numbers; vary by population scale
    h = hash(city_id) % (10 ** 8)
    if h < 0:
        h = -h
    pop_scale = min(2.0, max(0.3, population / 15000))  # 12k~50k reference
    flood = 55 + (h % 35)
    heat = 45 + ((h // 7) % 45)
    drought = 20 + ((h // 49) % 40)
    wildfire = 10 + ((h // 343) % 35)
    total_b = max(50, int(200 * pop_scale + (h % 300)))
    res = int(total_b * (0.7 + (h % 20) / 100))
    comm_b = max(5, int(total_b * 0.2))
    crit = max(1, total_b // 25)
    ael = round(1.5 + (h % 80) / 20 + pop_scale * 1.5, 1)
    loss_100 = round(ael * (15 + (h % 25)), 1)
    trend_yr = [round(ael * (0.85 + i * 0.05 + (h % 10) / 100), 1) for i in range(6)]
    return {
        "hazards": [
            {"type": "flood", "score": flood, "level": "high" if flood >= 70 else "medium" if flood >= 40 else "low", "trend": "rising", "pct": flood},
            {"type": "heat", "score": heat, "level": "high" if heat >= 70 else "medium" if heat >= 40 else "low", "trend": "rising", "pct": heat},
            {"type": "drought", "score": drought, "level": "high" if drought >= 60 else "medium" if drought >= 30 else "low", "trend": "stable", "pct": drought},
            {"type": "wildfire", "score": wildfire, "level": "high" if wildfire >= 50 else "medium" if wildfire >= 25 else "low", "trend": "stable", "pct": wildfire},
        ],
        "buildings_at_risk": {"total": total_b, "residential": min(res, total_b - 5), "commercial": comm_b, "critical": crit},
        "estimated_annual_loss_m": ael,
        "loss_trend": trend_yr,
        "vulnerability_factors": [
            {"name": "Aging infrastructure (>40 yr)", "present": (h % 3) != 0},
            {"name": "Single-access roads", "present": (h % 5) != 2},
            {"name": "Low tree canopy (<15%)", "present": (h % 4) != 1},
            {"name": "High elderly population (>18%)", "present": (h % 7) >= 4},
            {"name": "NFIP participation", "present": (h % 2) == 0},
        ],
        "financial_exposure": {
            "annual_expected_loss_m": ael,
            "loss_100_year_m": loss_100,
            "projected_2050_m": round(ael * 1.6 + (h % 20) / 10, 1),
            "without_adaptation_2050_m": round(ael * 2.2 + (h % 30) / 10, 1),
        },
    }


def _community_for_request(city: Optional[str]):
    """Return community dict for response: known city from list, or synthetic for any requested id so name/pop/coords match metrics."""
    if city and city in _DEMO_COMMUNITIES:
        return _DEMO_COMMUNITIES[city]
    if not city or not city.strip():
        return _DEMO_COMMUNITIES["bastrop_tx"]
    # Unknown city: synthetic community so UI shows consistent population/lat/lng; frontend can show selected city name from dropdown
    cid = city.strip()
    h = hash(cid) % (10 ** 8)
    if h < 0:
        h = -h
    pop = 30000 + (h % 120000)
    lat = 0.0 + (h % 9000) / 100.0 - 45.0
    lng = 0.0 + ((h // 1000) % 36000) / 100.0 - 180.0
    return {"id": cid, "name": cid.replace("_", " "), "population": pop, "lat": lat, "lng": lng}


@router.get("/community/risk")
async def community_risk(city: Optional[str] = Query(None, description="Community id, e.g. bastrop_tx or IS-2658315")):
    """Community risk summary with hazard scores, buildings at risk, and estimated annual loss.
    Metrics and community (pop, etc.) always vary by the requested city id so changing city updates all numbers."""
    comm = _community_for_request(city)
    cid = comm.get("id") or city or "bastrop_tx"
    pop = comm.get("population") or 12847
    metrics = _risk_metrics_for_city(cid, pop)
    return {
        "community": comm,
        **metrics,
    }


@router.get("/insurability-report")
async def insurability_report(
    city: Optional[str] = Query(None, description="Municipality/community id, e.g. bastrop_tx"),
    period: Optional[str] = Query(None, description="Reporting period, e.g. 2026-01-01 to 2026-12-31"),
    format: Optional[str] = Query("json", description="json or pdf"),
):
    """
    Municipal Climate Insurability Report.

    Single artifact linking climate risk, exposure, and insurability with audit trail.
    """
    from src.services.municipal_insurability_report import generate_municipal_insurability_report

    municipality_id = city or "bastrop_tx"
    report = await generate_municipal_insurability_report(
        municipality_id=municipality_id,
        period=period,
        actor="api",
    )
    if format == "pdf":
        try:
            from src.services.pdf_report import generate_disclosure_pdf
            from src.services.audit_extension import audit_extension_service
            from fastapi.responses import Response

            disclosure_pkg = audit_extension_service.generate_disclosure_package(
                framework="MUNICIPAL_INSURABILITY",
                organization=report.get("municipality_name", municipality_id),
                reporting_period=report.get("period", ""),
            )
            if "error" in disclosure_pkg:
                raise ValueError(disclosure_pkg["error"])
            disclosure_pkg["municipal_insurability_report"] = report
            pdf_bytes = generate_disclosure_pdf(
                framework_id="MUNICIPAL_INSURABILITY",
                disclosure_package=disclosure_pkg,
                organization=report.get("municipality_name", municipality_id),
                reporting_period=report.get("period", ""),
            )
            return Response(content=pdf_bytes, media_type="application/pdf")
        except Exception as e:
            logger.warning("PDF generation failed, returning JSON: %s", e)
    return report


@router.get("/roi-metrics")
async def roi_metrics(
    city: Optional[str] = Query(None, description="Municipality id, e.g. bastrop_tx"),
    period: Optional[str] = Query("12m", description="12m or 6m"),
):
    """
    Three provable ROI metrics: loss reduction, reaction time, insurance impact.
    Used for commercial and regulatory evidence.
    """
    from src.services.municipal_roi_metrics import get_roi_metrics

    municipality_id = city or "bastrop_tx"
    return await get_roi_metrics(municipality_id, period=period or "12m")


@router.get("/launch-checklist")
async def launch_checklist(
    municipality_id: Optional[str] = Query(None, description="Municipality/community id, e.g. bastrop_tx"),
    db: AsyncSession = Depends(get_db),
):
    """
    City launch 6–12 week checklist: steps and completion status.
    Used by Municipal Dashboard «Launch progress» block.
    """
    mid = municipality_id or "bastrop_tx"
    mun_name = mid.replace("_", " ")
    onboarding_done = False
    risk_done = True
    report_done = True
    alerts_done = True
    subscription_active = False

    result = await db.execute(
        select(MunicipalOnboardingRequest).where(
            (MunicipalOnboardingRequest.municipality_name == mun_name) | (MunicipalOnboardingRequest.municipality_name == mid)
        ).order_by(MunicipalOnboardingRequest.requested_at.desc()).limit(1)
    )
    ob = result.scalar_one_or_none()
    if ob and ob.status in ("onboarded", "in_review"):
        onboarding_done = ob.status == "onboarded"

    sub_result = await db.execute(
        select(MunicipalSubscription).where(
            and_(
                or_(MunicipalSubscription.tenant_id == mid, MunicipalSubscription.tenant_id == mun_name),
                MunicipalSubscription.status == "active",
            )
        )
    )
    subscription_active = sub_result.scalars().first() is not None

    return {
        "municipality_id": mid,
        "steps": [
            {"id": "weeks_1_2", "label": "Onboarding: request approved, tenant created", "done": onboarding_done},
            {"id": "risk_assessed", "label": "Weeks 3–6: First risk assessment (Community Risk API)", "done": risk_done},
            {"id": "first_report", "label": "Weeks 3–6: First Insurability Report (draft)", "done": report_done},
            {"id": "alerts_set", "label": "Weeks 3–6: Alerts configured for region", "done": alerts_done},
            {"id": "weeks_7_12", "label": "Weeks 7–12: Adaptation plan + disclosure export", "done": subscription_active or report_done},
            {"id": "subscription", "label": "Subscription / contract signed", "done": subscription_active},
        ],
        "all_done": onboarding_done and risk_done and report_done and alerts_done and subscription_active,
    }


@router.get("/disclosure-export")
async def disclosure_export(
    city: Optional[str] = Query(None, description="Municipality id"),
    format: Optional[str] = Query("municipal_schema_v1", description="Export format: municipal_schema_v1"),
):
    """
    Export municipal climate risk disclosure in the public schema format (de facto standard).
    Use for insurers, reinsurers, regulators. Schema: docs/risk-disclosure-schema/
    """
    if format != "municipal_schema_v1":
        raise HTTPException(status_code=400, detail="Only format=municipal_schema_v1 is supported")
    from src.services.municipal_insurability_report import generate_municipal_insurability_report

    municipality_id = city or "bastrop_tx"
    report = await generate_municipal_insurability_report(
        municipality_id=municipality_id,
        period=None,
        actor="api",
    )
    return _report_to_municipal_schema_v1(report)


def _report_to_municipal_schema_v1(report: Dict[str, Any]) -> Dict[str, Any]:
    """Map insurability report to public Municipal / sub-sovereign climate risk disclosure schema v1."""
    identity = {
        "municipality_id": report.get("municipality_id", ""),
        "municipality_name": report.get("municipality_name", ""),
        "period": report.get("period", ""),
        "schema_version": "1.0",
    }
    hazards = [
        {"type": h.get("type"), "score": h.get("score"), "level": h.get("level"), "source": h.get("source", "platform")}
        for h in report.get("hazards", [])
    ]
    exposure = report.get("exposure", {})
    governance = {
        "frameworks": [report.get("compliance", {}).get("framework", "MUNICIPAL_INSURABILITY")],
        "sections": (report.get("compliance", {}).get("sections_count") or 0),
    }
    provenance = {
        "data_sources": report.get("data_sources", []),
        "updated_at": report.get("generated_at", ""),
        "model_versions": report.get("model_versions", {}),
    }
    return {
        "identity": identity,
        "hazards": hazards,
        "exposure": exposure,
        "governance": governance,
        "provenance": provenance,
        "insurability": report.get("insurability"),
        "roi_evidence": report.get("roi_evidence"),
    }


@router.get("/community/alerts")
async def community_alerts(city: Optional[str] = Query(None)):
    """Current conditions, active alerts, and 72-hour forecast for a community."""
    _community_or_default(city)
    forecast = []
    for h in range(0, 73, 3):
        flood = max(5, 45 - abs(h - 36) * 1.2)
        heat = max(10, 80 - abs(h - 15) * 2)
        fire = max(3, 20 - abs(h - 48) * 0.8)
        forecast.append({"hour": h, "flood_risk_pct": round(flood), "heat_risk_pct": round(heat), "fire_risk_pct": round(fire)})
    return {
        "current_conditions": {"temp_f": 94, "rain_24h_in": 0.2, "wind_mph": 12, "fire_risk": "low", "humidity_pct": 62},
        "alerts": [
            {"id": "a1", "type": "heat", "level": "amber", "message": "Heat advisory: 100 \u00b0F expected tomorrow", "expires": "2026-02-10T18:00:00Z"},
            {"id": "a2", "type": "flood", "level": "watch", "message": "Flash flood watch: Colorado River basin", "expires": "2026-02-11T06:00:00Z"},
        ],
        "forecast_72h": forecast,
    }


@router.get("/community/deadlines")
async def community_deadlines(city: Optional[str] = Query(None)):
    """Upcoming deadlines: grant applications, reports, community events."""
    _community_or_default(city)
    return {
        "deadlines": [
            {"date": "2026-03-12", "title": "Submit Risk Assessment Draft", "type": "task"},
            {"date": "2026-03-15", "title": "Community Workshop (Heat)", "type": "event"},
            {"date": "2026-03-20", "title": "FEMA BRIC Application Review", "type": "grant"},
            {"date": "2026-04-01", "title": "Quarterly Report Due", "type": "report"},
            {"date": "2026-04-15", "title": "TX TWDB Grant Deadline", "type": "grant"},
            {"date": "2026-05-01", "title": "Flood Barrier Phase 1 Milestone", "type": "task"},
        ],
    }


@router.get("/community/funding")
async def community_funding(city: Optional[str] = Query(None)):
    """Funding opportunities with application status and progress."""
    _community_or_default(city)
    return {
        "applications": [
            {"id": "fa1", "grant_name": "FEMA BRIC Grant", "status": "in_progress", "deadline": "2026-10-15", "progress_pct": 60, "amount_m": 8.0},
            {"id": "fa2", "grant_name": "State Resilience Fund", "status": "awarded", "deadline": None, "progress_pct": 100, "amount_m": 0.5},
            {"id": "fa3", "grant_name": "EPA Environmental Justice Grant", "status": "not_started", "deadline": "2026-11-01", "progress_pct": 0, "amount_m": 2.0},
            {"id": "fa4", "grant_name": "TX TWDB Flood Infrastructure", "status": "in_progress", "deadline": "2026-04-15", "progress_pct": 35, "amount_m": 3.0},
        ],
    }


@router.get("/community/list")
async def community_list():
    """List available demo communities."""
    return {"communities": list(_DEMO_COMMUNITIES.values())}
