"""
Google BigQuery client for analytics, long-horizon reporting, and data sync.

Syncs stress test results, risk scores, and audit logs to BigQuery.
Falls back to mock when credentials are not configured.
"""
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.core.config import settings

logger = logging.getLogger(__name__)


class BigQueryClient:
    """Client for Google BigQuery operations."""

    def __init__(self):
        self.project_id = getattr(settings, "bigquery_project_id", "") or getattr(settings, "gcloud_project_id", "") or ""
        self.dataset_id = getattr(settings, "bigquery_dataset_id", "pfrp_analytics") or "pfrp_analytics"
        self.service_account_json = getattr(settings, "gcloud_service_account_json", "") or ""
        self._client = None

    @property
    def enabled(self) -> bool:
        return bool(self.project_id and self.service_account_json)

    def _get_client(self):
        if self._client:
            return self._client
        if not self.enabled:
            return None
        try:
            from google.cloud import bigquery
            from google.oauth2 import service_account
            creds = service_account.Credentials.from_service_account_file(self.service_account_json)
            self._client = bigquery.Client(project=self.project_id, credentials=creds)
            return self._client
        except Exception as e:
            logger.warning("BigQuery client init failed: %s", e)
            return None

    async def sync_stress_results(self, results: List[Dict[str, Any]], table: str = "stress_test_results") -> Dict[str, Any]:
        """Sync stress test results to BigQuery."""
        client = self._get_client()
        if not client:
            return {"status": "mock", "rows_synced": len(results), "note": "BigQuery not configured"}
        try:
            from google.cloud import bigquery
            table_ref = f"{self.project_id}.{self.dataset_id}.{table}"
            errors = client.insert_rows_json(table_ref, results)
            return {"status": "synced", "rows_synced": len(results), "errors": errors}
        except Exception as e:
            logger.warning("BigQuery sync failed: %s", e)
            return {"status": "error", "message": str(e)}

    async def sync_risk_scores(self, scores: List[Dict[str, Any]]) -> Dict[str, Any]:
        return await self.sync_stress_results(scores, table="risk_scores")

    async def sync_audit_logs(self, logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        return await self.sync_stress_results(logs, table="audit_logs")

    async def run_query(self, sql: str) -> Dict[str, Any]:
        """Run an analytics SQL query on BigQuery."""
        client = self._get_client()
        if not client:
            return {"status": "mock", "rows": [], "note": "BigQuery not configured"}
        try:
            query_job = client.query(sql)
            results = query_job.result()
            rows = [dict(row.items()) for row in results]
            return {"status": "completed", "rows": rows, "total_rows": len(rows)}
        except Exception as e:
            logger.warning("BigQuery query failed: %s", e)
            return {"status": "error", "message": str(e)}

    async def get_aggregation(self, metric: str = "risk_score", group_by: str = "country_code") -> Dict[str, Any]:
        """Pre-built analytics aggregation."""
        sql = f"""
        SELECT {group_by}, AVG({metric}) as avg_{metric}, COUNT(*) as count
        FROM `{self.project_id}.{self.dataset_id}.risk_scores`
        GROUP BY {group_by}
        ORDER BY avg_{metric} DESC
        LIMIT 100
        """
        return await self.run_query(sql)


bigquery_client = BigQueryClient()
