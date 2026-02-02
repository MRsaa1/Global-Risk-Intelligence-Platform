"""Extract metadata from GLB bytes (e.g. triangle/poly count) without full glTF parse."""

import json
import struct
from typing import Any

# GLB header: magic (4), version (4), length (4)
GLB_MAGIC = 0x46546C67  # "glTF" in little-endian
GLB_CHUNK_JSON = 0x4E4F534A  # "JSON" in ASCII as uint32 LE
GLB_CHUNK_BIN = 0x004E4942   # "BIN\0" in ASCII as uint32 LE


def _read_glb_json(data: bytes) -> dict[str, Any] | None:
    """Read the JSON chunk from a GLB buffer. Returns None if invalid."""
    if len(data) < 12:
        return None
    magic, version, length = struct.unpack("<III", data[:12])
    if magic != GLB_MAGIC or length != len(data):
        return None
    offset = 12
    while offset + 8 <= len(data):
        chunk_len, chunk_type = struct.unpack("<II", data[offset : offset + 8])
        offset += 8
        if offset + chunk_len > len(data):
            break
        if chunk_type == GLB_CHUNK_JSON:
            raw = data[offset : offset + chunk_len].decode("utf-8", errors="replace").strip()
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return None
        offset += chunk_len
    return None


def glb_triangle_count(glb_bytes: bytes) -> int | None:
    """
    Return total triangle count from GLB JSON (meshes -> primitives -> indices or POSITION count).
    Returns None if the file is not valid GLB or count cannot be determined.
    """
    doc = _read_glb_json(glb_bytes)
    if not doc:
        return None
    accessors = doc.get("accessors") or []
    meshes = doc.get("meshes") or []
    total = 0
    for mesh in meshes:
        for prim in mesh.get("primitives") or []:
            mode = prim.get("mode", 4)  # 4 = TRIANGLES
            if mode != 4:
                # Non-triangle primitive; could approximate or skip
                continue
            indices_acc = prim.get("indices")
            if indices_acc is not None and 0 <= indices_acc < len(accessors):
                acc = accessors[indices_acc]
                count = acc.get("count")
                if isinstance(count, int) and count >= 0:
                    total += count // 3
                continue
            pos_acc = (prim.get("attributes") or {}).get("POSITION")
            if pos_acc is not None and 0 <= pos_acc < len(accessors):
                acc = accessors[pos_acc]
                count = acc.get("count")
                if isinstance(count, int) and count >= 0:
                    total += count // 3
    return total if total > 0 else None
