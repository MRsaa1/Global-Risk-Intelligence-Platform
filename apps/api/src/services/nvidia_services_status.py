"""
NVIDIA services checklist. Logged at API startup; exposed at GET /api/v1/health/nvidia and /health/detailed (nvidia_services).
Each entry includes source (config/env) and call (API or invocation).
"""
import asyncio
import logging
from typing import Any

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)

_NIM_HEALTH_TIMEOUT = 5.0


async def _check_nim_ready(url: str) -> bool:
    """Check NIM readiness via GET {url}/v1/health/ready."""
    if not (url or "").strip():
        return False
    try:
        async with httpx.AsyncClient(timeout=_NIM_HEALTH_TIMEOUT) as client:
            r = await client.get(f"{url.rstrip('/')}/v1/health/ready")
            return r.status_code == 200 and ("ready" in (r.text or "").lower())
    except Exception:
        return False


async def _check_dynamo_ready(url: str) -> bool:
    """Check Dynamo readiness (OpenAI-compatible: /v1/models or /health)."""
    if not (url or "").strip():
        return False
    base = url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=_NIM_HEALTH_TIMEOUT) as client:
            for path in ("/v1/models", "/health", "/"):
                r = await client.get(f"{base}{path}")
                if r.status_code == 200:
                    return True
        return False
    except Exception:
        return False


async def _check_triton_ready(url: str) -> bool:
    """Check Triton Inference Server readiness: GET /v2/health/ready."""
    if not (url or "").strip():
        return False
    try:
        async with httpx.AsyncClient(timeout=_NIM_HEALTH_TIMEOUT) as client:
            r = await client.get(f"{url.rstrip('/')}/v2/health/ready")
            return r.status_code == 200
    except Exception:
        return False


def _nvidia_ai_orchestration_status() -> dict[str, Any]:
    """NVIDIA AI Orchestration — multi-model consensus for stress tests (fast + deep analysis, weighted summary)."""
    configured = bool(getattr(settings, "nvidia_api_key", None) or "")
    available = False
    models_used: dict[str, str] = {}
    try:
        from src.services.nvidia_orchestration import nvidia_consensus_engine
        available = nvidia_consensus_engine.is_available
        models_used = {
            "fast": "Mistral NeMo 12B or Llama 8B",
            "deep": "Llama 3.1 70B",
            "summary": "Llama 3.1 70B",
            "entity": "Ontology (optional NeMo NER when NIM)",
        }
    except Exception:
        pass
    base = (getattr(settings, "nvidia_llm_api_url", "") or "https://integrate.api.nvidia.com/v1").rstrip("/")
    return {
        "product": "NVIDIA AI Orchestration",
        "used_for": "Stress test multi-model consensus: entity classification, scenario analysis (fast/deep), consistency check, executive summary",
        "configured": configured,
        "status": "available" if (configured and available) else "not_configured" if not configured else "unavailable",
        "models": models_used,
        "source": "Config: NVIDIA_API_KEY (same as NVIDIA LLM), nvidia_llm_api_url",
        "call": f"POST /api/v1/stress-tests/execute (use_nvidia_orchestration=true). Chat: POST {base}/chat/completions (fast + deep + summary).",
    }


def _nvidia_llm_status() -> dict[str, Any]:
    """NVIDIA LLM (cloud API) — агенты, OVERSEER, генерация отчётов (executive summary)."""
    configured = bool(getattr(settings, "nvidia_api_key", None) or "")
    model_info: dict[str, Any] = {}
    try:
        from src.services.nvidia_llm import llm_service
        model_info = llm_service.get_model_info()
    except Exception:
        model_info = {"report_executive_summary": "meta/llama-3.1-70b-instruct"}
    base = (getattr(settings, "nvidia_llm_api_url", "") or "https://integrate.api.nvidia.com/v1").rstrip("/")
    return {
        "product": "NVIDIA LLM (Cloud API)",
        "used_for": "Report generation (executive summary), REPORTER agent, ADVISOR, ANALYST, OVERSEER",
        "configured": configured,
        "status": "available" if configured else "not_configured",
        "mode": getattr(settings, "nvidia_mode", "cloud"),
        "models": model_info,
        "source": "Config: NVIDIA_API_KEY, nvidia_mode, nvidia_llm_api_url",
        "call": f"POST {base}/chat/completions (model from models.report_executive_summary)",
    }


def _nvidia_nim_fourcastnet_status() -> dict[str, Any]:
    """FourCastNet NIM."""
    url = (getattr(settings, "fourcastnet_nim_url", "") or "").strip()
    use_local = getattr(settings, "use_local_nim", False)
    use_nim_weather = getattr(settings, "use_nim_weather", True)
    return {
        "product": "Earth-2 FourCastNet NIM",
        "used_for": "Weather forecasting, climate stress pipeline",
        "configured": use_local and bool(url),
        "enabled": use_nim_weather,
        "url": url or "(not set)",
        "status": "enabled" if (use_local and url and use_nim_weather) else "disabled",
        "source": "Config: USE_LOCAL_NIM, use_nim_weather, fourcastnet_nim_url",
        "call": f"GET {url}/v1/health/ready" if url else "—",
    }


def _nvidia_nim_corrdiff_status() -> dict[str, Any]:
    """CorrDiff NIM."""
    url = (getattr(settings, "corrdiff_nim_url", "") or "").strip()
    use_local = getattr(settings, "use_local_nim", False)
    return {
        "product": "Earth-2 CorrDiff NIM",
        "used_for": "High-resolution climate downscaling",
        "configured": use_local and bool(url),
        "url": url or "(not set)",
        "status": "enabled" if (use_local and url) else "disabled",
        "source": "Config: USE_LOCAL_NIM, corrdiff_nim_url",
        "call": f"GET {url}/v1/health/ready" if url else "—",
    }


def _nvidia_nim_flux_status() -> dict[str, Any]:
    """FLUX NIM."""
    url = (getattr(settings, "flux_nim_url", "") or "").strip()
    use_nim_flux = getattr(settings, "use_nim_flux", True)
    return {
        "product": "FLUX.1-dev NIM",
        "used_for": "REPORTER agent image generation",
        "configured": bool(url),
        "enabled": use_nim_flux,
        "url": url or "(not set)",
        "status": "enabled" if (url and use_nim_flux) else "disabled",
        "source": "Config: use_nim_flux, flux_nim_url",
        "call": f"GET {url}/v1/health/ready" if url else "—",
    }


def _nvidia_earth2_status() -> dict[str, Any]:
    """Earth-2 API."""
    url = (getattr(settings, "earth2_api_url", "") or "").strip()
    return {
        "product": "NVIDIA Earth-2",
        "used_for": "Climate/weather data in climate_data service",
        "configured": bool(url),
        "url": url or "(not set)",
        "status": "enabled" if url else "disabled",
        "source": "Config: earth2_api_url",
        "call": f"GET {url}/..." if url else "—",
    }


def _nvidia_physics_nemo_status() -> dict[str, Any]:
    """PhysicsNeMo."""
    url = (getattr(settings, "physics_nemo_api_url", "") or "").strip()
    return {
        "product": "PhysicsNeMo",
        "used_for": "Physics simulation layer",
        "configured": bool(url),
        "url": url or "(not set)",
        "status": "enabled" if url else "disabled",
        "source": "Config: physics_nemo_api_url",
        "call": f"GET {url}/..." if url else "—",
    }


def _nvidia_riva_status() -> dict[str, Any]:
    """NVIDIA Riva (Speech AI) — TTS/STT for voice alerts and report narration."""
    enabled = getattr(settings, "enable_riva", False)
    url = (getattr(settings, "riva_url", "") or "").strip()
    return {
        "product": "NVIDIA Riva",
        "used_for": "Voice alerts (SENTINEL), TTS for reports, optional voice interface",
        "configured": enabled and bool(url),
        "url": url or "(not set)",
        "status": "enabled" if (enabled and url) else "disabled",
        "source": "Config: enable_riva, riva_url",
        "call": "POST /api/v1/nvidia/riva/tts, POST /api/v1/nvidia/riva/stt",
    }


def _nvidia_dynamo_status() -> dict[str, Any]:
    """NVIDIA Dynamo — distributed low-latency inference."""
    enabled = getattr(settings, "enable_dynamo", False)
    url = (getattr(settings, "dynamo_url", "") or "").strip()
    return {
        "product": "NVIDIA Dynamo",
        "used_for": "Low-latency inference when scaling agents",
        "configured": enabled and bool(url),
        "url": url or "(not set)",
        "status": "enabled" if (enabled and url) else "disabled",
        "source": "Config: enable_dynamo, dynamo_url",
        "call": "Inference routing when enabled",
    }


def _nvidia_triton_status() -> dict[str, Any]:
    """Triton Inference Server — model serving."""
    enabled = getattr(settings, "enable_triton", False)
    url = (getattr(settings, "triton_url", "") or "").strip()
    return {
        "product": "Triton Inference Server",
        "used_for": "Self-hosted LLM/embeddings (TensorRT-LLM backend)",
        "configured": enabled and bool(url),
        "url": url or "(not set)",
        "status": "enabled" if (enabled and url) else "disabled",
        "source": "Config: enable_triton, triton_url",
        "call": "Model serving when LLM client routes to Triton",
    }


def _nemo_retriever_status() -> dict[str, Any]:
    """NeMo Retriever."""
    enabled = getattr(settings, "nemo_retriever_enabled", True)
    return {
        "product": "NeMo Retriever",
        "used_for": "RAG pipeline, AI-Q citations",
        "configured": True,
        "status": "enabled" if enabled else "disabled",
        "source": "Config: nemo_retriever_enabled",
        "call": "Used by AI-Q / agents (embed + rerank)",
    }


def _nemo_guardrails_status() -> dict[str, Any]:
    """NeMo Guardrails."""
    enabled = getattr(settings, "nemo_guardrails_enabled", True)
    return {
        "product": "NeMo Guardrails",
        "used_for": "Safety and compliance checks",
        "configured": True,
        "status": "enabled" if enabled else "disabled",
        "source": "Config: nemo_guardrails_enabled",
        "call": "Used by agents before output (validate)",
    }


def _nemo_agent_toolkit_status() -> dict[str, Any]:
    """NeMo Agent Toolkit."""
    enabled = getattr(settings, "nemo_agent_toolkit_enabled", True)
    return {
        "product": "NeMo Agent Toolkit",
        "used_for": "Agent monitoring (Phase 2)",
        "configured": True,
        "status": "enabled" if enabled else "disabled",
        "source": "Config: nemo_agent_toolkit_enabled",
        "call": "GET /api/v1/agent-monitoring/* (metrics)",
    }


def _nemo_curator_status() -> dict[str, Any]:
    """NeMo Curator."""
    enabled = getattr(settings, "nemo_curator_enabled", True)
    return {
        "product": "NeMo Curator",
        "used_for": "Data curation (Phase 2)",
        "configured": True,
        "status": "enabled" if enabled else "disabled",
        "source": "Config: nemo_curator_enabled",
        "call": "Used by data curation pipeline",
    }


def _nemo_data_designer_status() -> dict[str, Any]:
    """NeMo Data Designer."""
    enabled = getattr(settings, "nemo_data_designer_enabled", True)
    return {
        "product": "NeMo Data Designer",
        "used_for": "Synthetic data generation (Phase 2)",
        "configured": True,
        "status": "enabled" if enabled else "disabled",
        "source": "Config: nemo_data_designer_enabled",
        "call": "POST /api/v1/synthetic-data/*",
    }


def _nemo_evaluator_status() -> dict[str, Any]:
    """NeMo Evaluator."""
    enabled = getattr(settings, "nemo_evaluator_enabled", True)
    return {
        "product": "NeMo Evaluator",
        "used_for": "Agent evaluation (Phase 2)",
        "configured": True,
        "status": "enabled" if enabled else "disabled",
        "source": "Config: nemo_evaluator_enabled",
        "call": "GET /api/v1/agent-evaluation/*",
    }


def get_nvidia_services_status_sync() -> dict[str, dict[str, Any]]:
    """Sync status list (no NIM health check)."""
    return {
        "nvidia_llm": _nvidia_llm_status(),
        "nvidia_ai_orchestration": _nvidia_ai_orchestration_status(),
        "fourcastnet_nim": _nvidia_nim_fourcastnet_status(),
        "corrdiff_nim": _nvidia_nim_corrdiff_status(),
        "flux_nim": _nvidia_nim_flux_status(),
        "earth2": _nvidia_earth2_status(),
        "physics_nemo": _nvidia_physics_nemo_status(),
        "riva": _nvidia_riva_status(),
        "dynamo": _nvidia_dynamo_status(),
        "triton": _nvidia_triton_status(),
        "nemo_retriever": _nemo_retriever_status(),
        "nemo_guardrails": _nemo_guardrails_status(),
        "nemo_agent_toolkit": _nemo_agent_toolkit_status(),
        "nemo_curator": _nemo_curator_status(),
        "nemo_data_designer": _nemo_data_designer_status(),
        "nemo_evaluator": _nemo_evaluator_status(),
    }


async def _false() -> bool:
    return False


async def get_nvidia_services_status() -> dict[str, dict[str, Any]]:
    """
    Полный чеклист: статус конфигурации + по возможности проверка доступности NIM и Riva.
    Добавляет recommended_actions когда сервис недоступен (например fallback на Open-Meteo для погоды).
    """
    status = get_nvidia_services_status_sync()
    use_local = getattr(settings, "use_local_nim", False)
    recommendations: list[str] = []

    if use_local:
        fourcastnet_url = (getattr(settings, "fourcastnet_nim_url", "") or "").strip()
        corrdiff_url = (getattr(settings, "corrdiff_nim_url", "") or "").strip()
        flux_url = (getattr(settings, "flux_nim_url", "") or "").strip()

        r_f, r_c, r_fx = await asyncio.gather(
            _check_nim_ready(fourcastnet_url) if fourcastnet_url else _false(),
            _check_nim_ready(corrdiff_url) if corrdiff_url else _false(),
            _check_nim_ready(flux_url) if flux_url else _false(),
        )
        if fourcastnet_url:
            status["fourcastnet_nim"]["ready"] = r_f
            if not r_f:
                recommendations.append("FourCastNet NIM unavailable — weather via Open-Meteo/Weather adapter.")
        if corrdiff_url:
            status["corrdiff_nim"]["ready"] = r_c
            if not r_c:
                recommendations.append("CorrDiff NIM unavailable — high-res climate downscaling disabled.")
        if flux_url:
            status["flux_nim"]["ready"] = r_fx
            if not r_fx:
                recommendations.append("FLUX NIM unavailable — image generation via cloud or disabled.")

    # Riva health (when enabled)
    if status.get("riva", {}).get("configured"):
        try:
            from src.services.nvidia_riva import riva_service
            status["riva"]["ready"] = await riva_service.health()
        except Exception:
            status["riva"]["ready"] = False

    # Dynamo health (when enabled)
    if status.get("dynamo", {}).get("configured"):
        dynamo_url = (getattr(settings, "dynamo_url", "") or "").strip()
        if dynamo_url:
            status["dynamo"]["ready"] = await _check_dynamo_ready(dynamo_url)
        else:
            status["dynamo"]["ready"] = False

    # Triton health (when enabled)
    if status.get("triton", {}).get("configured"):
        triton_url = (getattr(settings, "triton_url", "") or "").strip()
        if triton_url:
            status["triton"]["ready"] = await _check_triton_ready(triton_url)
        else:
            status["triton"]["ready"] = False

    # LLM: when local NIM is configured but not ready, recommend cloud fallback
    if getattr(settings, "nvidia_mode", "cloud") == "local":
        llama_url = (getattr(settings, "llama_nim_url", "") or "").strip()
        if llama_url:
            llama_ready = await _check_nim_ready(llama_url)
            status.setdefault("nvidia_llm", {})["local_nim_ready"] = llama_ready
            if not llama_ready:
                recommendations.append("Local Llama NIM unavailable — set nvidia_mode=cloud to use NVIDIA API.")

    if recommendations:
        status["recommended_actions"] = {"messages": recommendations}

    return status


def log_nvidia_services_checklist(structlog_logger=None):
    """Log full NVIDIA services checklist to console at API startup."""
    status = get_nvidia_services_status_sync()
    log = structlog_logger if structlog_logger is not None else logger
    log.info("NVIDIA SERVICES CHECKLIST (start)")
    for key, s in status.items():
        product = s.get("product", key)
        st = s.get("status", "unknown")
        used = s.get("used_for", "")
        url = s.get("url", "")
        models = s.get("models", {})
        if models:
            log.info("NVIDIA service", product=product, status=st, used_for=used, models=models)
        elif url and url != "(not set)":
            log.info("NVIDIA service", product=product, status=st, used_for=used, url=url)
        else:
            log.info("NVIDIA service", product=product, status=st, used_for=used)
    log.info("NVIDIA SERVICES CHECKLIST (end)")
