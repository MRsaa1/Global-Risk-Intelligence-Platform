"""
Entity Resolution - LEI/sanctions resolver and UBO graph builder.

Provides entity resolution capabilities for regulatory compliance,
sanctions screening, and ultimate beneficial owner (UBO) analysis.
"""

from libs.entity_resolution.resolver import EntityResolver
from libs.entity_resolution.sanctions import SanctionsChecker
from libs.entity_resolution.ubo import UBOGraphBuilder

__all__ = [
    "EntityResolver",
    "SanctionsChecker",
    "UBOGraphBuilder",
]

__version__ = "1.0.0"

