#!/usr/bin/env python3
"""
Strip null bytes from Alembic migration files.
Run from apps/api: python scripts/fix-migration-null-bytes.py
Use when alembic fails with: SyntaxError: source code string cannot contain null bytes
"""
import glob
import os

base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
versions_dir = os.path.join(base, "alembic", "versions")
fixed = 0
for path in sorted(glob.glob(os.path.join(versions_dir, "*.py"))):
    with open(path, "rb") as f:
        data = f.read()
    if b"\x00" in data:
        with open(path, "wb") as f:
            f.write(data.replace(b"\x00", b""))
        print("Fixed:", os.path.basename(path))
        fixed += 1
if fixed:
    print(f"Stripped null bytes from {fixed} file(s). Run: alembic upgrade head")
else:
    print("No null bytes found in migration files.")
