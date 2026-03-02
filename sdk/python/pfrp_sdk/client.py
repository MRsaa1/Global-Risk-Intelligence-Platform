"""
PFRP Python SDK - Typed client for all API endpoints.
"""
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore


class _BaseResource:
    def __init__(self, client: "PFRPClient"):
        self._client = client

    def _get(self, path: str, params: Optional[Dict] = None) -> Any:
        return self._client._request("GET", path, params=params)

    def _post(self, path: str, json: Optional[Dict] = None) -> Any:
        return self._client._request("POST", path, json=json)

    def _patch(self, path: str, json: Optional[Dict] = None) -> Any:
        return self._client._request("PATCH", path, json=json)

    def _delete(self, path: str) -> Any:
        return self._client._request("DELETE", path)


class Assets(_BaseResource):
    def list(self, limit: int = 100, offset: int = 0) -> List[Dict]:
        return self._get("/api/v1/assets", params={"limit": limit, "offset": offset})

    def get(self, asset_id: str) -> Dict:
        return self._get(f"/api/v1/assets/{asset_id}")

    def create(self, data: Dict) -> Dict:
        return self._post("/api/v1/assets", json=data)


class StressTests(_BaseResource):
    def run(self, scenario_type: str, params: Optional[Dict] = None) -> Dict:
        return self._post("/api/v1/stress-tests/run", json={"scenario_type": scenario_type, "params": params or {}})

    def list_runs(self, limit: int = 50) -> List[Dict]:
        return self._get("/api/v1/stress-tests/runs", params={"limit": limit})


class PARS(_BaseResource):
    def export(self, limit: int = 10000) -> Dict:
        return self._get("/api/v1/pars/export/assets", params={"limit": limit})

    def validate(self, document: Dict) -> Dict:
        return self._post("/api/v1/pars/validate", json=document)

    def import_assets(self, items: List[Dict], upsert: bool = False) -> Dict:
        return self._post("/api/v1/pars/import", json={"items": items, "upsert": upsert})

    def schema(self) -> Dict:
        return self._get("/api/v1/pars/schema")


class SRS(_BaseResource):
    def list_funds(self, country_code: Optional[str] = None) -> List[Dict]:
        params = {}
        if country_code:
            params["country_code"] = country_code
        return self._get("/api/v1/srs/funds", params=params)

    def run_scenario(self, scenario_type: str, country_code: Optional[str] = None, params: Optional[Dict] = None) -> Dict:
        return self._post("/api/v1/srs/scenarios/run", json={
            "scenario_type": scenario_type, "country_code": country_code, "params": params,
        })

    def heatmap(self) -> List[Dict]:
        return self._get("/api/v1/srs/heatmap")


class FST(_BaseResource):
    def list_scenarios(self, category: Optional[str] = None) -> List[Dict]:
        params = {}
        if category:
            params["category"] = category
        return self._get("/api/v1/fst/scenarios", params=params)

    def run_scenario(self, scenario_id: str, regulatory_format: Optional[str] = None) -> Dict:
        return self._post("/api/v1/fst/scenarios/run", json={
            "scenario_id": scenario_id, "regulatory_format": regulatory_format,
        })

    def interbank_contagion(self, n_banks: int = 20, default_probability: float = 0.05) -> Dict:
        return self._post("/api/v1/fst/interbank-contagion", json={
            "n_banks": n_banks, "default_probability": default_probability,
        })


class Workflows(_BaseResource):
    def list_templates(self) -> Dict:
        return self._get("/api/v1/developer/workflows/templates")

    def start(self, template_id: str, context: Optional[Dict] = None) -> Dict:
        return self._post("/api/v1/developer/workflows/run", json={
            "template_id": template_id, "context": context,
        })

    def get_run(self, run_id: str) -> Dict:
        return self._get(f"/api/v1/developer/workflows/runs/{run_id}")


class PFRPClient:
    """Python SDK for the Physical-Financial Risk Platform."""

    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        token: Optional[str] = None,
        timeout: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.token = token
        self.timeout = timeout

        self.assets = Assets(self)
        self.stress_tests = StressTests(self)
        self.pars = PARS(self)
        self.srs = SRS(self)
        self.fst = FST(self)
        self.workflows = Workflows(self)

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        elif self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    def _request(self, method: str, path: str, **kwargs) -> Any:
        if httpx is None:
            raise ImportError("httpx is required: pip install httpx")
        url = f"{self.base_url}{path}"
        with httpx.Client(timeout=self.timeout) as client:
            r = client.request(method, url, headers=self._headers(), **kwargs)
            r.raise_for_status()
            return r.json()
