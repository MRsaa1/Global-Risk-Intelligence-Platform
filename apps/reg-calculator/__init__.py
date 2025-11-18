"""
Regulatory Calculator - Distributed calculation engine.

Supports Ray and Dask backends for distributed computation
with content-addressable caching.
"""

from apps.reg_calculator.engine import DistributedCalculationEngine

__all__ = ["DistributedCalculationEngine"]

__version__ = "1.0.0"

