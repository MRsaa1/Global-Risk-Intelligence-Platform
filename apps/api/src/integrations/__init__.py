"""
External system adapters for agentic orchestrator (Phase 5).
Secrets and URLs from config/env only; stubs when not configured.
"""
from src.integrations.base import ExternalSystemType, IntegrationResult
from src.integrations.jira import jira_create_issue
from src.integrations.servicenow import servicenow_create_incident

__all__ = [
    "ExternalSystemType",
    "IntegrationResult",
    "jira_create_issue",
    "servicenow_create_incident",
]
