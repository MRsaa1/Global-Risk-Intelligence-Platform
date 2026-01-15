"""
NVIDIA LLM Service - Language Models for Agents.

Uses NVIDIA Cloud API (no GPU required):
- Llama 3.1 70B: Complex reasoning (ANALYST, ADVISOR)
- Llama 3.1 8B: Fast responses (SENTINEL quick alerts)
- Mixtral 8x22B: Multi-task (ADVISOR options)

When GPU available, switches to local NIM inference.
"""
import logging
from typing import Optional, Literal, AsyncGenerator
from dataclasses import dataclass
from enum import Enum

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)


class LLMModel(str, Enum):
    """Available LLM models on NVIDIA API."""
    # Llama models
    LLAMA_70B = "meta/llama-3.1-70b-instruct"
    LLAMA_8B = "meta/llama-3.1-8b-instruct"
    # Mistral models
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
    
    Uses NVIDIA Cloud API for inference without GPU.
    Can switch to local NIM when GPU is available.
    """
    
    def __init__(self):
        self.api_key = settings.nvidia_api_key or ""
        self.base_url = "https://integrate.api.nvidia.com/v1"
        self.use_cloud = getattr(settings, 'nvidia_mode', 'cloud') == 'cloud'
        self.nim_url = getattr(settings, 'llama_nim_url', 'http://localhost:8003')
        
        # Build headers
        headers = {'Content-Type': 'application/json'}
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        
        self.http_client = httpx.AsyncClient(
            timeout=120.0,
            headers=headers,
        )
    
    async def generate(
        self,
        prompt: str,
        model: LLMModel = LLMModel.LLAMA_70B,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None,
    ) -> LLMResponse:
        """
        Generate text using LLM.
        
        Args:
            prompt: User prompt
            model: Model to use
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0-1)
            system_prompt: Optional system prompt
            
        Returns:
            LLM response with generated text
        """
        if not self.api_key:
            logger.warning("NVIDIA API key not set, using mock response")
            return self._mock_response(prompt, model.value)
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        try:
            response = await self.http_client.post(
                f"{self.base_url}/chat/completions",
                json={
                    "model": model.value,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "top_p": 0.9,
                },
            )
            
            if response.status_code != 200:
                logger.error(f"LLM API error: {response.status_code} - {response.text}")
                return self._mock_response(prompt, model.value)
            
            data = response.json()
            choice = data.get("choices", [{}])[0]
            usage = data.get("usage", {})
            
            return LLMResponse(
                content=choice.get("message", {}).get("content", ""),
                model=model.value,
                tokens_used=usage.get("total_tokens", 0),
                finish_reason=choice.get("finish_reason", "stop"),
            )
            
        except Exception as e:
            logger.error(f"LLM API error: {e}")
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
        if not self.api_key:
            yield "Mock streaming response: " + prompt[:100]
            return
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        try:
            async with self.http_client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                json={
                    "model": model.value,
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
            content=f"[Mock {model}] Analysis of: {prompt[:200]}...\n\nThis is a simulated response. Configure NVIDIA_API_KEY for real inference.",
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
            model=LLMModel.LLAMA_8B,  # Fast model for real-time
            max_tokens=256,
            temperature=0.3,  # Low temp for consistency
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
        """
        prompt = f"""Generate a {report_type} for {audience} audience:

## Data:
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
            system_prompt="You are a professional report writer specializing in ESG, climate risk, and financial reporting for institutional investors.",
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
        """Close HTTP client."""
        await self.http_client.aclose()


# Global service instance
llm_service = NVIDIALLMService()
