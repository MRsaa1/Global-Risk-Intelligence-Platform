#!/usr/bin/env python3
"""
Run NeMo Customizer fine-tuning from config (Phase C2).

Reads config/nemo_finetune.yaml (or env), calls nemo_customizer.run_fine_tune,
writes result (model_id/path) to result_file for downstream use.

Usage (from apps/api):
  PYTHONPATH=src python -m scripts.run_nemo_finetune [--config config/nemo_finetune.yaml] [--dataset-id my_dataset]
"""
import argparse
import json
import sys
from pathlib import Path

_api_root = Path(__file__).resolve().parents[1]
_src = _api_root / "src"
if str(_api_root) not in sys.path:
    sys.path.insert(0, str(_api_root))
if str(_src) not in sys.path:
    sys.path.insert(0, str(_src))

import yaml

from src.services.nemo_customizer import nemo_customizer


def load_config(config_path: Path) -> dict:
    if not config_path.exists():
        return {}
    with open(config_path, "r") as f:
        return yaml.safe_load(f) or {}


def main() -> int:
    parser = argparse.ArgumentParser(description="Run NeMo Customizer fine-tuning")
    parser.add_argument("--config", type=Path, default=_api_root / "config" / "nemo_finetune.yaml", help="Path to nemo_finetune.yaml")
    parser.add_argument("--dataset-id", type=str, default="default", help="Dataset id (used for paths and result model_id)")
    parser.add_argument("--base-model", type=str, default=None, help="Override base_model from config")
    parser.add_argument("--epochs", type=int, default=None, help="Override epochs from config")
    parser.add_argument("--task", type=str, default=None, help="Override task from config")
    args = parser.parse_args()

    config = load_config(args.config)
    base_model = args.base_model or config.get("base_model", "nemotron-4-340b")
    epochs = args.epochs if args.epochs is not None else config.get("epochs", 3)
    task = args.task or config.get("task", "risk_analysis")
    datasets_cfg = config.get("datasets") or {}
    default_path = datasets_cfg.get("default_path", "data/finetune")
    dataset_path = datasets_cfg.get(args.dataset_id) or str(Path(_api_root) / default_path / args.dataset_id)
    output_dir = config.get("output_dir", "data/finetune_output")
    result_file = config.get("result_file") or str(Path(_api_root) / output_dir / "last_run.json")

    result = nemo_customizer.run_fine_tune(
        dataset_id=args.dataset_id,
        base_model=base_model,
        epochs=epochs,
        task=task,
        dataset_path=dataset_path,
    )

    out_path = Path(result_file)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "model_id": result.model_id,
        "status": result.status,
        "message": result.message,
        "model_path": result.model_path,
        "metadata": result.metadata,
    }
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)
    print("Fine-tune result: %s (status=%s)" % (result.model_id, result.status))
    print("Result written to %s" % out_path)
    return 0 if result.status in ("completed", "mock") else 1


if __name__ == "__main__":
    sys.exit(main())
