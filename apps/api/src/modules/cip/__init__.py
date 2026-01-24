"""CIP (Critical Infrastructure Protection) module.

This module provides tools for modeling, monitoring, and protecting critical infrastructure
assets including power grids, water systems, transportation networks, and communications.
"""
from .module import CIPModule
from .service import CIPService

__all__ = ["CIPModule", "CIPService"]
