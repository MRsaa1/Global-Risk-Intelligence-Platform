# Examples

This directory contains example scenarios and usage patterns for the Global Risk Platform.

## Scenario Examples

### Basic Scenarios

- **simple_basel.yaml** - Simple Basel IV capital calculation
- **liquidity_stress.yaml** - Liquidity stress test (LCR/NSFR)
- **comprehensive_stress.yaml** - Multi-factor comprehensive stress scenario

## Usage

### Running a Scenario

```python
from libs.dsl_schema import ScenarioDSL
from apps.reg_calculator import DistributedCalculationEngine

# Load scenario
scenario = ScenarioDSL.from_yaml("examples/simple_basel.yaml")

# Execute
engine = DistributedCalculationEngine(backend="ray")
results = engine.execute(scenario, portfolio_id="demo_portfolio")

# View results
print(f"CET1 Ratio: {results['outputs']['basel_iv_calc']['cet1_ratio']:.2%}")
```

### Creating Custom Scenarios

1. Start with a template from this directory
2. Modify market shocks, regulatory rules, and calculation steps
3. Validate your scenario:

```python
scenario = ScenarioDSL.from_yaml("my_scenario.yaml")
errors = scenario.validate()
if errors:
    print("Validation errors:", errors)
```

### AI-Generated Scenarios

Use Scenario Studio to generate scenarios from natural language:

```python
from apps.scenario_studio import ScenarioGenerator

generator = ScenarioGenerator(openai_api_key="your-key")
scenario = generator.generate(
    description="200 bps interest rate shock with 10% equity decline",
    portfolio_id="demo_portfolio",
    jurisdiction=Jurisdiction.US_FED,
)
```

## Best Practices

1. **Version Control**: Always include version in scenario metadata
2. **Documentation**: Add clear descriptions for all shocks and rules
3. **Validation**: Always validate scenarios before execution
4. **Testing**: Test scenarios on small portfolios first
5. **Naming**: Use descriptive scenario IDs and names

