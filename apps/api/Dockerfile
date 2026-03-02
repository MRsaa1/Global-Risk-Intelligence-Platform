FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    libpq-dev \
    libgeos-dev \
    libproj-dev \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/pyproject.toml .
RUN pip install --no-cache-dir -e .
RUN pip install --no-cache-dir aiosqlite email-validator scipy networkx

COPY apps/api/src ./src
COPY apps/api/alembic ./alembic
COPY apps/api/alembic.ini .
COPY apps/api/data ./data

EXPOSE 9002

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:9002/api/v1/health || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "9002", "--timeout-keep-alive", "120"]
