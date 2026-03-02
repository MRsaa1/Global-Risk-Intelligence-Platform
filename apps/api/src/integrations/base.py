"""Base types for external system integrations (Jira, ServiceNow, etc.)."""
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional


class ExternalSystemType(str, Enum):
    JIRA = "jira"
    SERVICENOW = "servicenow"


@dataclass
class IntegrationResult:
    success: bool
    message: str
    external_id: Optional[str] = None  # e.g. Jira issue key, SN incident number
    details: Optional[Dict[str, Any]] = None
