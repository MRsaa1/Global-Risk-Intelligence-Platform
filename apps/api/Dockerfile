FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libgeos-dev \
    libproj-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY apps/api/pyproject.toml .
RUN pip install --no-cache-dir -e .

# Copy application
COPY apps/api/src ./src

# Expose port
EXPOSE 9002

# Run
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "9002"]
