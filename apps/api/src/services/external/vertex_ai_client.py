"""
Google Vertex AI client for ML model training and inference.

PD/LGD prediction, anomaly detection, climate risk forecasting.
Falls back to mock predictions when credentials are not configured.
"""
import logging
import math
import random
from typing import Any, Dict, List, Optional

from src.core.config import settings

logger = logging.getLogger(__name__)


class VertexAIClient:
    """Client for Google Vertex AI operations."""

    def __init__(self):
        self.project_id = getattr(settings, "gcloud_project_id", "") or ""
        self.region = getattr(settings, "vertex_ai_region", "us-central1") or "us-central1"
        self.service_account_json = getattr(settings, "gcloud_service_account_json", "") or ""
        self._initialized = False

    @property
    def enabled(self) -> bool:
        return bool(self.project_id and self.service_account_json)

    def _initialize(self):
        if self._initialized:
            return True
        if not self.enabled:
            return False
        try:
            import google.cloud.aiplatform as aip
            aip.init(project=self.project_id, location=self.region)
            self._initialized = True
            return True
        except Exception as e:
            logger.warning("Vertex AI init failed: %s", e)
            return False

    async def predict_pd_lgd(
        self,
        asset_features: Dict[str, Any],
        model_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Predict PD (probability of default) and LGD (loss given default)."""
        if self._initialize() and model_id:
            try:
                import google.cloud.aiplatform as aip
                endpoint = aip.Endpoint(model_id)
                prediction = endpoint.predict(instances=[asset_features])
                return {
                    "source": "vertex_ai",
                    "model_id": model_id,
                    "predictions": prediction.predictions,
                }
            except Exception as e:
                logger.warning("Vertex AI PD/LGD prediction failed: %s", e)

        # Mock prediction based on features
        valuation = asset_features.get("current_valuation", 1e6)
        climate_risk = asset_features.get("climate_risk_score", 30)
        year_built = asset_features.get("year_built", 2000)

        age_factor = max(0, (2025 - year_built) / 100)
        pd_1y = min(1.0, max(0.001, 0.01 + climate_risk / 1000 + age_factor * 0.05 + random.gauss(0, 0.005)))
        lgd = min(1.0, max(0.1, 0.4 + climate_risk / 500 + random.gauss(0, 0.05)))
        expected_loss = valuation * pd_1y * lgd

        return {
            "source": "mock_model",
            "pd_1y": round(pd_1y, 6),
            "lgd": round(lgd, 4),
            "expected_loss_usd": round(expected_loss, 2),
            "confidence": 0.75,
            "note": "Set GCLOUD_PROJECT_ID for Vertex AI predictions",
        }

    async def detect_anomalies(
        self,
        time_series: List[float],
        threshold: float = 2.5,
    ) -> Dict[str, Any]:
        """Detect anomalies in a time series using z-score method (or Vertex AI model)."""
        if not time_series:
            return {"anomalies": [], "count": 0}

        mean = sum(time_series) / len(time_series)
        std = math.sqrt(sum((x - mean) ** 2 for x in time_series) / len(time_series))
        if std == 0:
            return {"anomalies": [], "count": 0}

        anomalies = []
        for i, val in enumerate(time_series):
            z = abs((val - mean) / std)
            if z > threshold:
                anomalies.append({"index": i, "value": val, "z_score": round(z, 2)})

        return {
            "anomalies": anomalies,
            "count": len(anomalies),
            "mean": round(mean, 4),
            "std": round(std, 4),
            "threshold": threshold,
        }

    async def train_model(
        self,
        dataset_uri: str,
        model_type: str = "pd_lgd",
        display_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Train a model on Vertex AI (or return mock result)."""
        if self._initialize():
            try:
                import google.cloud.aiplatform as aip
                display_name = display_name or f"pfrp_{model_type}_{int(random.random() * 1e6)}"
                # AutoML tabular training
                dataset = aip.TabularDataset(dataset_uri)
                job = aip.AutoMLTabularTrainingJob(
                    display_name=display_name,
                    optimization_prediction_type="regression" if model_type == "pd_lgd" else "classification",
                )
                model = job.run(dataset=dataset, target_column="target")
                return {
                    "source": "vertex_ai",
                    "model_id": model.resource_name,
                    "display_name": display_name,
                    "status": "completed",
                }
            except Exception as e:
                logger.warning("Vertex AI training failed: %s", e)

        return {
            "source": "mock",
            "model_id": f"mock_model_{model_type}_{int(random.random() * 1e6)}",
            "display_name": display_name or f"pfrp_{model_type}",
            "status": "mock_completed",
            "metrics": {"rmse": 0.032, "mae": 0.021, "r2": 0.89},
            "note": "Set GCLOUD_PROJECT_ID for real Vertex AI training",
        }

    async def list_models(self) -> List[Dict[str, Any]]:
        """List registered models."""
        if self._initialize():
            try:
                import google.cloud.aiplatform as aip
                models = aip.Model.list()
                return [
                    {"model_id": m.resource_name, "display_name": m.display_name, "create_time": str(m.create_time)}
                    for m in models[:20]
                ]
            except Exception as e:
                logger.warning("Vertex AI list models failed: %s", e)

        return [
            {"model_id": "mock_pd_lgd_v1", "display_name": "PD/LGD Model v1", "status": "mock"},
            {"model_id": "mock_anomaly_v1", "display_name": "Anomaly Detection v1", "status": "mock"},
        ]


vertex_ai_client = VertexAIClient()
