"""Tests for Agent OS: workflows, shared context, templates."""
import pytest


class TestWorkflowTemplates:
    def test_builtin_templates(self):
        from src.services.agent_os import workflow_executor
        templates = workflow_executor.list_templates()
        assert len(templates) >= 4
        ids = [t["id"] for t in templates]
        assert "report_workflow" in ids
        assert "assessment_workflow" in ids
        assert "remediation_workflow" in ids
        assert "stress_test_workflow" in ids

    def test_get_template(self):
        from src.services.agent_os import workflow_executor
        t = workflow_executor.get_template("report_workflow")
        assert t is not None
        assert len(t.steps) == 5
        assert t.steps[0].agent == "SENTINEL"

    def test_template_not_found(self):
        from src.services.agent_os import workflow_executor
        assert workflow_executor.get_template("nonexistent") is None


class TestWorkflowExecution:
    @pytest.mark.asyncio
    async def test_run_workflow(self):
        from src.services.agent_os import workflow_executor
        run = await workflow_executor.start_workflow("assessment_workflow", {"asset_id": "test"})
        assert run.status == "completed"
        assert len(run.steps_completed) == 3
        assert len(run.steps_failed) == 0

    @pytest.mark.asyncio
    async def test_run_with_invalid_template(self):
        from src.services.agent_os import workflow_executor
        with pytest.raises(ValueError):
            await workflow_executor.start_workflow("nonexistent")


class TestSharedContext:
    def test_set_and_get(self):
        from src.services.agent_os import SharedContextStore
        store = SharedContextStore()
        store.set("wf1", "key1", {"data": 42})
        assert store.get("wf1", "key1") == {"data": 42}

    def test_get_all(self):
        from src.services.agent_os import SharedContextStore
        store = SharedContextStore()
        store.set("wf2", "a", 1)
        store.set("wf2", "b", 2)
        all_ctx = store.get_all("wf2")
        assert all_ctx["a"] == 1
        assert all_ctx["b"] == 2

    def test_delete(self):
        from src.services.agent_os import SharedContextStore
        store = SharedContextStore()
        store.set("wf3", "key", "val")
        store.delete("wf3")
        assert store.get("wf3", "key") is None


class TestDeveloperEndpoints:
    def test_workflow_templates_api(self):
        from conftest import get_client
        client = get_client()
        r = client.get("/api/v1/developer/workflows/templates")
        assert r.status_code == 200
        assert len(r.json()["templates"]) >= 4

    def test_webhook_events_api(self):
        from conftest import get_client
        client = get_client()
        r = client.get("/api/v1/developer/webhook-events")
        assert r.status_code == 200
        assert len(r.json()["events"]) >= 5
