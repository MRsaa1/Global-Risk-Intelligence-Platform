"""
Regulatory Rules Engine - Basel/FRTB/IRRBB/LCR rules-as-code.

This module provides the rules engine for regulatory calculations
with support for multiple jurisdictions and hot-switchable rule sets.
"""

from libs.reg_rules.engine import RulesEngine
from libs.reg_rules.rules import (
    BaselIVRule,
    FRTBRule,
    IRRBBRule,
    LCRRule,
    NSFRRule,
    CECLRule,
    IFRS9Rule,
)

__all__ = [
    "RulesEngine",
    "BaselIVRule",
    "FRTBRule",
    "IRRBBRule",
    "LCRRule",
    "NSFRRule",
    "CECLRule",
    "IFRS9Rule",
]

__version__ = "1.0.0"

