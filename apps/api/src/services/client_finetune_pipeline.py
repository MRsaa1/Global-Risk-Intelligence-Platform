"""
Client data fine-tuning pipeline.

Dataset ingestion, validation, PII detection/anonymization,
model versioning, and A/B testing infrastructure.
"""
import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from uuid import uuid4

from src.services.nemo_customizer import nemo_customizer

logger = logging.getLogger(__name__)

# PII patterns for detection
PII_PATTERNS = {
    "email": re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"),
    "phone": re.compile(r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "credit_card": re.compile(r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"),
    "ip_address": re.compile(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b"),
}


@dataclass
class DatasetValidation:
    valid: bool
    total_records: int
    errors: List[str]
    warnings: List[str]
    pii_detected: Dict[str, int]
    quality_score: float  # 0-1


@dataclass
class ClientModel:
    model_id: str
    client_id: str
    version: str
    base_model: str
    dataset_id: str
    status: str
    metrics: Dict[str, Any]
    created_at: float
    is_active: bool = False


class ClientFineTunePipeline:
    """End-to-end client data fine-tuning pipeline."""

    def __init__(self):
        self._datasets: Dict[str, Dict[str, Any]] = {}
        self._models: Dict[str, ClientModel] = {}
        self._ab_tests: Dict[str, Dict[str, Any]] = {}

    # ------------------------------------------------------------------
    # Dataset management
    # ------------------------------------------------------------------

    def ingest_dataset(
        self,
        client_id: str,
        data: List[Dict[str, Any]],
        name: Optional[str] = None,
        format: str = "jsonl",
    ) -> Dict[str, Any]:
        """Ingest a client dataset for fine-tuning."""
        dataset_id = f"ds_{client_id}_{int(time.time())}"
        content_hash = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:16]

        self._datasets[dataset_id] = {
            "id": dataset_id,
            "client_id": client_id,
            "name": name or f"Dataset {dataset_id}",
            "format": format,
            "records": len(data),
            "content_hash": content_hash,
            "data": data,
            "created_at": time.time(),
            "status": "ingested",
        }

        return {
            "dataset_id": dataset_id,
            "records": len(data),
            "content_hash": content_hash,
            "status": "ingested",
        }

    def validate_dataset(self, dataset_id: str) -> DatasetValidation:
        """Validate dataset: schema check, PII detection, quality scoring."""
        ds = self._datasets.get(dataset_id)
        if not ds:
            return DatasetValidation(valid=False, total_records=0, errors=["Dataset not found"], warnings=[], pii_detected={}, quality_score=0)

        data = ds.get("data", [])
        errors: List[str] = []
        warnings: List[str] = []
        pii_counts: Dict[str, int] = {}

        for i, record in enumerate(data):
            if not isinstance(record, dict):
                errors.append(f"Record {i}: not a dict")
                continue
            # Check for PII in string values
            for key, val in record.items():
                if isinstance(val, str):
                    for pii_type, pattern in PII_PATTERNS.items():
                        if pattern.search(val):
                            pii_counts[pii_type] = pii_counts.get(pii_type, 0) + 1

        if pii_counts:
            warnings.append(f"PII detected: {pii_counts}")

        # Quality score
        completeness = sum(1 for r in data if isinstance(r, dict) and len(r) > 2) / max(len(data), 1)
        quality = min(1.0, completeness * (0.9 if not pii_counts else 0.6) * (1.0 if not errors else 0.5))

        ds["status"] = "validated"
        ds["quality_score"] = quality

        return DatasetValidation(
            valid=len(errors) == 0,
            total_records=len(data),
            errors=errors[:50],
            warnings=warnings,
            pii_detected=pii_counts,
            quality_score=round(quality, 3),
        )

    def anonymize_dataset(self, dataset_id: str) -> Dict[str, Any]:
        """Anonymize PII in dataset."""
        ds = self._datasets.get(dataset_id)
        if not ds:
            return {"error": "Dataset not found"}

        data = ds.get("data", [])
        anonymized_count = 0

        for record in data:
            if not isinstance(record, dict):
                continue
            for key, val in record.items():
                if isinstance(val, str):
                    for pii_type, pattern in PII_PATTERNS.items():
                        new_val = pattern.sub(f"[{pii_type.upper()}_REDACTED]", val)
                        if new_val != val:
                            record[key] = new_val
                            anonymized_count += 1
                            val = new_val

        ds["status"] = "anonymized"
        return {"dataset_id": dataset_id, "anonymized_fields": anonymized_count, "status": "anonymized"}

    # ------------------------------------------------------------------
    # Fine-tuning
    # ------------------------------------------------------------------

    def run_finetune(
        self,
        client_id: str,
        dataset_id: str,
        base_model: Optional[str] = None,
        epochs: int = 3,
        task: str = "risk_analysis",
    ) -> Dict[str, Any]:
        """Run fine-tuning for a client dataset."""
        ds = self._datasets.get(dataset_id)
        if not ds:
            return {"error": "Dataset not found"}

        result = nemo_customizer.run_fine_tune(
            dataset_id=dataset_id,
            base_model=base_model,
            epochs=epochs,
            task=task,
        )

        # Register model
        version = f"v{len([m for m in self._models.values() if m.client_id == client_id]) + 1}"
        model = ClientModel(
            model_id=result.model_id,
            client_id=client_id,
            version=version,
            base_model=base_model or "nemotron-4-340b",
            dataset_id=dataset_id,
            status=result.status,
            metrics=result.metrics,
            created_at=time.time(),
        )
        self._models[result.model_id] = model

        return {
            "model_id": result.model_id,
            "client_id": client_id,
            "version": version,
            "status": result.status,
            "metrics": result.metrics,
        }

    def list_models(self, client_id: Optional[str] = None) -> List[Dict[str, Any]]:
        models = list(self._models.values())
        if client_id:
            models = [m for m in models if m.client_id == client_id]
        return [
            {
                "model_id": m.model_id, "client_id": m.client_id,
                "version": m.version, "status": m.status,
                "is_active": m.is_active, "metrics": m.metrics,
                "created_at": m.created_at,
            }
            for m in sorted(models, key=lambda x: x.created_at, reverse=True)
        ]

    # ------------------------------------------------------------------
    # A/B testing
    # ------------------------------------------------------------------

    def create_ab_test(
        self,
        client_id: str,
        model_a_id: str,
        model_b_id: str,
        traffic_split: float = 0.5,
    ) -> Dict[str, Any]:
        """Create A/B test between two models."""
        test_id = f"ab_{str(uuid4())[:8]}"
        self._ab_tests[test_id] = {
            "id": test_id,
            "client_id": client_id,
            "model_a": model_a_id,
            "model_b": model_b_id,
            "traffic_split": traffic_split,
            "status": "running",
            "metrics_a": {"requests": 0, "avg_score": 0.0},
            "metrics_b": {"requests": 0, "avg_score": 0.0},
            "created_at": time.time(),
        }
        return self._ab_tests[test_id]

    def list_ab_tests(self, client_id: Optional[str] = None) -> List[Dict[str, Any]]:
        tests = list(self._ab_tests.values())
        if client_id:
            tests = [t for t in tests if t["client_id"] == client_id]
        return tests


client_finetune_pipeline = ClientFineTunePipeline()
