"""
NVIDIA FLUX.1-dev Integration - Image Generation for Reports.

Used by REPORTER agent to generate:
- Building visualizations
- Damage illustrations
- Risk heatmap overlays
- Report graphics
"""
import logging
import base64
from typing import Optional, Literal
from dataclasses import dataclass

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class GeneratedImage:
    """Generated image from FLUX."""
    base64_data: str
    width: int
    height: int
    seed: int
    prompt: str
    
    def to_bytes(self) -> bytes:
        """Convert base64 to bytes."""
        return base64.b64decode(self.base64_data)
    
    def save(self, path: str) -> None:
        """Save image to file."""
        with open(path, "wb") as f:
            f.write(self.to_bytes())


class NVIDIAFluxService:
    """
    Service for NVIDIA FLUX.1-dev image generation.
    
    Used by REPORTER agent to generate visualizations for reports.
    """
    
    def __init__(self):
        self.api_key = getattr(settings, 'nvidia_flux_api_key', None) or ""
        self.nim_url = getattr(settings, 'flux_nim_url', 'http://localhost:8002')
        self.cloud_url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-1-dev"
        
        # Build headers
        headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        
        self.http_client = httpx.AsyncClient(
            timeout=120.0,  # Image generation can be slow
            headers=headers,
        )
    
    async def check_nim_health(self) -> bool:
        """Check if local FLUX NIM is healthy."""
        try:
            response = await self.http_client.get(
                f"{self.nim_url}/v1/health/ready",
            )
            return response.status_code == 200
        except Exception:
            return False
    
    async def generate_image(
        self,
        prompt: str,
        mode: Literal["base", "canny", "depth"] = "base",
        width: int = 1024,
        height: int = 1024,
        steps: int = 50,
        seed: Optional[int] = None,
        use_local: bool = True,
    ) -> Optional[GeneratedImage]:
        """
        Generate an image using FLUX.1-dev.
        
        Args:
            prompt: Text description of the image
            mode: Generation mode (base, canny, depth)
            width: Image width
            height: Image height
            steps: Number of diffusion steps (more = better quality)
            seed: Random seed for reproducibility
            use_local: Try local NIM first
            
        Returns:
            Generated image or None if failed
        """
        # Try local NIM first
        if use_local:
            result = await self._generate_local(prompt, mode, width, height, steps, seed)
            if result:
                return result
            logger.info("Local FLUX NIM unavailable, trying cloud API")
        
        # Fallback to cloud API
        return await self._generate_cloud(prompt, mode, width, height, steps, seed)
    
    async def _generate_local(
        self,
        prompt: str,
        mode: str,
        width: int,
        height: int,
        steps: int,
        seed: Optional[int],
    ) -> Optional[GeneratedImage]:
        """Generate using local NIM."""
        try:
            payload = {
                "prompt": prompt,
                "mode": mode,
                "width": width,
                "height": height,
                "steps": steps,
            }
            if seed is not None:
                payload["seed"] = seed
            
            response = await self.http_client.post(
                f"{self.nim_url}/v1/infer",
                json=payload,
            )
            
            if response.status_code != 200:
                logger.warning(f"Local FLUX failed: {response.status_code}")
                return None
            
            data = response.json()
            artifact = data.get("artifacts", [{}])[0]
            
            return GeneratedImage(
                base64_data=artifact.get("base64", ""),
                width=width,
                height=height,
                seed=artifact.get("seed", seed or 0),
                prompt=prompt,
            )
            
        except Exception as e:
            logger.warning(f"Local FLUX error: {e}")
            return None
    
    async def _generate_cloud(
        self,
        prompt: str,
        mode: str,
        width: int,
        height: int,
        steps: int,
        seed: Optional[int],
    ) -> Optional[GeneratedImage]:
        """Generate using NVIDIA cloud API."""
        if not self.api_key:
            logger.warning("NVIDIA API key not set, using mock image")
            return self._mock_image(prompt, width, height, seed or 0)
        
        try:
            payload = {
                "prompt": prompt,
                "mode": mode,
                "width": width,
                "height": height,
                "steps": steps,
            }
            if seed is not None:
                payload["seed"] = seed
            
            response = await self.http_client.post(
                self.cloud_url,
                json=payload,
            )
            
            if response.status_code != 200:
                logger.error(f"FLUX cloud API failed: {response.status_code}")
                return self._mock_image(prompt, width, height, seed or 0)
            
            data = response.json()
            artifact = data.get("artifacts", [{}])[0]
            
            return GeneratedImage(
                base64_data=artifact.get("base64", ""),
                width=width,
                height=height,
                seed=artifact.get("seed", seed or 0),
                prompt=prompt,
            )
            
        except Exception as e:
            logger.error(f"FLUX cloud API error: {e}")
            return self._mock_image(prompt, width, height, seed or 0)
    
    def _mock_image(
        self,
        prompt: str,
        width: int,
        height: int,
        seed: int,
    ) -> GeneratedImage:
        """Generate a mock placeholder image for testing."""
        # Create a simple 1x1 pixel PNG as placeholder
        # In production, could use a real placeholder service
        placeholder_png = (
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        logger.info(f"Generated mock image for: {prompt[:50]}...")
        
        return GeneratedImage(
            base64_data=placeholder_png,
            width=width,
            height=height,
            seed=seed,
            prompt=prompt,
        )
    
    # ==================== REPORTER Agent Helpers ====================
    
    async def generate_building_damage_visualization(
        self,
        building_type: str,
        damage_type: str,
        damage_severity: float,  # 0-1
    ) -> Optional[GeneratedImage]:
        """
        Generate building damage visualization for reports.
        
        Args:
            building_type: e.g., "commercial office", "residential"
            damage_type: e.g., "flood", "earthquake", "fire"
            damage_severity: 0-1 scale
        """
        severity_desc = "minor" if damage_severity < 0.3 else "moderate" if damage_severity < 0.7 else "severe"
        
        prompt = f"""Professional architectural illustration of a {building_type} building showing {severity_desc} {damage_type} damage. Technical illustration style, clean lines, damage clearly visible, professional engineering documentation quality, neutral lighting, side elevation view."""
        
        return await self.generate_image(
            prompt=prompt,
            mode="base",
            width=1024,
            height=768,
            steps=50,
        )
    
    async def generate_risk_scenario_illustration(
        self,
        scenario_type: str,
        location_description: str,
    ) -> Optional[GeneratedImage]:
        """
        Generate risk scenario illustration for reports.
        
        Args:
            scenario_type: e.g., "flood", "hurricane", "wildfire"
            location_description: e.g., "urban commercial district"
        """
        prompt = f"""Photorealistic aerial view of {location_description} during a {scenario_type} event. Professional documentary photography style, dramatic but realistic, showing infrastructure impact, suitable for risk assessment report."""
        
        return await self.generate_image(
            prompt=prompt,
            mode="base",
            width=1280,
            height=720,
            steps=50,
        )
    
    async def generate_mitigation_concept(
        self,
        mitigation_type: str,
        building_type: str,
    ) -> Optional[GeneratedImage]:
        """
        Generate mitigation concept visualization.
        
        Args:
            mitigation_type: e.g., "flood barriers", "seismic retrofitting"
            building_type: e.g., "commercial office"
        """
        prompt = f"""Architectural concept illustration showing {mitigation_type} implementation on a {building_type} building. Clean technical drawing style, annotated diagram feel, professional engineering visualization, before/after comparison layout."""
        
        return await self.generate_image(
            prompt=prompt,
            mode="base",
            width=1280,
            height=720,
            steps=50,
        )
    
    async def close(self):
        """Close HTTP client."""
        await self.http_client.aclose()


# Global service instance
flux_service = NVIDIAFluxService()
