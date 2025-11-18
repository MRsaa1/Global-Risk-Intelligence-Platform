"""
Observability setup for reg-calculator.
"""

from libs.observability import setup_logging, setup_tracing, register_metrics, get_metrics_collector
import os

# Setup logging
setup_logging(
    level=os.getenv("LOG_LEVEL", "INFO"),
    json_output=os.getenv("LOG_JSON", "false").lower() == "true",
)

# Setup tracing
setup_tracing(
    service_name="reg-calculator",
    endpoint=os.getenv("OTLP_ENDPOINT"),
)

# Register metrics
register_metrics()

# Export metrics collector for use in API
metrics_collector = get_metrics_collector()

