"""
CLI entry point for reg-calculator.
"""

import sys
from pathlib import Path

from libs.dsl_schema import ScenarioDSL
from apps.reg_calculator.engine import DistributedCalculationEngine


def main():
    """Main CLI entry point."""
    if len(sys.argv) < 3:
        print("Usage: python -m apps.reg_calculator <scenario.yaml> <portfolio_id>")
        sys.exit(1)

    scenario_path = Path(sys.argv[1])
    portfolio_id = sys.argv[2]

    # Load scenario
    scenario = ScenarioDSL.from_yaml(str(scenario_path))

    # Execute
    engine = DistributedCalculationEngine(backend="ray")
    results = engine.execute(scenario, portfolio_id)

    # Print results
    import json

    print(json.dumps(results, indent=2, default=str))


if __name__ == "__main__":
    main()

