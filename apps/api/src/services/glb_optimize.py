"""Run gltf-transform CLI to optimize GLB (optional; requires Node + @gltf-transform/cli)."""

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)


def optimize_glb_bytes(glb_bytes: bytes) -> bytes | None:
    """
    Run gltf-transform optimize on GLB bytes. Returns optimized bytes or None if unavailable.
    Requires: npx @gltf-transform/cli (Node.js) in PATH.
    """
    npx = shutil.which("npx")
    if not npx:
        logger.debug("glb_optimize: npx not found, skipping optimization")
        return None
    with tempfile.TemporaryDirectory() as td:
        inp = Path(td) / "input.glb"
        out = Path(td) / "output.glb"
        inp.write_bytes(glb_bytes)
        try:
            subprocess.run(
                [npx, "--yes", "@gltf-transform/cli", "optimize", str(inp), str(out)],
                capture_output=True,
                timeout=120,
                check=True,
            )
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as e:
            logger.warning("gltf-transform optimize failed: %s", e)
            return None
        if not out.is_file():
            return None
        return out.read_bytes()
