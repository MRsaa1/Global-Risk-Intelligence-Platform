"""Jira adapter stub — create issue. Credentials from config only."""
from __future__ import annotations

import logging
from typing import Optional

from src.core.config import get_settings
from src.integrations.base import IntegrationResult

logger = logging.getLogger(__name__)


async def jira_create_issue(
    summary: str,
    description: str = "",
    project: str = "RISK",
    issue_type: str = "Task",
) -> IntegrationResult:
    """
    Create a Jira issue. Stub: when JIRA_BASE_URL / JIRA_API_TOKEN are not set,
    returns a no-op result. Real implementation would use Atlassian REST API.
    """
    settings = get_settings()
    if not (settings.jira_base_url and settings.jira_api_token):
        logger.debug("Jira not configured; skipping create_issue")
        return IntegrationResult(
            success=False,
            message="Jira not configured. Set JIRA_BASE_URL and JIRA_API_TOKEN.",
        )
    # TODO: real implementation — requests/aiohttp to rest/api/3/issue
    # auth = (email, api_token), JSON body: { fields: { project: { key }, summary, description, issuetype: { name } } }
    return IntegrationResult(
        success=True,
        message=f"Stub: would create Jira issue in project {project}: {summary[:80]}",
        external_id=f"{project}-STUB",
        details={"summary": summary, "project": project},
    )
