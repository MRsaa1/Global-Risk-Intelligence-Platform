# Quick Start Guide

## Installation

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker & Docker Compose
- Ray (for distributed calculations)

### Setup

1. **Clone and install Python dependencies:**

```bash
git clone https://github.com/global-risk-platform/global-risk-platform.git
cd global-risk-platform
pip install -e ".[dev]"
```

2. **Install Node.js dependencies:**

```bash
cd apps/api-gateway && npm install
cd ../control-tower && npm install
```

3. **Start infrastructure:**

```bash
# Start Redis and PostgreSQL
docker-compose up -d

# Start Ray cluster
ray start --head --port=6379
```

## Running Your First Calculation

### 1. Create a Scenario

Create a YAML file `my_scenario.yaml`:

```yaml
metadata:
  scenario_id: "my_first_scenario"
  name: "My First Stress Test"
  description: "Simple interest rate stress"

portfolio:
  portfolio_id: "demo_portfolio"
  as_of_date: "2024-01-15T00:00:00Z"

market_shocks:
  - type: interest_rate
    asset_class: "usd_rates"
    shock_value: 0.025
    shock_type: "absolute"
    description: "250 bps rate increase"

regulatory_rules:
  - framework: BASEL_IV
    jurisdiction: US_FED
    enabled: true

calculation_steps:
  - step_id: "basel_calc"
    step_type: "regulatory_calculation"
    inputs: []
    rule:
      framework: BASEL_IV
      jurisdiction: US_FED

outputs:
  - "basel_calc"
```

### 2. Execute the Scenario

```python
from libs.dsl_schema import ScenarioDSL
from apps.reg_calculator import DistributedCalculationEngine

# Load scenario
scenario = ScenarioDSL.from_yaml("my_scenario.yaml")

# Execute
engine = DistributedCalculationEngine(backend="ray")
results = engine.execute(scenario, portfolio_id="demo_portfolio")

print(results)
```

### 3. Using the API

Start the API gateway:

```bash
cd apps/api-gateway
npm run dev
```

Then make requests:

```bash
# Health check
curl http://localhost:8000/health

# Create scenario
curl -X POST http://localhost:8000/api/v1/scenarios \
  -H "Content-Type: application/json" \
  -d '{"scenario_id": "test", "name": "Test Scenario"}'
```

### 4. Using the UI

Start the Control Tower UI:

```bash
cd apps/control-tower
npm run dev
```

Open http://localhost:3000 in your browser.

## Next Steps

- Read the [Architecture Guide](ARCHITECTURE.md)
- Explore [Examples](../examples/)
- Check [API Documentation](API.md)

