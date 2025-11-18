"""
OpenTelemetry tracing setup.
"""

from typing import Optional
import structlog

logger = structlog.get_logger(__name__)

_tracer = None


def setup_tracing(service_name: str = "global-risk-platform", endpoint: Optional[str] = None):
    """
    Setup OpenTelemetry tracing.

    Args:
        service_name: Service name for tracing
        endpoint: OTLP endpoint (optional)
    """
    global _tracer

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource

        # Create resource
        resource = Resource.create({"service.name": service_name})

        # Setup tracer provider
        provider = TracerProvider(resource=resource)
        trace.set_tracer_provider(provider)

        # Add OTLP exporter if endpoint provided
        if endpoint:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

            otlp_exporter = OTLPSpanExporter(endpoint=endpoint)
            provider.add_span_processor(BatchSpanProcessor(otlp_exporter))

        _tracer = trace.get_tracer(service_name)
        logger.info("Tracing initialized", service_name=service_name)

    except ImportError:
        logger.warning("OpenTelemetry not available, tracing disabled")
        _tracer = None
    except Exception as e:
        logger.error("Failed to setup tracing", error=str(e))
        _tracer = None


def get_tracer():
    """Get tracer instance."""
    return _tracer


def trace_function(name: Optional[str] = None):
    """
    Decorator for tracing functions.

    Args:
        name: Optional span name
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            if _tracer:
                span_name = name or f"{func.__module__}.{func.__name__}"
                with _tracer.start_as_current_span(span_name):
                    return func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        return wrapper
    return decorator

