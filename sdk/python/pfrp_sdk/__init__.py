"""
PFRP SDK - Python client for the Physical-Financial Risk Platform API.

Usage:
    from pfrp_sdk import PFRPClient

    client = PFRPClient("https://api.example.com", api_key="pfrp_...")
    assets = client.assets.list()
    result = client.stress_tests.run("flood_scenario", {"severity": 0.8})
    export = client.pars.export()
"""

__version__ = "0.1.0"

from .client import PFRPClient

__all__ = ["PFRPClient"]
