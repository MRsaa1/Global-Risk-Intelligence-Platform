"""
Middleware for System Overseer - tracks every API request.
"""
import time
from collections import defaultdict
from typing import Dict, Any
from fastapi import Request
import logging

logger = logging.getLogger(__name__)

# In-memory storage for endpoint metrics (in production, use Redis or database)
_endpoint_metrics: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
    "count": 0,
    "total_duration_ms": 0.0,
    "success_count": 0,
    "error_count": 0,
    "status_codes": defaultdict(int),
    "last_request": None,
    "avg_duration_ms": 0.0,
    "error_rate": 0.0,
})


async def oversee_middleware(request: Request, call_next):
    """
    Track every API request for System Overseer.
    
    Records:
    - Endpoint path and method
    - Response status code
    - Duration in milliseconds
    - Success/error status
    - Prometheus metrics (http_requests_total, http_request_duration_seconds)
    """
    # Skip health checks, docs and static files (do NOT include bare "/" — every path starts with it)
    if request.url.path.startswith(("/health", "/docs", "/openapi", "/favicon", "/metrics", "/metrics/json")):
        return await call_next(request)
    
    start_time = time.time()
    endpoint = f"{request.method} {request.url.path}"
    
    try:
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000
        duration_sec = duration_ms / 1000.0
        status_code = response.status_code
        is_success = 200 <= status_code < 400
        
        # Prometheus metrics
        try:
            from src.core.metrics import record_request
            record_request(request.method, request.url.path, status_code, duration_sec)
        except Exception:
            pass
        
        # Record metrics
        metrics = _endpoint_metrics[endpoint]
        metrics["count"] += 1
        metrics["total_duration_ms"] += duration_ms
        metrics["status_codes"][status_code] += 1
        metrics["last_request"] = time.time()
        
        if is_success:
            metrics["success_count"] += 1
        else:
            metrics["error_count"] += 1
        
        # Calculate averages
        if metrics["count"] > 0:
            metrics["avg_duration_ms"] = metrics["total_duration_ms"] / metrics["count"]
            metrics["error_rate"] = metrics["error_count"] / metrics["count"]
        
        # Add header
        response.headers["X-Process-Time"] = f"{duration_ms:.2f}"
        
        return response
        
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        duration_sec = duration_ms / 1000.0
        status_code = 500
        
        # Prometheus metrics
        try:
            from src.core.metrics import record_request
            record_request(request.method, request.url.path, status_code, duration_sec)
        except Exception:
            pass
        
        # Record error
        metrics = _endpoint_metrics[endpoint]
        metrics["count"] += 1
        metrics["total_duration_ms"] += duration_ms
        metrics["status_codes"][status_code] += 1
        metrics["error_count"] += 1
        metrics["last_request"] = time.time()
        
        if metrics["count"] > 0:
            metrics["avg_duration_ms"] = metrics["total_duration_ms"] / metrics["count"]
            metrics["error_rate"] = metrics["error_count"] / metrics["count"]
        
        logger.error("Overseer middleware: endpoint %s failed: %s", endpoint, e)
        raise


def get_endpoint_metrics() -> Dict[str, Dict[str, Any]]:
    """Get current endpoint metrics for System Overseer."""
    # Convert defaultdict to regular dict for JSON serialization
    result = {}
    for endpoint, metrics in _endpoint_metrics.items():
        result[endpoint] = {
            "count": metrics["count"],
            "avg_duration_ms": round(metrics["avg_duration_ms"], 2),
            "error_rate": round(metrics["error_rate"], 4),
            "success_count": metrics["success_count"],
            "error_count": metrics["error_count"],
            "status_codes": dict(metrics["status_codes"]),
            "last_request": metrics["last_request"],
        }
    return result


def reset_endpoint_metrics():
    """Reset endpoint metrics (for testing or periodic cleanup)."""
    global _endpoint_metrics
    _endpoint_metrics.clear()
