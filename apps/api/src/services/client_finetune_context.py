"""
Client fine-tuning context for LLM prompts (Phase C3).

When use_client_finetune_model is enabled, call get_client_context_snippet()
and prepend to the system/user prompt so the agent responds with client context.
"""
import json
from pathlib import Path

from src.core.config import settings

_APP_ROOT = Path(__file__).resolve().parents[2]  # .../apps/api/src/services -> .../apps/api


def _settings_path() -> Path:
    out_dir = getattr(settings, "nemo_finetune_output_dir", "") or "data/finetune_output"
    return _APP_ROOT / out_dir / "agent_finetune_settings.json"


def get_client_context_snippet() -> str:
    """
    Return a short string to inject into the LLM prompt when client fine-tuned model is enabled.
    For mock: describes that responses are tailored to the client dataset/run.
    """
    p = _settings_path()
    if not p.exists():
        if getattr(settings, "use_client_finetune_model", False):
            return "Client context: Responses are tailored using the organization's fine-tuned model (see fine-tuning settings)."
        return ""
    try:
        with open(p) as f:
            s = json.load(f)
    except Exception:
        return ""
    if not s.get("use_client_finetune_model"):
        return ""
    run_id = s.get("active_run_id", "")
    path = s.get("client_model_path", "")
    if run_id:
        return f"Client context: Risk analysis is personalized using the client's fine-tuned model (run ID: {run_id}). Use organization-specific precedents and data where relevant."
    if path:
        return f"Client context: Risk analysis is personalized using the client model at {path}. Use organization-specific precedents and data where relevant."
    return "Client context: Responses are tailored using the organization's fine-tuned model (see fine-tuning settings)."
