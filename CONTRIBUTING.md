# Contributing to PHYSICAL-FINANCIAL RISK PLATFORM

## Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker & Docker Compose
- Git

### Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd physical-financial-risk-platform

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Install Node dependencies
cd apps/api-gateway && npm install && cd ../..
cd apps/control-tower && npm install && cd ../..
```

### Running Locally

```bash
# Start infrastructure
docker-compose up -d

# Start services
./start-local.sh
```

## Code Standards

### Python
- Follow PEP 8
- Use type hints
- Format with Black
- Lint with Ruff
- Type check with mypy

### TypeScript/JavaScript
- Use TypeScript for new code
- Follow ESLint rules
- Format with Prettier

## Testing

```bash
# Run Python tests
pytest

# Run with coverage
pytest --cov

# Run TypeScript tests
cd apps/api-gateway && npm test
```

## Git Workflow

1. Create feature branch from `main`
2. Make changes
3. Write/update tests
4. Ensure all tests pass
5. Submit pull request

## Commit Messages

Use conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance
