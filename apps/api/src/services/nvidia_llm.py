"""
NVIDIA LLM Service - Language Models for Agents.
- Llama 3.1 70B: Complex reasoning (ANALYST, ADVISOR)
- Llama 3.1 8B: Fast responses (SENTINEL quick alerts)
- Mixtral 8x22B: Multi-task (ADVISOR options)

When GPU available, switches to local NIM inference.
Config: nvidia_llm_model_fast, nvidia_llm_model_deep, nvidia_llm_model_report override model names (e.g. for local NIM).
"""
import asyncio
import logging
import time
from typing import Optional, Literal, AsyncGenerator
from dataclasses import dataclass
from enum import Enum

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)

# In-memory usage aggregation for tokens/cost visibility
_usage_aggregate: dict = {"total_tokens": 0, "total_calls": 0, "last_reset": time.time()}


class LLMModel(str, Enum):
    """Available LLM models on NVIDIA API (NIM + Triton / integrate.api.nvidia.com)."""
    # Llama models
    LLAMA_70B = "meta/llama-3.1-70b-instruct"
    LLAMA_8B = "meta/llama-3.1-8b-instruct"
    # Nemotron — reasoning and multi-step planning
    NEMOTRON_NANO_9B = "nvidia/nvidia-nemotron-nano-9b-v2"
    NEMOTRON_340B = "nvidia/nemotron-4-340b-instruct"
    # Mistral / NeMo (fast scenario analysis)
    MISTRAL_NEMO_12B = "nv-mistralai/mistral-nemo-12b-instruct"
    # Mistral / Mixtral
    MISTRAL_LARGE = "mistralai/mistral-large-3-675b-instruct-2512"  # Most capable
    MIXTRAL_8X22B = "mistralai/mixtral-8x22b-instruct-v0.1"
    MIXTRAL_8X7B = "mistralai/mixtral-8x7b-instruct-v0.1"
    

@dataclass
class LLMResponse:
    """Response from LLM."""
    content: str
    model: str
    tokens_used: int
    finish_reason: str


class NVIDIALLMService:
    """
    Service for NVIDIA LLM inference.
    
    Routing order when multiple are configured:
    1. Dynamo (enable_dynamo) — low-latency distributed inference
    2. Triton (enable_triton) — model serving with triton_llm_model
    3. Cloud (nvidia_mode=cloud) — NVIDIA API
    4. Local NIM (nvidia_mode=local) — Llama NIM
    """
    
    def __init__(self):
        # Single key for all models: Llama, Mixtral, Nemotron (Nano 9B, 340B), etc.
        self.api_key = settings.nvidia_api_key or ""
        self.use_cloud = getattr(settings, "nvidia_mode", "cloud") == "cloud"
        self.nim_url = getattr(settings, "llama_nim_url", "http://localhost:8003")
        self.enable_dynamo = getattr(settings, "enable_dynamo", False)
        self.dynamo_url = (getattr(settings, "dynamo_url", "http://localhost:8004") or "").rstrip("/")
        self.enable_triton = getattr(settings, "enable_triton", False)
        self.triton_url = (getattr(settings, "triton_url", "http://localhost:8000") or "").rstrip("/")
        self.triton_llm_model = getattr(settings, "triton_llm_model", "nemotron") or "nemotron"

        cloud_base = getattr(settings, "nvidia_llm_api_url", "https://integrate.api.nvidia.com/v1") or "https://integrate.api.nvidia.com/v1"
        local_base = self.nim_url.rstrip("/") + "/v1"  # NIM is typically OpenAI-compatible at /v1/*

        self._cloud_base_url = cloud_base.rstrip("/")
        self._local_base_url = local_base.rstrip("/")
        self._dynamo_base_url = (self.dynamo_url + "/v1") if self.dynamo_url else ""
        self._triton_base_url = (self.triton_url + "/v1") if self.triton_url else ""

        # Back-compat: active base URL (first enabled in routing order)
        self.base_url = self._resolve_base_url()

        cloud_headers = {"Content-Type": "application/json"}
        if self.api_key:
            cloud_headers["Authorization"] = f"Bearer {self.api_key}"

        self._cloud_client = httpx.AsyncClient(timeout=120.0, headers=cloud_headers)
        self._local_client = httpx.AsyncClient(timeout=120.0, headers={"Content-Type": "application/json"})
        self._dynamo_client = httpx.AsyncClient(timeout=120.0, headers={"Content-Type": "application/json"})
        self._triton_client = httpx.AsyncClient(timeout=120.0, headers={"Content-Type": "application/json"})

        # Configurable model map (for local NIM or custom models)
        self._model_fast = (getattr(settings, "nvidia_llm_model_fast", "") or "").strip() or LLMModel.LLAMA_8B.value
        self._model_deep = (getattr(settings, "nvidia_llm_model_deep", "") or "").strip() or LLMModel.LLAMA_70B.value
        self._model_report = (getattr(settings, "nvidia_llm_model_report", "") or "").strip() or LLMModel.LLAMA_70B.value

    def _resolve_base_url(self) -> str:
        """First enabled backend in order: Dynamo -> Triton -> Cloud -> Local NIM."""
        if self.enable_dynamo and self._dynamo_base_url:
            return self._dynamo_base_url
        if self.enable_triton and self._triton_base_url:
            return self._triton_base_url
        return self._cloud_base_url if self.use_cloud else self._local_base_url

    def _get_llm_backend(self) -> tuple[str, httpx.AsyncClient, str]:
        """
        Returns (base_url, client, model_override).
        model_override: when set, use this instead of request model (e.g. Triton model name).
        """
        if self.enable_dynamo and self._dynamo_base_url:
            return self._dynamo_base_url, self._dynamo_client, ""
        if self.enable_triton and self._triton_base_url:
            return self._triton_base_url, self._triton_client, self.triton_llm_model
        if self.use_cloud:
            return self._cloud_base_url, self._cloud_client, ""
        return self._local_base_url, self._local_client, ""

    @property
    def mode(self) -> Literal["cloud", "local", "dynamo", "triton"]:
        if self.enable_dynamo and self._dynamo_base_url:
            return "dynamo"
        if self.enable_triton and self._triton_base_url:
            return "triton"
        return "cloud" if self.use_cloud else "local"

    def get_model_info(self) -> dict:
        """Models used for agents and reports (for logs and /health/nvidia). Config overrides when set."""
        return {
            "default": self._model_deep,
            "report_executive_summary": self._model_report,
            "analyst_advisor": self._model_deep,
            "sentinel_alerts": self._model_fast,
        }

    def get_usage(self) -> dict:
        """Aggregated token usage and call count for metrics/cost visibility."""
        global _usage_aggregate
        return {
            "total_tokens": _usage_aggregate["total_tokens"],
            "total_calls": _usage_aggregate["total_calls"],
            "last_reset_ts": _usage_aggregate["last_reset"],
        }

    @property
    def is_available(self) -> bool:
        """
        Whether the configured LLM provider is usable.
        - dynamo: requires enable_dynamo and dynamo_url
        - triton: requires enable_triton and triton_url
        - cloud: requires NVIDIA_API_KEY
        - local: requires a non-empty Llama NIM URL
        """
        if self.enable_dynamo and self._dynamo_base_url:
            return True
        if self.enable_triton and self._triton_base_url:
            return True
        if self.use_cloud:
            return bool((self.api_key or "").strip())
        return bool((self.nim_url or "").strip())
    
    async def generate(
        self,
        prompt: str,
        model: LLMModel = LLMModel.LLAMA_70B,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None,
        model_id_override: Optional[str] = None,
    ) -> LLMResponse:
        """
        Generate text using LLM.

        Args:
            prompt: User prompt
            model: Model to use
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0-1)
            system_prompt: Optional system prompt
            model_id_override: Optional explicit model id (e.g. from config) overrides model.value

        Returns:
            LLM response with generated text
        """
        use_cloud_only = self.use_cloud and not (self.enable_dynamo or self.enable_triton)
        if use_cloud_only and not self.api_key:
            logger.warning("NVIDIA API key not set (cloud mode), using mock response")
            return self._mock_response(prompt, model.value)

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        base_url, client, model_override = self._get_llm_backend()
        effective_model = model_override or (model_id_override or model.value)

        last_exc = None
        for attempt in range(3):
            try:
                response = await client.post(
                    f"{base_url}/chat/completions",
                    json={
                        "model": effective_model,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                        "top_p": 0.9,
                    },
                )

                if response.status_code != 200:
                    if response.status_code >= 500 and attempt < 2:
                        await asyncio.sleep(1.0 * (attempt + 1))
                        last_exc = RuntimeError(f"LLM API {response.status_code}: {response.text[:200]}")
                        continue
                    logger.error("LLM API error (%s): %s", response.status_code, response.text[:500])
                    # If dynamo/triton/local failed but cloud is configured, fallback to cloud.
                    if (self.enable_dynamo or self.enable_triton or not self.use_cloud) and self.api_key:
                        try:
                            fallback = await self._cloud_client.post(
                                f"{self._cloud_base_url}/chat/completions",
                                json={
                                    "model": model.value,
                                    "messages": messages,
                                    "max_tokens": max_tokens,
                                    "temperature": temperature,
                                    "top_p": 0.9,
                                },
                            )
                            if fallback.status_code == 200:
                                data = fallback.json()
                                choice = data.get("choices", [{}])[0]
                                usage = data.get("usage", {})
                                tok = usage.get("total_tokens", 0)
                                _usage_aggregate["total_tokens"] += tok
                                _usage_aggregate["total_calls"] += 1
                                return LLMResponse(
                                    content=choice.get("message", {}).get("content", ""),
                                    model=model.value,
                                    tokens_used=tok,
                                    finish_reason=choice.get("finish_reason", "stop"),
                                )
                        except Exception as e:
                            logger.debug("LLM cloud fallback failed: %s", e)
                    return self._mock_response(prompt, model.value)

                data = response.json()
                choice = data.get("choices", [{}])[0]
                usage = data.get("usage", {})
                tok = usage.get("total_tokens", 0)
                _usage_aggregate["total_tokens"] += tok
                _usage_aggregate["total_calls"] += 1
                return LLMResponse(
                    content=choice.get("message", {}).get("content", ""),
                    model=effective_model,
                    tokens_used=tok,
                    finish_reason=choice.get("finish_reason", "stop"),
                )
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                last_exc = e
                if attempt < 2:
                    await asyncio.sleep(1.0 * (attempt + 1))
                    continue
                logger.error("LLM API error after retries: %s", e)
                return self._mock_response(prompt, model.value)
            except Exception as e:
                last_exc = e
                if attempt < 2:
                    await asyncio.sleep(1.0 * (attempt + 1))
                    continue
                logger.error("LLM API error: %s", e)
                return self._mock_response(prompt, model.value)

        return self._mock_response(prompt, model.value)
    
    async def generate_stream(
        self,
        prompt: str,
        model: LLMModel = LLMModel.LLAMA_70B,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream text generation for real-time responses.
        """
        use_cloud_only = self.use_cloud and not (self.enable_dynamo or self.enable_triton)
        if use_cloud_only and not self.api_key:
            yield "Mock streaming response: " + prompt[:100]
            return
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        base_url, client, model_override = self._get_llm_backend()
        effective_model = model_override or model.value
        
        try:
            async with client.stream(
                "POST",
                f"{base_url}/chat/completions",
                json={
                    "model": effective_model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "stream": True,
                },
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            import json
                            chunk = json.loads(data)
                            content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if content:
                                yield content
                        except:
                            pass
                            
        except Exception as e:
            logger.error(f"LLM streaming error: {e}")
            yield f"Error: {e}"
    
    def _mock_response(self, prompt: str, model: str) -> LLMResponse:
        """Generate mock response for testing without API key."""
        return LLMResponse(
            content=f"[Demo] Analysis of: {prompt[:200]}…\n\nDemo response. Optional: set NVIDIA_API_KEY in apps/api/.env on the server for live AI.",
            model=model,
            tokens_used=0,
            finish_reason="mock",
        )
    
    # ==================== AGENT-SPECIFIC METHODS ====================
    
    async def sentinel_alert(
        self,
        event_type: str,
        severity: str,
        details: str,
    ) -> str:
        """
        SENTINEL: Generate concise alert message.
        Uses fast Llama 8B model.
        """
        prompt = f"""Generate a concise risk alert message:

Event Type: {event_type}
Severity: {severity}
Details: {details}

Format as: [ALERT] <one-line summary>
Then 2-3 bullet points with key facts."""

        response = await self.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_8B,
            max_tokens=256,
            temperature=0.3,
            model_id_override=self._model_fast,
        )
        return response.content
    
    async def analyst_deep_dive(
        self,
        asset_name: str,
        risk_data: dict,
        simulation_results: dict,
    ) -> str:
        """
        ANALYST: Generate detailed risk analysis.
        Uses Llama 70B for complex reasoning.
        """
        prompt = f"""You are a senior risk analyst. Provide a detailed analysis:

## Asset: {asset_name}

## Risk Metrics:
{self._format_dict(risk_data)}

## Simulation Results:
{self._format_dict(simulation_results)}

Provide:
1. Root cause analysis
2. Risk interconnections
3. Probability assessment
4. Impact quantification
5. Key uncertainties"""

        response = await self.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_70B,
            max_tokens=2000,
            temperature=0.5,
            system_prompt="You are an expert risk analyst specializing in physical-financial risk assessment for real estate and infrastructure.",
            model_id_override=self._model_deep,
        )
        return response.content
    
    async def advisor_recommendations(
        self,
        asset_name: str,
        risk_summary: str,
        budget_eur: float,
        options: list[dict],
    ) -> str:
        """
        ADVISOR: Generate investment recommendations.
        Uses Llama 70B for strategic thinking.
        """
        options_text = "\n".join([
            f"- Option {i+1}: {opt.get('name')} - Cost: €{opt.get('cost'):,.0f}, Expected benefit: {opt.get('benefit')}"
            for i, opt in enumerate(options)
        ])
        
        prompt = f"""You are a strategic investment advisor. Recommend actions:

## Asset: {asset_name}
## Available Budget: €{budget_eur:,.0f}
## Risk Summary: {risk_summary}

## Available Options:
{options_text}

Provide:
1. Prioritized recommendations
2. ROI analysis for each
3. Implementation timeline
4. Risk-adjusted NPV
5. Strategic rationale"""

        response = await self.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_70B,
            max_tokens=2500,
            temperature=0.6,
            system_prompt="You are a strategic investment advisor for physical assets. Prioritize risk mitigation ROI and regulatory compliance.",
            model_id_override=self._model_deep,
        )
        return response.content
    
    async def reporter_summary(
        self,
        report_type: str,
        data: dict,
        audience: str = "executive",
    ) -> str:
        """
        REPORTER: Generate report section or summary.
        Uses Llama 70B for professional writing.
        When entity_name/entity_type are in data, adapts tone and focus to the entity type
        (e.g. HEALTHCARE: medical supply, ICU, patient safety; FINANCIAL: liquidity, counterparties;
        CITY/REGION: infrastructure and population).
        """
        entity_instruction = ""
        if data.get("entity_name") and data.get("entity_type"):
            entity_instruction = (
                f"\nEntity context: {data['entity_name']} (Type: {data['entity_type']}). "
                "Adapt the analysis and recommendations to this entity type "
                "(e.g. for HEALTHCARE focus on medical supply, ICU capacity, patient safety; "
                "for FINANCIAL on liquidity, counterparties; for CITY/REGION on infrastructure and population)."
            )
            if "airport" in (data.get("entity_name") or "").lower():
                entity_instruction += " For airports mention operator (e.g. Fraport AG for Frankfurt Airport) and airline operations (e.g. Deutsche Lufthansa) where relevant."
            entity_instruction += "\n\n"
        prompt = f"""Generate a {report_type} for {audience} audience.
{entity_instruction}## Data:
{self._format_dict(data)}

Requirements:
- Professional tone
- Clear structure
- Key metrics highlighted
- Actionable insights
- Suitable for {audience} level"""

        response = await self.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_70B,
            max_tokens=3000,
            temperature=0.4,
            system_prompt="You are a professional report writer specializing in ESG, climate risk, and financial reporting for institutional investors. When an entity type is provided, tailor the summary to that entity (healthcare, financial, city/region, etc.).",
            model_id_override=self._model_report,
        )
        return response.content
    
    def _format_dict(self, d: dict, indent: int = 0) -> str:
        """Format dict for prompt."""
        lines = []
        prefix = "  " * indent
        for k, v in d.items():
            if isinstance(v, dict):
                lines.append(f"{prefix}- {k}:")
                lines.append(self._format_dict(v, indent + 1))
            else:
                lines.append(f"{prefix}- {k}: {v}")
        return "\n".join(lines)
    
    async def close(self):
        """Close HTTP clients."""
        await self._cloud_client.aclose()
        await self._local_client.aclose()
        await self._dynamo_client.aclose()
        await self._triton_client.aclose()


# Global service instance
llm_service = NVIDIALLMService()
