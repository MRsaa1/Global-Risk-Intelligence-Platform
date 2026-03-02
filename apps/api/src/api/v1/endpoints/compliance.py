"""Unified Compliance Dashboard API (Gap X7) + regulatory export formatters (P3)."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.services.basel_calculator import calculate_basel_metrics, basel_metrics_to_dict
from src.services.compliance_dashboard import get_compliance_dashboard, get_compliance_dashboard_with_verifications
from src.services.solvency_calculator import calculate_solvency_metrics, solvency_metrics_to_dict
from src.services.dora_service import (
    get_or_create_ict_framework,
    list_incidents as dora_list_incidents,
    report_incident as dora_report_incident,
    submit_ict_framework as dora_submit_ict_framework,
)
from src.services.eu_ai_act_service import (
    classify_risk_tier as eu_ai_act_classify,
    get_art11_technical_doc as eu_ai_act_art11_doc,
    get_conformity_status as eu_ai_act_conformity,
    list_pmm_incidents as eu_ai_act_pmm_list,
    post_market_incident_report as eu_ai_act_pmm_report,
)
from src.services.gdpr_service import (
    create_dpia as gdpr_create_dpia,
    get_or_set_dpo as gdpr_dpo,
    list_dpias as gdpr_list_dpias,
    subject_access as gdpr_subject_access,
    subject_erasure_request as gdpr_erasure_request,
    subject_portability as gdpr_subject_portability,
)
from src.services.nis2_service import (
    classify_entity as nis2_classify_entity,
    get_or_set_risk_measures as nis2_risk_measures,
    list_nis2_incidents,
    report_nis2_incident,
)
from src.services.regulatory_formatters import (
    REGULATORY_FORMATS,
    format_for_regulator,
)

router = APIRouter()


class BaselMetricsPayload(BaseModel):
    """Optional inputs for Basel RWA/LCR/NSFR calculation."""
    total_rwa_m: Optional[float] = None
    cet1_capital_m: Optional[float] = 100
    tier1_capital_m: Optional[float] = None
    total_capital_m: Optional[float] = None
    total_exposure_m: Optional[float] = None
    hqla_m: Optional[float] = 80
    net_cash_outflows_30d_m: Optional[float] = 70
    available_stable_funding_m: Optional[float] = 90
    required_stable_funding_m: Optional[float] = 85
    exposure_credit_m: Optional[float] = None
    exposure_market_m: Optional[float] = None
    exposure_operational_m: Optional[float] = None


class SolvencyMetricsPayload(BaseModel):
    """Optional inputs for Solvency II SCR/MCR/Solvency Ratio."""
    own_funds_m: Optional[float] = 100
    technical_provisions_m: Optional[float] = 50
    premiums_annual_m: Optional[float] = 30
    market_risk_m: Optional[float] = 20
    counterparty_risk_m: Optional[float] = 5
    life_underwriting_m: Optional[float] = 10
    health_underwriting_m: Optional[float] = 5
    non_life_underwriting_m: Optional[float] = 15
    operational_risk_m: Optional[float] = 8
    is_life: Optional[bool] = False


class RegulatoryExportPayload(BaseModel):
    """Optional stress report or disclosure payload for formatters."""
    total_loss: Optional[float] = None
    total_loss_eur_m: Optional[float] = None
    scenario_name: Optional[str] = None
    currency: Optional[str] = None
    report_metadata: Optional[Dict[str, Any]] = None
    probabilistic_metrics: Optional[Dict[str, Any]] = None
    climate_scenarios: Optional[list] = None
    insurance_analysis: Optional[Dict[str, Any]] = None
    sector_metrics: Optional[Dict[str, Any]] = None


@router.get("/basel-metrics")
async def basel_metrics(
    total_rwa_m: Optional[float] = None,
    cet1_capital_m: float = 100,
    total_exposure_m: Optional[float] = None,
    hqla_m: float = 80,
    net_cash_outflows_30d_m: float = 70,
    available_stable_funding_m: float = 90,
    required_stable_funding_m: float = 85,
):
    """
    Basel III/IV metrics: RWA, CET1/Tier1/Total ratios, LCR, NSFR.
    Query params or POST body with BaselMetricsPayload.
    """
    m = calculate_basel_metrics(
        total_rwa_m=total_rwa_m,
        cet1_capital_m=cet1_capital_m,
        tier1_capital_m=None,
        total_capital_m=None,
        total_exposure_m=total_exposure_m,
        hqla_m=hqla_m,
        net_cash_outflows_30d_m=net_cash_outflows_30d_m,
        available_stable_funding_m=available_stable_funding_m,
        required_stable_funding_m=required_stable_funding_m,
    )
    return basel_metrics_to_dict(m)


@router.post("/basel-metrics")
async def basel_metrics_post(body: Optional[BaselMetricsPayload] = None):
    """Compute Basel metrics from request body (Pillar 1 / LCR / NSFR)."""
    kwargs = body.model_dump(exclude_none=True) if body else {}
    m = calculate_basel_metrics(**kwargs)
    return basel_metrics_to_dict(m)


@router.get("/solvency-metrics")
async def solvency_metrics(
    own_funds_m: float = 100,
    technical_provisions_m: float = 50,
    premiums_annual_m: float = 30,
    is_life: bool = False,
):
    """Solvency II SCR, MCR and Solvency Ratio (Standard Formula)."""
    m = calculate_solvency_metrics(
        own_funds_m=own_funds_m,
        technical_provisions_m=technical_provisions_m,
        premiums_annual_m=premiums_annual_m,
        is_life=is_life,
    )
    return solvency_metrics_to_dict(m)


@router.post("/solvency-metrics")
async def solvency_metrics_post(body: Optional[SolvencyMetricsPayload] = None):
    """Compute Solvency II metrics from request body (SCR, MCR, ratio)."""
    kwargs = body.model_dump(exclude_none=True) if body else {}
    m = calculate_solvency_metrics(**kwargs)
    return solvency_metrics_to_dict(m)


@router.get("/dora/ict-framework")
async def dora_ict_framework(entity_id: str = "default"):
    """DORA Art. 5–14: Get ICT risk management framework status."""
    fw = get_or_create_ict_framework(entity_id)
    return {
        "entity_id": fw.entity_id,
        "governance_in_place": fw.governance_in_place,
        "risk_identification_done": fw.risk_identification_done,
        "protection_measures": fw.protection_measures,
        "detection_capabilities": fw.detection_capabilities,
        "response_plan": fw.response_plan,
        "recovery_plan": fw.recovery_plan,
        "last_assessment": fw.last_assessment,
    }


@router.post("/dora/ict-framework")
async def dora_ict_framework_post(
    entity_id: str = "default",
    governance_in_place: Optional[bool] = None,
    risk_identification_done: Optional[bool] = None,
    protection_measures: Optional[bool] = None,
    detection_capabilities: Optional[bool] = None,
    response_plan: Optional[bool] = None,
    recovery_plan: Optional[bool] = None,
):
    """DORA Art. 5–14: Submit or update ICT risk management framework."""
    kwargs = {k: v for k, v in locals().items() if k != "entity_id" and v is not None}
    return dora_submit_ict_framework(entity_id, **kwargs)


@router.post("/dora/incidents")
async def dora_incident_report(
    entity_id: str = "default",
    severity: str = "medium",
    description: str = "",
    detected_at: Optional[str] = None,
    initial_notification_sent: bool = False,
    root_cause_analysis_done: bool = False,
):
    """DORA Art. 16: Register ICT incident (classification and notification tracking)."""
    return dora_report_incident(
        entity_id=entity_id,
        severity=severity,
        description=description or "ICT incident reported",
        detected_at=detected_at,
        initial_notification_sent=initial_notification_sent,
        root_cause_analysis_done=root_cause_analysis_done,
    )


@router.get("/dora/incidents")
async def dora_incidents_list(entity_id: Optional[str] = None, limit: int = 50):
    """DORA Art. 16: List ICT incident reports."""
    return dora_list_incidents(entity_id=entity_id, limit=limit)


@router.get("/nis2/classification")
async def nis2_classification(entity_id: str = "default", sector: str = "digital_infrastructure", size_medium_upper: bool = True):
    """NIS2 Art. 3: Entity classification (essential/important)."""
    return nis2_classify_entity(entity_id=entity_id, sector=sector, size_medium_upper=size_medium_upper)


@router.get("/nis2/risk-measures")
async def nis2_risk_measures_get(entity_id: str = "default"):
    """NIS2 Art. 21: Risk management measures status."""
    return nis2_risk_measures(entity_id)


@router.post("/nis2/risk-measures")
async def nis2_risk_measures_post(
    entity_id: str = "default",
    risk_analysis_policy: Optional[bool] = None,
    incident_handling: Optional[bool] = None,
    business_continuity: Optional[bool] = None,
    supply_chain_security: Optional[bool] = None,
    access_control_encryption: Optional[bool] = None,
):
    """NIS2 Art. 21: Set risk management measures."""
    kwargs = {k: v for k, v in locals().items() if k != "entity_id" and v is not None}
    return nis2_risk_measures(entity_id, **kwargs)


@router.post("/nis2/incidents")
async def nis2_incident_report(
    entity_id: str = "default",
    description: str = "",
    detected_at: Optional[str] = None,
    early_warning_24h: bool = False,
    notification_72h: bool = False,
    final_report_submitted: bool = False,
):
    """NIS2 Art. 23: Register significant incident (24h/72h/1 month)."""
    return report_nis2_incident(
        entity_id=entity_id,
        description=description or "NIS2 incident",
        detected_at=detected_at,
        early_warning_24h=early_warning_24h,
        notification_72h=notification_72h,
        final_report_submitted=final_report_submitted,
    )


@router.get("/nis2/incidents")
async def nis2_incidents_list(entity_id: Optional[str] = None, limit: int = 50):
    """NIS2 Art. 23: List incident notifications."""
    return list_nis2_incidents(entity_id=entity_id, limit=limit)


@router.get("/eu-ai-act/risk-tier")
async def eu_ai_act_risk_tier(system_type: str = "", use_case: str = "", annex_iii_match: bool = False):
    """EU AI Act Art. 5/6, Annex III: Classify AI system risk tier."""
    return eu_ai_act_classify(system_type=system_type, use_case=use_case, annex_iii_match=annex_iii_match)


@router.get("/eu-ai-act/conformity")
async def eu_ai_act_conformity_get(system_id: str = "1"):
    """EU AI Act Art. 40–49: Conformity assessment status."""
    return eu_ai_act_conformity(system_id)


@router.get("/eu-ai-act/art11-doc")
async def eu_ai_act_art11_doc_get(system_id: str = "1", system_name: str = ""):
    """EU AI Act Art. 11, Annex IV: Technical documentation template."""
    return eu_ai_act_art11_doc(system_id=system_id, system_name=system_name)


@router.post("/eu-ai-act/pmm-incident")
async def eu_ai_act_pmm_incident(
    system_id: str = "1",
    description: str = "",
    severity: str = "serious",
    corrective_action: str = "",
):
    """EU AI Act Art. 61–62, 72: Post-market monitoring — serious incident report."""
    return eu_ai_act_pmm_report(
        system_id=system_id,
        description=description or "Serious incident",
        severity=severity,
        corrective_action=corrective_action,
    )


@router.get("/eu-ai-act/pmm-incidents")
async def eu_ai_act_pmm_incidents_list(system_id: Optional[str] = None, limit: int = 50):
    """EU AI Act: List post-market monitoring incidents."""
    return eu_ai_act_pmm_list(system_id=system_id, limit=limit)


@router.get("/gdpr/access")
async def gdpr_access(subject_id: str = "default"):
    """GDPR Art. 15: Right of access."""
    return gdpr_subject_access(subject_id)


@router.post("/gdpr/erasure-request")
async def gdpr_erasure(subject_id: str = "", reason: str = ""):
    """GDPR Art. 17: Right to erasure — register request."""
    return gdpr_erasure_request(subject_id or "anonymous", reason=reason)


@router.get("/gdpr/portability")
async def gdpr_portability_get(subject_id: str = "default", format: str = "json"):
    """GDPR Art. 20: Right to data portability."""
    return gdpr_subject_portability(subject_id, format=format)


@router.get("/gdpr/dpo")
async def gdpr_dpo_get(organization: str = "default"):
    """GDPR Art. 37–39: Data Protection Officer — get designation."""
    return gdpr_dpo(organization=organization)


@router.post("/gdpr/dpo")
async def gdpr_dpo_post(organization: str = "default", name: str = "", contact: str = ""):
    """GDPR Art. 37–39: Set DPO contact."""
    return gdpr_dpo(name=name, contact=contact, organization=organization)


@router.post("/gdpr/dpia")
async def gdpr_dpia_create(
    processing_activity: str = "",
    purpose: str = "",
    risk_level: str = "medium",
    mitigation: str = "",
    organization: str = "default",
):
    """GDPR Art. 35: Data Protection Impact Assessment — create record."""
    return gdpr_create_dpia(
        processing_activity=processing_activity or "Processing",
        purpose=purpose or "Stated purpose",
        risk_level=risk_level,
        mitigation=mitigation,
        organization=organization,
    )


@router.get("/gdpr/dpias")
async def gdpr_dpias_list(organization: Optional[str] = None, limit: int = 50):
    """GDPR Art. 35: List DPIAs."""
    return gdpr_list_dpias(organization=organization, limit=limit)


@router.get("/dashboard")
async def compliance_dashboard(
    jurisdiction: str = Query("EU", description="Jurisdiction for verification status (EU, US, UK, etc.)"),
    entity_type: Optional[str] = Query(None, description="Optional entity type for applicable frameworks"),
    db: AsyncSession = Depends(get_db),
):
    """
    Return aggregated compliance status across all frameworks:
    Basel, Solvency II, TCFD, ISSB, DORA, NIS2, EU AI Act, GDPR.
    Merges last compliance_verifications per framework for the given jurisdiction.
    """
    return await get_compliance_dashboard_with_verifications(db, jurisdiction=jurisdiction, entity_type=entity_type)


@router.get("/multi-jurisdiction")
async def multi_jurisdiction_view(
    entity_type: str = Query("CITY_REGION", description="Entity type (CITY_REGION, FINANCIAL, etc.)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Multi-Jurisdiction View: aggregate compliance frameworks and status by jurisdiction.

    Returns one entry per jurisdiction (EU, USA, UK, Japan, Canada, Australia) with:
    - applicable frameworks (from regulatory_engine),
    - optional last verification status per framework when compliance_verifications exist.

    Use for cross-border / supervisory view and Regulator Mode.
    """
    from src.services.regulatory_engine import (
        get_applicable_frameworks,
        get_applicable_regulations,
    )
    from src.models.compliance_verification import ComplianceVerification
    from sqlalchemy import select

    jurisdictions = [
        ("EU", "European Union"),
        ("USA", "United States"),
        ("UK", "United Kingdom"),
        ("Japan", "Japan"),
        ("Canada", "Canada"),
        ("Australia", "Australia"),
    ]
    out: List[Dict[str, Any]] = []
    for j_code, j_name in jurisdictions:
        ctx = get_applicable_regulations(entity_type, j_code, 0.5)
        frameworks = get_applicable_frameworks(entity_type, j_code, 0.5)
        # Last verification status per framework for this jurisdiction
        last_verifications: Dict[str, Any] = {}
        try:
            subq = (
                select(
                    ComplianceVerification.framework_id,
                    ComplianceVerification.status,
                    ComplianceVerification.checked_at,
                )
                .where(
                    ComplianceVerification.jurisdiction == j_code,
                )
                .order_by(ComplianceVerification.checked_at.desc())
            )
            result = await db.execute(subq)
            rows = result.all()
            seen: Dict[str, bool] = {}
            for row in rows:
                if row.framework_id and not seen.get(row.framework_id):
                    seen[row.framework_id] = True
                    last_verifications[row.framework_id] = {
                        "status": row.status,
                        "checked_at": row.checked_at.isoformat() if row.checked_at else None,
                    }
        except Exception:
            pass
        out.append({
            "jurisdiction_code": j_code,
            "jurisdiction_name": j_name,
            "entity_type": entity_type,
            "regulations": ctx.regulations,
            "regulation_labels": ctx.labels,
            "disclosure_required": ctx.disclosure_required,
            "frameworks": frameworks,
            "last_verification_by_framework": last_verifications,
        })
    return {
        "description": "Multi-jurisdiction compliance view for supervisory and cross-border reporting.",
        "entity_type": entity_type,
        "jurisdictions": out,
    }


@router.post("/run-verification")
async def run_compliance_verification(
    jurisdiction: str = Query("EU", description="Jurisdiction (EU, US, UK, etc.)"),
    entity_type: Optional[str] = Query(None, description="Optional entity type (BANK, INSURER, etc.)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Run compliance verification for the given jurisdiction (no stress test).
    Writes to compliance_verifications and audit log; dashboard will show last verified.
    """
    from src.services.compliance_agent import run_verification
    verifications = await run_verification(
        db,
        entity_type=entity_type or "BANK",
        jurisdiction=jurisdiction,
        entity_id=None,
        stress_test_id=None,
        context=None,
        framework_ids=None,
    )
    await db.commit()
    return {
        "verifications": [
            {
                "id": v.id,
                "framework_id": v.framework_id,
                "jurisdiction": v.jurisdiction,
                "status": v.status,
                "checked_at": v.checked_at.isoformat() if v.checked_at else None,
            }
            for v in verifications
        ],
    }


@router.post("/load-norms")
async def load_regulatory_norms(db: AsyncSession = Depends(get_db)):
    """Load regulatory document chunks from data/regulatory_norms into the DB (for RAG)."""
    from src.services.regulatory_norms_loader import load_norms_from_dir
    counts = await load_norms_from_dir(db)
    await db.commit()
    return {"loaded": counts, "message": f"Loaded {counts.get('documents', 0)} documents, {counts.get('chunks', 0)} chunks."}


@router.get("/export/formats")
async def list_export_formats():
    """List available regulatory submission formats (EBA CROE, Fed DFAST/CCAR, OSFI E-18, Basel Pillar 3)."""
    return {
        "formats": [
            {"id": k, "description": (v.__doc__ or "").strip().split("\n")[0]}
            for k, v in REGULATORY_FORMATS.items()
        ],
    }


@router.post("/export")
async def export_regulatory(
    format_id: str = Query(..., description="eba_croe | fed_dfast | fed_ccar | osfi_e18 | basel_pillar3"),
    body: Optional[RegulatoryExportPayload] = None,
):
    """
    Export stress test / disclosure data in a regulator-specific format.
    Pass optional body with report_v2-like fields; otherwise uses minimal default payload.
    """
    payload = body.model_dump(exclude_none=True) if body is not None else {}
    return format_for_regulator(format_id, payload)
