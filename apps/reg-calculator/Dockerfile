FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY pyproject.toml ./
COPY apps/reg-calculator/requirements-api.txt ./apps/reg-calculator/

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r apps/reg-calculator/requirements-api.txt

# Copy application code
COPY . .

# Set PYTHONPATH to include the project root
ENV PYTHONPATH=/app

# Default command - use secure version in production
# Set API_FILE environment variable to use secure version
CMD ["python", "/app/apps/reg-calculator/${API_FILE:-api_secure}.py"]

