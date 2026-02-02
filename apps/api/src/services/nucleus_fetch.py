"""Fetch USD bytes from various sources (enterprise-friendly).

Supported sources:
- MinIO object storage: "bucket/object"
- Local filesystem (dev): "/path/to/file.usd"
- Nucleus mounted filesystem (enterprise): NUCLEUS_MOUNT_DIR + "/Library/..." or "/Projects/..."
- Omniverse client URLs: "omniverse://..." (if omni.client is installed)
"""

from __future__ import annotations

from pathlib import Path

from src.core.config import settings
from src.core.storage import storage


class NucleusFetchError(RuntimeError):
    pass


def _read_from_mounted_nucleus(usd_path: str) -> bytes:
    mount = (getattr(settings, "nucleus_mount_dir", "") or "").strip()
    if not mount:
        raise NucleusFetchError("NUCLEUS_MOUNT_DIR is not configured")
    # map /Library/... -> <mount>/Library/...
    rel = usd_path.lstrip("/")
    p = Path(mount) / rel
    return p.read_bytes()


def _read_from_omniverse_client(url: str) -> bytes:
    try:
        import omni.client  # type: ignore
    except Exception as e:
        raise NucleusFetchError(f"omni.client is not available: {e}")

    # omni.client reads to a bytes object via read_file
    result, data = omni.client.read_file(url)
    if result != omni.client.Result.OK:
        raise NucleusFetchError(f"omni.client.read_file failed: {result}")
    return bytes(data)


def fetch_usd_bytes(usd_path: str) -> bytes:
    usd_path = (usd_path or "").strip()
    if not usd_path:
        raise NucleusFetchError("usd_path is empty")

    # Omniverse URL
    if usd_path.startswith("omniverse://"):
        return _read_from_omniverse_client(usd_path)

    # Nucleus “logical” paths that should be mapped to a mount
    if usd_path.startswith(getattr(settings, "nucleus_library_root", "/Library")) or usd_path.startswith(
        getattr(settings, "nucleus_projects_root", "/Projects")
    ):
        return _read_from_mounted_nucleus(usd_path)

    # Object storage bucket/object
    if "/" in usd_path and not usd_path.startswith(("http://", "https://")) and not usd_path.startswith(("/", "./")):
        bucket, obj = usd_path.split("/", 1)
        return storage.download_file(bucket, obj)

    # Local file path
    if usd_path.startswith(("/", "./")):
        return Path(usd_path).expanduser().read_bytes()

    raise NucleusFetchError(
        "Unsupported usd_path. Expected omniverse:// URL, /Library or /Projects (with mount), bucket/object, or local path."
    )

