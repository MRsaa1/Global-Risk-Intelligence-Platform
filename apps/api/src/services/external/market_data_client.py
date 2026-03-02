"""
Fetch market data from Yahoo Finance chart API (no API key).
Used by market_data_job to broadcast VIX, S&P, HYG, LQD, 10Y, EUR/USD to WebSocket.
"""
import asyncio
from typing import Any, Dict

import httpx

BASE_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
BASE_QUOTE_URL = "https://query2.finance.yahoo.com/v7/finance/quote"
# Map frontend keys to Yahoo symbols
SYMBOLS = {
    "VIX": "^VIX",
    "SPX": "^GSPC",
    "HYG": "HYG",
    "LQD": "LQD",
    "10Y": "^TNX",
    "EURUSD": "EURUSD=X",
}
_LAST_GOOD_DATA: Dict[str, float] = {}


def _parse_last_close(resp: Dict[str, Any]) -> float | None:
    try:
        chart = resp.get("chart") or {}
        results = (chart.get("result") or [])
        if not results:
            return None
        quotes = (results[0].get("indicators") or {}).get("quote") or []
        if not quotes:
            return None
        close = quotes[0].get("close") or []
        for i in range(len(close) - 1, -1, -1):
            if close[i] is not None:
                return float(close[i])
        return None
    except (IndexError, KeyError, TypeError):
        return None


async def fetch_symbol(symbol: str, client: httpx.AsyncClient) -> float | None:
    url = f"{BASE_CHART_URL}/{symbol}"
    params = {"interval": "1d", "range": "5d"}
    try:
        r = await client.get(url, params=params, timeout=10.0)
        if r.status_code != 200:
            return None
        data = r.json()
        return _parse_last_close(data)
    except Exception:
        return None


def _parse_quote_prices(resp: Dict[str, Any]) -> Dict[str, float]:
    out: Dict[str, float] = {}
    try:
        results = ((resp.get("quoteResponse") or {}).get("result") or [])
        for row in results:
            if not isinstance(row, dict):
                continue
            symbol = row.get("symbol")
            price = row.get("regularMarketPrice")
            if isinstance(symbol, str) and isinstance(price, (int, float)):
                out[symbol] = float(price)
    except Exception:
        return {}
    return out


async def fetch_quotes_fallback(client: httpx.AsyncClient) -> Dict[str, float]:
    """Fetch prices using Yahoo quote endpoint (fallback when chart endpoint is empty)."""
    symbols_param = ",".join(SYMBOLS.values())
    try:
        r = await client.get(BASE_QUOTE_URL, params={"symbols": symbols_param}, timeout=10.0)
        if r.status_code != 200:
            return {}
        by_symbol = _parse_quote_prices(r.json())
        out: Dict[str, float] = {}
        for key, symbol in SYMBOLS.items():
            val = by_symbol.get(symbol)
            if isinstance(val, (int, float)):
                out[key] = float(val)
        return out
    except Exception:
        return {}


async def fetch_market_data() -> Dict[str, float]:
    """Fetch last close for VIX, SPX, HYG, LQD, 10Y, EUR/USD. Returns flat dict for WebSocket."""
    result: Dict[str, float] = {}
    async with httpx.AsyncClient(headers={"User-Agent": "global-risk-platform/1.0"}) as client:
        keys = list(SYMBOLS.keys())
        values = await asyncio.gather(
            *[fetch_symbol(SYMBOLS[k], client) for k in keys],
            return_exceptions=True,
        )
        for key, val in zip(keys, values):
            if isinstance(val, (int, float)) and val is not None:
                result[key] = float(val)
        if len(result) < len(keys):
            fallback = await fetch_quotes_fallback(client)
            for key, val in fallback.items():
                if key not in result and isinstance(val, (int, float)):
                    result[key] = float(val)
    if result:
        _LAST_GOOD_DATA.clear()
        _LAST_GOOD_DATA.update(result)
        return result
    if _LAST_GOOD_DATA:
        return dict(_LAST_GOOD_DATA)
    return result
