"""
OpenTelemetry tracing setup.

When OTEL_EXPORTER_OTLP_ENDPOINT is set, exports traces to OTLP.
Otherwise no exporter is configured (spans are created but not sent).
Structlog can include trace_id/span_id when present (see main.py).
"""
import os
import logging

logger = logging.getLogger(__name__)


def setup_tracing(service_name: str = "pfrp-api") -> bool:
    """
    Initialize OpenTelemetry and instrument FastAPI.
    Returns True if tracing was configured, False otherwise.
    """
    otel_endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    if not otel_endpoint:
        logger.info("OpenTelemetry: OTEL_EXPORTER_OTLP_ENDPOINT not set, tracing disabled")
        return False

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource
    except ImportError as e:
        logger.warning("OpenTelemetry packages not installed, tracing disabled: %s", e)
        return False

    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)

    logger.info("OpenTelemetry tracing enabled, OTLP endpoint=%s", otel_endpoint)
    return True


def instrument_fastapi(app):
    """Instrument FastAPI app with OpenTelemetry (no-op if not configured)."""
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        FastAPIInstrumentor.instrument_app(app)
        return True
    except ImportError:
        return False
