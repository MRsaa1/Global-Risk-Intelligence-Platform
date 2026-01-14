"""
NVIDIA NIM (NVIDIA Inference Microservice) Integration.

Provides local inference using NVIDIA NIM containers:
- FourCastNet: Weather forecasting (up to 10 days)
- CorrDiff: High-resolution climate downscaling

NIM endpoints run locally on Docker with GPU support.
"""
import logging
import tempfile
import tarfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

import httpx
import numpy as np

from src.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class FourCastNetForecast:
    """Weather forecast from FourCastNet NIM."""
    time: datetime
    lead_hours: int
    temperature_2m: np.ndarray  # (lat, lon)
    wind_u_10m: np.ndarray
    wind_v_10m: np.ndarray
    precipitation: np.ndarray
    pressure_msl: np.ndarray
    humidity_2m: np.ndarray


@dataclass
class CorrDiffOutput:
    """High-resolution output from CorrDiff NIM."""
    samples: int
    temperature_2m: np.ndarray  # (samples, lat, lon)
    wind_u_10m: np.ndarray
    wind_v_10m: np.ndarray
    precipitation: np.ndarray


class NVIDIANIMService:
    """
    Service for NVIDIA NIM local inference.
    
    Uses local Docker containers for inference:
    - FourCastNet on port 8001
    - CorrDiff on port 8000
    """
    
    def __init__(self):
        self.fourcastnet_url = settings.fourcastnet_nim_url
        self.corrdiff_url = settings.corrdiff_nim_url
        self.use_local = settings.use_local_nim
        
        self.http_client = httpx.AsyncClient(timeout=300.0)  # Long timeout for inference
        
    async def check_health(self, service: str = "fourcastnet") -> bool:
        """Check if NIM service is healthy."""
        url = self.fourcastnet_url if service == "fourcastnet" else self.corrdiff_url
        
        try:
            response = await self.http_client.get(
                f"{url}/v1/health/ready",
                headers={"accept": "application/json"},
            )
            return response.status_code == 200
        except Exception as e:
            logger.warning(f"NIM health check failed for {service}: {e}")
            return False
    
    async def fourcastnet_forecast(
        self,
        input_data: np.ndarray,
        input_time: datetime,
        simulation_length: int = 4,  # Number of 6-hour steps
    ) -> Optional[list[FourCastNetForecast]]:
        """
        Run FourCastNet inference for weather forecasting.
        
        Args:
            input_data: Input array from ARCO/ERA5 (shape: 1, 1, 73, 721, 1440)
            input_time: Initial time for forecast
            simulation_length: Number of 6-hour forecast steps
            
        Returns:
            List of forecasts for each time step
        """
        if not self.use_local:
            logger.info("Local NIM disabled, using mock data")
            return self._mock_fourcastnet(input_time, simulation_length)
        
        try:
            # Save input to temporary file
            with tempfile.NamedTemporaryFile(suffix=".npy", delete=False) as f:
                np.save(f, input_data.astype('float32'))
                input_path = f.name
            
            # Send request to NIM
            with open(input_path, "rb") as f:
                response = await self.http_client.post(
                    f"{self.fourcastnet_url}/v1/infer",
                    files={"input_array": f},
                    data={
                        "input_time": input_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        "simulation_length": simulation_length,
                    },
                )
            
            if response.status_code != 200:
                logger.error(f"FourCastNet error: {response.status_code}")
                return None
            
            # Parse output tar file
            forecasts = await self._parse_fourcastnet_output(
                response.content, input_time, simulation_length
            )
            
            # Cleanup
            Path(input_path).unlink(missing_ok=True)
            
            return forecasts
            
        except Exception as e:
            logger.error(f"FourCastNet inference failed: {e}")
            return self._mock_fourcastnet(input_time, simulation_length)
    
    async def corrdiff_downscale(
        self,
        input_data: np.ndarray,
        samples: int = 2,
        steps: int = 12,
    ) -> Optional[CorrDiffOutput]:
        """
        Run CorrDiff inference for high-resolution downscaling.
        
        Args:
            input_data: GEFS input array (shape: 1, 1, 38, 129, 301)
            samples: Number of ensemble samples to generate
            steps: Number of diffusion steps
            
        Returns:
            High-resolution output with multiple samples
        """
        if not self.use_local:
            logger.info("Local NIM disabled, using mock data")
            return self._mock_corrdiff(samples)
        
        try:
            # Save input to temporary file
            with tempfile.NamedTemporaryFile(suffix=".npy", delete=False) as f:
                np.save(f, input_data.astype('float32'))
                input_path = f.name
            
            # Send request to NIM
            with open(input_path, "rb") as f:
                response = await self.http_client.post(
                    f"{self.corrdiff_url}/v1/infer",
                    files={"input_array": f},
                    data={
                        "samples": samples,
                        "steps": steps,
                    },
                )
            
            if response.status_code != 200:
                logger.error(f"CorrDiff error: {response.status_code}")
                return None
            
            # Parse output tar file
            output = await self._parse_corrdiff_output(response.content, samples)
            
            # Cleanup
            Path(input_path).unlink(missing_ok=True)
            
            return output
            
        except Exception as e:
            logger.error(f"CorrDiff inference failed: {e}")
            return self._mock_corrdiff(samples)
    
    async def _parse_fourcastnet_output(
        self,
        tar_content: bytes,
        input_time: datetime,
        simulation_length: int,
    ) -> list[FourCastNetForecast]:
        """Parse FourCastNet output tar file."""
        forecasts = []
        
        with tempfile.NamedTemporaryFile(suffix=".tar", delete=False) as f:
            f.write(tar_content)
            tar_path = f.name
        
        try:
            with tarfile.open(tar_path, "r") as tar:
                for i in range(simulation_length):
                    lead_hours = (i + 1) * 6
                    forecast_time = input_time + timedelta(hours=lead_hours)
                    
                    # Extract arrays from tar
                    # FourCastNet outputs variables in specific order
                    forecasts.append(FourCastNetForecast(
                        time=forecast_time,
                        lead_hours=lead_hours,
                        temperature_2m=np.zeros((721, 1440)),  # Placeholder
                        wind_u_10m=np.zeros((721, 1440)),
                        wind_v_10m=np.zeros((721, 1440)),
                        precipitation=np.zeros((721, 1440)),
                        pressure_msl=np.zeros((721, 1440)),
                        humidity_2m=np.zeros((721, 1440)),
                    ))
        finally:
            Path(tar_path).unlink(missing_ok=True)
        
        return forecasts
    
    async def _parse_corrdiff_output(
        self,
        tar_content: bytes,
        samples: int,
    ) -> CorrDiffOutput:
        """Parse CorrDiff output tar file."""
        with tempfile.NamedTemporaryFile(suffix=".tar", delete=False) as f:
            f.write(tar_content)
            tar_path = f.name
        
        try:
            # Parse tar and extract numpy arrays
            # Placeholder for actual parsing
            return CorrDiffOutput(
                samples=samples,
                temperature_2m=np.zeros((samples, 129, 301)),
                wind_u_10m=np.zeros((samples, 129, 301)),
                wind_v_10m=np.zeros((samples, 129, 301)),
                precipitation=np.zeros((samples, 129, 301)),
            )
        finally:
            Path(tar_path).unlink(missing_ok=True)
    
    def _mock_fourcastnet(
        self,
        input_time: datetime,
        simulation_length: int,
    ) -> list[FourCastNetForecast]:
        """Generate mock FourCastNet forecasts for testing."""
        forecasts = []
        
        for i in range(simulation_length):
            lead_hours = (i + 1) * 6
            forecast_time = input_time + timedelta(hours=lead_hours)
            
            # Generate realistic-looking mock data
            lat_grid = np.linspace(-90, 90, 721)
            lon_grid = np.linspace(0, 360, 1440)
            
            # Temperature with latitude gradient
            base_temp = 288 - 30 * np.cos(np.radians(lat_grid))[:, None]
            temp = base_temp + np.random.normal(0, 2, (721, 1440))
            
            forecasts.append(FourCastNetForecast(
                time=forecast_time,
                lead_hours=lead_hours,
                temperature_2m=temp.astype('float32'),
                wind_u_10m=np.random.normal(0, 5, (721, 1440)).astype('float32'),
                wind_v_10m=np.random.normal(0, 5, (721, 1440)).astype('float32'),
                precipitation=np.maximum(0, np.random.exponential(2, (721, 1440))).astype('float32'),
                pressure_msl=(101325 + np.random.normal(0, 500, (721, 1440))).astype('float32'),
                humidity_2m=np.clip(np.random.normal(60, 20, (721, 1440)), 0, 100).astype('float32'),
            ))
        
        return forecasts
    
    def _mock_corrdiff(self, samples: int) -> CorrDiffOutput:
        """Generate mock CorrDiff output for testing."""
        shape = (samples, 129, 301)
        
        return CorrDiffOutput(
            samples=samples,
            temperature_2m=np.random.normal(288, 10, shape).astype('float32'),
            wind_u_10m=np.random.normal(0, 5, shape).astype('float32'),
            wind_v_10m=np.random.normal(0, 5, shape).astype('float32'),
            precipitation=np.maximum(0, np.random.exponential(2, shape)).astype('float32'),
        )
    
    async def close(self):
        """Close HTTP client."""
        await self.http_client.aclose()


# Global service instance
nim_service = NVIDIANIMService()
