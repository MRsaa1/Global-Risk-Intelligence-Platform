# Contributing to Global Risk Platform

Thank you for your interest in contributing to the Global Risk Platform!

## Development Workflow

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker & Docker Compose
- Kubernetes (for local testing)
- Ray cluster (for distributed calculations)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/global-risk-platform/global-risk-platform.git
cd global-risk-platform
```

2. Install Python dependencies:
```bash
pip install -e ".[dev]"
```

3. Install Node.js dependencies:
```bash
cd apps/api-gateway && npm install
cd ../control-tower && npm install
```

4. Start local services:
```bash
docker-compose up -d
ray start --head --port=6379
```

### Code Standards

#### Python

- Follow PEP 8 style guide
- Use type hints for all functions
- Maximum line length: 100 characters
- Use `black` for formatting
- Use `ruff` for linting
- Use `mypy` for type checking

```bash
# Format code
black .

# Lint
ruff check .

# Type check
mypy libs apps
```

#### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow ESLint rules
- Use Prettier for formatting
- Maximum line length: 100 characters

```bash
# Format
npm run format

# Lint
npm run lint
```

### Testing

All code must include tests:

```bash
# Run Python tests
pytest

# Run with coverage
pytest --cov=libs --cov=apps --cov-report=html
```

### Commit Messages

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Example:
```
feat(reg-rules): add FRTB IMA calculation support
```

### Pull Request Process

1. Create a feature branch from `develop`
2. Make your changes
3. Write/update tests
4. Ensure all tests pass
5. Update documentation if needed
6. Submit PR with clear description

### Security

- Never commit secrets or credentials
- Use environment variables for sensitive data
- Follow zero-trust security principles
- Report security issues to security@global-risk-intelligence.com

## Architecture Guidelines

- **Microservices**: Keep services independent and loosely coupled
- **Rules-as-code**: All regulatory rules must be versioned and testable
- **Deterministic**: All calculations must be reproducible
- **Observable**: Include logging, metrics, and tracing

## Questions?

Contact the platform team at platform-team@global-risk-intelligence.com

