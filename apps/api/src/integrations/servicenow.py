"""ServiceNow adapter stub — create incident. Credentials from config only."""
from __future__ import annotations

import logging
from typing import Optional

from src.core.config import get_settings
from src.integrations.base import IntegrationResult

logger = logging.getLogger(__name__)


async def servicenow_create_incident(
    short_description: str,
    description: str = "",
    category: str = "Software",
    impact: Optional[str] = None,
) -> IntegrationResult:
    """
    Create a ServiceNow incident. Stub: when SERVICENOW_INSTANCE / SERVICENOW_PASSWORD
    are not set, returns a no-op result. Real implementation would use SN REST Table API.
    """
    settings = get_settings()
    if not (settings.servicenow_instance and settings.servicenow_password):
        logger.debug("ServiceNow not configured; skipping create_incident")
        return IntegrationResult(
            success=False,
            message="ServiceNow not configured. Set SERVICENOW_INSTANCE and SERVICENOW_PASSWORD.",
        )
    # TODO: real implementation — POST /api/now/table/incident with Basic auth
    return IntegrationResult(
        success=True,
        message=f"Stub: would create ServiceNow incident: {short_description[:80]}",
        external_id="INC0010001",
        details={"short_description": short_description, "category": category},
    )
