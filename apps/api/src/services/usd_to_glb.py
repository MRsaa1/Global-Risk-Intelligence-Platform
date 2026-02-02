"""USD(OpenUSD) → GLB conversion helper.

We keep this as an optional capability:
- In dev/demo, it can run if `usd2gltf` (and `usd-core`) are installed.
- In enterprise, conversion can be performed by an Omniverse/Kit worker
  and the resulting GLB stored in object storage.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path


class UsdToGlbUnavailable(RuntimeError):
    pass


def ensure_usd2gltf_available() -> str:
    """Return resolved usd2gltf executable path or raise."""
    exe = shutil.which("usd2gltf")
    if not exe:
        raise UsdToGlbUnavailable(
            "usd2gltf is not installed/available in PATH. "
            "Install it (and usd-core) in the API environment to enable USD→GLB conversion."
        )
    return exe


def convert_usd_bytes_to_glb(usd_bytes: bytes, usd_ext: str = ".usd") -> bytes:
    """Convert a USD file (bytes) to GLB (bytes) using usd2gltf CLI."""
    exe = ensure_usd2gltf_available()
    usd_ext = usd_ext if usd_ext.startswith(".") else f".{usd_ext}"
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        in_path = td_path / f"input{usd_ext}"
        out_path = td_path / "output.glb"
        in_path.write_bytes(usd_bytes)

        # usd2gltf -i INPUT -o OUTPUT
        proc = subprocess.run(
            [exe, "-i", str(in_path), "-o", str(out_path)],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            raise RuntimeError(
                "usd2gltf failed\n"
                f"stdout:\n{proc.stdout}\n\n"
                f"stderr:\n{proc.stderr}\n"
            )
        return out_path.read_bytes()

