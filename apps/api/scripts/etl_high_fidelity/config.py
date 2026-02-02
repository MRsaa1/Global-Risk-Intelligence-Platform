"""
ETL High-Fidelity config: paths, bucket, scenario IDs.

Set via environment or override in code.
"""
import os
from pathlib import Path

# Output: local directory or S3 bucket prefix
HIGH_FIDELITY_STORAGE_PATH = os.environ.get("HIGH_FIDELITY_STORAGE_PATH", "")
HIGH_FIDELITY_S3_BUCKET = os.environ.get("HIGH_FIDELITY_S3_BUCKET", "")
HIGH_FIDELITY_S3_PREFIX = os.environ.get("HIGH_FIDELITY_S3_PREFIX", "high-fidelity")

# If storage path is relative, resolve against repo root (api parent)
if HIGH_FIDELITY_STORAGE_PATH and not Path(HIGH_FIDELITY_STORAGE_PATH).is_absolute():
    _api_root = Path(__file__).resolve().parents[2]
    HIGH_FIDELITY_STORAGE_PATH = str(_api_root / HIGH_FIDELITY_STORAGE_PATH)


def get_output_dir(scenario_id: str) -> Path:
    """Return local output directory for a scenario: {storage_path}/{scenario_id}/."""
    if not HIGH_FIDELITY_STORAGE_PATH:
        return Path(__file__).resolve().parents[2] / "data" / "high_fidelity" / scenario_id
    return Path(HIGH_FIDELITY_STORAGE_PATH) / scenario_id


def get_s3_key(scenario_id: str, filename: str) -> str:
    """Return S3 key for a scenario file: {prefix}/{scenario_id}/{filename}."""
    return f"{HIGH_FIDELITY_S3_PREFIX.rstrip('/')}/{scenario_id}/{filename}"
