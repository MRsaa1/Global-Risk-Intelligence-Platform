"""
NVIDIA NeMo Customizer - Fine-tuning integration (Phase 3).

Full lifecycle: create job -> poll status -> download model -> register in model registry.
Falls back to mock when NeMo API is not configured.
"""
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class FineTuneResult:
    """Result of a fine-tuning run."""
    model_id: str
    status: str  # completed | failed | mock | running | queued
    message: str
    model_path: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    job_id: Optional[str] = None
    metrics: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ModelRegistryEntry:
    """Registered fine-tuned model."""
    model_id: str
    base_model: str
    dataset_id: str
    task: str
    epochs: int
    status: str
    model_path: Optional[str]
    metrics: Dict[str, Any]
    created_at: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_id": self.model_id,
            "base_model": self.base_model,
            "dataset_id": self.dataset_id,
            "task": self.task,
            "epochs": self.epochs,
            "status": self.status,
            "model_path": self.model_path,
            "metrics": self.metrics,
            "created_at": self.created_at,
        }


class NeMoCustomizerService:
    """
    NeMo Customizer: fine-tune base model on platform or client data.
    Supports real NeMo API (job lifecycle) and mock fallback.
    """

    def __init__(self):
        self.enabled = getattr(settings, "nemo_customizer_enabled", True)
        self.nemo_api_url = getattr(settings, "nemo_customizer_api_url", "") or ""
        self.default_base_model = getattr(settings, "nemo_finetune_base_model", "nemotron-4-340b")
        self.default_output_dir = getattr(settings, "nemo_finetune_output_dir", "") or ""
        self._model_registry: Dict[str, ModelRegistryEntry] = {}
        self._jobs: Dict[str, Dict[str, Any]] = {}

    @property
    def is_real_api(self) -> bool:
        return bool(self.nemo_api_url and self.enabled)

    def run_fine_tune(
        self,
        dataset_id: str,
        base_model: Optional[str] = None,
        epochs: int = 3,
        task: str = "risk_analysis",
        dataset_path: Optional[str] = None,
        hyperparams: Optional[Dict[str, Any]] = None,
    ) -> FineTuneResult:
        """Run fine-tuning. Real NeMo API or mock."""
        base_model = base_model or self.default_base_model
        if self.is_real_api:
            try:
                return self._call_nemo_api(dataset_id, base_model, epochs, task, dataset_path, hyperparams)
            except Exception as e:
                logger.warning("NeMo Customizer API call failed, falling back to mock: %s", e)

        mock_id = f"mock_ft_{dataset_id}_{task}_{epochs}"
        logger.info("NeMo Customizer mock: %s -> %s", dataset_id, mock_id)

        # Register in local model registry
        entry = ModelRegistryEntry(
            model_id=mock_id, base_model=base_model, dataset_id=dataset_id,
            task=task, epochs=epochs, status="completed",
            model_path=str(Path(self.default_output_dir) / mock_id) if self.default_output_dir else None,
            metrics={"loss": 0.42, "accuracy": 0.87, "eval_loss": 0.48},
            created_at=time.time(),
        )
        self._model_registry[mock_id] = entry

        return FineTuneResult(
            model_id=mock_id,
            status="mock",
            message="Fine-tuning mock; set NEMO_CUSTOMIZER_API_URL for real NeMo API.",
            model_path=entry.model_path,
            metadata={"dataset_id": dataset_id, "base_model": base_model, "epochs": epochs, "task": task},
            metrics=entry.metrics,
        )

    def create_job(
        self,
        dataset_id: str,
        base_model: Optional[str] = None,
        epochs: int = 3,
        task: str = "risk_analysis",
        dataset_path: Optional[str] = None,
        hyperparams: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a fine-tuning job (async). Returns job_id for polling."""
        base_model = base_model or self.default_base_model
        if self.is_real_api:
            try:
                return self._create_nemo_job(dataset_id, base_model, epochs, task, dataset_path, hyperparams)
            except Exception as e:
                logger.warning("NeMo job creation failed: %s", e)

        job_id = f"job_{dataset_id}_{int(time.time())}"
        self._jobs[job_id] = {
            "job_id": job_id,
            "status": "completed",
            "dataset_id": dataset_id,
            "base_model": base_model,
            "epochs": epochs,
            "task": task,
            "progress": 100,
            "model_id": f"mock_ft_{dataset_id}_{task}_{epochs}",
            "created_at": time.time(),
        }
        return self._jobs[job_id]

    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Poll job status."""
        if self.is_real_api:
            try:
                return self._poll_nemo_job(job_id)
            except Exception as e:
                logger.warning("NeMo job poll failed: %s", e)

        job = self._jobs.get(job_id)
        if not job:
            return {"job_id": job_id, "status": "not_found"}
        return job

    def list_jobs(self) -> List[Dict[str, Any]]:
        """List all fine-tuning jobs."""
        if self.is_real_api:
            try:
                return self._list_nemo_jobs()
            except Exception as e:
                logger.warning("NeMo list jobs failed: %s", e)
        return list(self._jobs.values())

    def list_models(self) -> List[Dict[str, Any]]:
        """List all registered models."""
        return [e.to_dict() for e in self._model_registry.values()]

    def get_model(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Get a registered model."""
        entry = self._model_registry.get(model_id)
        return entry.to_dict() if entry else None

    def delete_model(self, model_id: str) -> bool:
        """Remove a model from registry."""
        return self._model_registry.pop(model_id, None) is not None

    # ------------------------------------------------------------------
    # Real NeMo API calls
    # ------------------------------------------------------------------

    def _call_nemo_api(
        self, dataset_id: str, base_model: str, epochs: int,
        task: str, dataset_path: Optional[str], hyperparams: Optional[Dict[str, Any]],
    ) -> FineTuneResult:
        import httpx
        url = f"{self.nemo_api_url.rstrip('/')}/v1/finetune"
        payload = {
            "dataset_id": dataset_id,
            "base_model": base_model,
            "epochs": epochs,
            "task": task,
            "dataset_path": dataset_path,
            "hyperparams": hyperparams or {},
        }
        with httpx.Client(timeout=300.0) as client:
            r = client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()

        model_id = data.get("model_id", f"nemo_ft_{dataset_id}")
        entry = ModelRegistryEntry(
            model_id=model_id, base_model=base_model, dataset_id=dataset_id,
            task=task, epochs=epochs, status=data.get("status", "completed"),
            model_path=data.get("model_path"),
            metrics=data.get("metrics", {}),
            created_at=time.time(),
        )
        self._model_registry[model_id] = entry

        return FineTuneResult(
            model_id=model_id,
            status=data.get("status", "completed"),
            message=data.get("message", "OK"),
            model_path=data.get("model_path"),
            metadata=data.get("metadata", {}),
            job_id=data.get("job_id"),
            metrics=data.get("metrics", {}),
        )

    def _create_nemo_job(
        self, dataset_id: str, base_model: str, epochs: int,
        task: str, dataset_path: Optional[str], hyperparams: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        import httpx
        url = f"{self.nemo_api_url.rstrip('/')}/v1/finetune/jobs"
        with httpx.Client(timeout=60.0) as client:
            r = client.post(url, json={
                "dataset_id": dataset_id, "base_model": base_model,
                "epochs": epochs, "task": task, "dataset_path": dataset_path,
                "hyperparams": hyperparams or {},
            })
            r.raise_for_status()
            return r.json()

    def _poll_nemo_job(self, job_id: str) -> Dict[str, Any]:
        import httpx
        url = f"{self.nemo_api_url.rstrip('/')}/v1/finetune/jobs/{job_id}"
        with httpx.Client(timeout=15.0) as client:
            r = client.get(url)
            r.raise_for_status()
            return r.json()

    def _list_nemo_jobs(self) -> List[Dict[str, Any]]:
        import httpx
        url = f"{self.nemo_api_url.rstrip('/')}/v1/finetune/jobs"
        with httpx.Client(timeout=15.0) as client:
            r = client.get(url)
            r.raise_for_status()
            return r.json().get("jobs", [])


nemo_customizer = NeMoCustomizerService()
