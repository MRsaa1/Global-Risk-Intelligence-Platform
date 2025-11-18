.PHONY: help install dev-install test lint format clean docker-build docker-up docker-down

help:
	@echo "Available commands:"
	@echo "  make install      - Install production dependencies"
	@echo "  make dev-install  - Install development dependencies"
	@echo "  make test         - Run tests"
	@echo "  make lint         - Run linters (black, ruff, mypy)"
	@echo "  make format       - Format code with black"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-up    - Start services with docker-compose"
	@echo "  make docker-down  - Stop services"

install:
	pip install --upgrade pip
	pip install -e .

dev-install:
	pip install --upgrade pip
	pip install -e ".[dev]"

test:
	pytest

lint:
	black --check .
	ruff check .
	mypy libs apps || true

format:
	black .
	ruff check --fix .

clean:
	rm -rf build/ dist/ *.egg-info .pytest_cache .mypy_cache .coverage htmlcov/
	find . -type d -name __pycache__ -exec rm -r {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete

docker-build:
	docker build -t global-risk-platform:latest .

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

