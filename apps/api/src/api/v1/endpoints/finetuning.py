"""
Fine-tuning under client data (Phase C3).

POST/GET datasets, POST run, GET/PUT settings.
"""
import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.models.client_finetune import ClientFinetuneDataset, ClientFinetuneRun
from src.services.nemo_customizer import nemo_customizer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fine-tuning", tags=["Agents - Fine-tuning"])

# App root (apps/api) for paths
_APP_ROOT = Path(__file__).resolve().parents[4]

def _settings_path() -> Path:
    out_dir = getattr(settings, "nemo_finetune_output_dir", "") or "data/finetune_output"
    return _APP_ROOT / out_dir / "agent_finetune_settings.json"


def _read_settings() -> dict:
    p = _settings_path()
    if not p.exists():
        return {
            "use_client_finetune_model": getattr(settings, "use_client_finetune_model", False),
            "client_model_path": getattr(settings, "client_model_path", "") or "",
            "active_run_id": "",
        }
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return {"use_client_finetune_model": False, "client_model_path": "", "active_run_id": ""}


def _write_settings(data: dict) -> None:
    p = _settings_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w") as f:
        json.dump(data, f, indent=2)


# ----- Schemas -----
class DatasetItem(BaseModel):
    id: str
    name: str
    path: str
    size: Optional[int]
    status: str
    created_at: Optional[str]


class RunRequest(BaseModel):
    dataset_id: str
    base_model: Optional[str] = None
    task: str = Field(default="risk_analysis", description="e.g. risk_analysis")


class RunResponse(BaseModel):
    id: str
    dataset_id: str
    status: str
    model_path_or_id: Optional[str]
    created_at: Optional[str]


class SettingsResponse(BaseModel):
    use_client_finetune_model: bool
    client_model_path: str
    active_run_id: str


class SettingsUpdate(BaseModel):
    use_client_finetune_model: Optional[bool] = None
    client_model_path: Optional[str] = None
    active_run_id: Optional[str] = None


# ----- Endpoints -----
@router.post("/datasets", response_model=DatasetItem)
async def create_dataset(
    file: Optional[UploadFile] = File(None),
    name: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a client dataset (JSON/CSV file) or create from JSON body.
    Saves to storage and creates client_finetune_datasets record.
    """
    datasets_dir = _APP_ROOT / "data" / "finetune" / "datasets"
    datasets_dir.mkdir(parents=True, exist_ok=True)

    dataset_id = str(uuid4())
    if file and file.filename:
        dest_dir = datasets_dir / dataset_id
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / (file.filename or "upload.json")
        size = 0
        try:
            with open(dest, "wb") as f:
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    f.write(chunk)
        except Exception as e:
            if dest.exists():
                shutil.rmtree(dest_dir, ignore_errors=True)
            raise HTTPException(status_code=500, detail="Upload failed: " + str(e))
        path = str(dest)
        name = name or file.filename or dataset_id
    else:
        path = str(datasets_dir / dataset_id)
        Path(path).mkdir(parents=True, exist_ok=True)
        size = 0
        name = name or dataset_id

    rec = ClientFinetuneDataset(
        id=dataset_id,
        name=name,
        path=path,
        size=size,
        status="ready",
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return DatasetItem(
        id=rec.id,
        name=rec.name,
        path=rec.path,
        size=rec.size,
        status=rec.status,
        created_at=rec.created_at.isoformat() if rec.created_at else None,
    )


@router.get("/datasets", response_model=List[DatasetItem])
async def list_datasets(db: AsyncSession = Depends(get_db)):
    """List all client fine-tuning datasets."""
    q = select(ClientFinetuneDataset).order_by(ClientFinetuneDataset.created_at.desc())
    r = await db.execute(q)
    rows = r.scalars().all()
    return [
        DatasetItem(
            id=x.id,
            name=x.name,
            path=x.path,
            size=x.size,
            status=x.status,
            created_at=x.created_at.isoformat() if x.created_at else None,
        )
        for x in rows
    ]


@router.post("/run", response_model=RunResponse)
async def run_finetune(
    body: RunRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Run fine-tuning pipeline for a dataset. Calls NeMo Customizer (or mock).
    Creates client_finetune_runs record and updates status to completed with model_path_or_id.
    """
    q = select(ClientFinetuneDataset).where(ClientFinetuneDataset.id == body.dataset_id)
    r = await db.execute(q)
    dataset = r.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    run_id = str(uuid4())
    run_rec = ClientFinetuneRun(
        id=run_id,
        dataset_id=body.dataset_id,
        status="training",
        model_path_or_id=None,
    )
    db.add(run_rec)
    await db.commit()

    result = nemo_customizer.run_fine_tune(
        dataset_id=body.dataset_id,
        base_model=body.base_model,
        epochs=3,
        task=body.task,
        dataset_path=dataset.path,
    )
    run_rec.status = "completed" if result.status in ("completed", "mock") else "failed"
    run_rec.model_path_or_id = result.model_path or result.model_id
    await db.commit()
    await db.refresh(run_rec)
    return RunResponse(
        id=run_rec.id,
        dataset_id=run_rec.dataset_id,
        status=run_rec.status,
        model_path_or_id=run_rec.model_path_or_id,
        created_at=run_rec.created_at.isoformat() if run_rec.created_at else None,
    )


@router.get("/settings", response_model=SettingsResponse)
async def get_finetune_settings():
    """Get current fine-tuning settings (active client model / run)."""
    s = _read_settings()
    return SettingsResponse(
        use_client_finetune_model=s.get("use_client_finetune_model", False),
        client_model_path=s.get("client_model_path", ""),
        active_run_id=s.get("active_run_id", ""),
    )


@router.put("/settings", response_model=SettingsResponse)
async def update_finetune_settings(body: SettingsUpdate):
    """Update fine-tuning settings (enable client model, set path or run_id)."""
    s = _read_settings()
    if body.use_client_finetune_model is not None:
        s["use_client_finetune_model"] = body.use_client_finetune_model
    if body.client_model_path is not None:
        s["client_model_path"] = body.client_model_path
    if body.active_run_id is not None:
        s["active_run_id"] = body.active_run_id
    _write_settings(s)
    return SettingsResponse(
        use_client_finetune_model=s.get("use_client_finetune_model", False),
        client_model_path=s.get("client_model_path", ""),
        active_run_id=s.get("active_run_id", ""),
    )
