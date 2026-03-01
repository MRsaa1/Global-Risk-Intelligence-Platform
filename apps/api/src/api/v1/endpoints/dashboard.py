"""
Dashboard API — RiskMirror (Today Card), Sentiment Meter, War Room Card.

- GET /dashboard/today-card: RiskMirror — one card "Today: focus X, risk Y, don't touch Z"
  enriched with signals from news (GDELT), climate, and market data + LLM synthesis.
- GET /dashboard/sentiment-meter: value 0–100, label panic|neutral|hype, main_reason.
- GET /dashboard/war-room-card: board-ready card — 3 risks, 3 actions, 1 priority for today.
"""
import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.asset import Asset
from src.models.stress_test import StressTest, StressTestStatus
from src.layers.agents.sentinel import sentinel_agent, AlertSeverity

router = APIRouter()
logger = logging.getLogger(__name__)


# ==================== SCHEMAS ====================


class SignalSource(BaseModel):
    """A single signal contributing to the RiskMirror card."""
    type: str = Field(description="news | climate | market | alert")
    headline: str = Field(description="Short signal summary")
    severity: str = Field(default="medium", description="low | medium | high | critical")


class TodayCardResponse(BaseModel):
    """RiskMirror: single board-ready card: focus, top risk, don't touch, main reason, morning brief."""
    focus: str = Field(description="Today's focus (e.g. active stress scenario name)")
    top_risk: str = Field(description="Top-1 risk (asset name or region)")
    top_risk_id: Optional[str] = None
    dont_touch: str = Field(description="One asset to avoid trading/rebalancing")
    dont_touch_id: Optional[str] = None
    main_reason: Optional[str] = Field(default=None, description="Main reason from alerts/headlines")
    morning_brief: Optional[str] = Field(default=None, description="LLM-synthesized 2-3 sentence morning brief")
    sources: List[str] = Field(default_factory=list, description="Data sources used: news, climate, market, alert")
    signals: List[SignalSource] = Field(default_factory=list, description="Individual signal items")


class WarRoomRisk(BaseModel):
    """Single risk item for the War Room Card."""
    name: str
    severity: str = Field(description="critical | high | medium | low")
    sector: str = Field(default="general")


class WarRoomAction(BaseModel):
    """Single action item for the War Room Card."""
    action: str
    priority: str = Field(description="immediate | short-term | medium-term")
    impact: str = Field(default="", description="Expected impact description")


class WarRoomCardResponse(BaseModel):
    """Board-ready War Room Card: 3 risks, 3 actions, 1 priority."""
    top_risks: List[WarRoomRisk] = Field(description="Top 3 risks")
    actions: List[WarRoomAction] = Field(description="Top 3 recommended actions")
    today_priority: dict = Field(description="{'title': str, 'reason': str}")
    generated_at: str = Field(description="ISO timestamp")
    data_sources: List[str] = Field(default_factory=list)


class SentimentMeterResponse(BaseModel):
    """Panic/Hype meter: 0=panic, 50=neutral, 100=hype + one main reason."""
    value: int = Field(ge=0, le=100, description="Meter value 0–100")
    label: str = Field(description="panic | neutral | hype")
    main_reason: str = Field(description="One-line explanation")


# ==================== HELPERS ====================


def _normalize_risk(val: float) -> float:
    if val is None:
        return 0.0
    v = float(val)
    if v < 2:
        return v * 100
    return v


async def _fetch_news_signals() -> List[SignalSource]:
    """Fetch top news signals from GDELT (non-blocking, graceful fallback)."""
    signals: List[SignalSource] = []
    try:
        from src.services.external.gdelt_client import gdelt_client
        result = await gdelt_client.doc_search(
            query="risk OR crisis OR disruption OR conflict OR disaster",
            max_records=10,
            timespan="1day",
        )
        if result.success and result.articles:
            sorted_articles = sorted(
                result.articles,
                key=lambda a: abs(a.tone or 0),
                reverse=True,
            )
            for article in sorted_articles[:3]:
                tone = article.tone or 0
                severity = "critical" if tone < -5 else "high" if tone < -2 else "medium"
                signals.append(SignalSource(
                    type="news",
                    headline=article.title[:200],
                    severity=severity,
                ))
    except Exception as e:
        logger.debug("RiskMirror: GDELT fetch failed: %s", e)
    return signals


async def _fetch_market_signals() -> List[SignalSource]:
    """Fetch market signals from Yahoo Finance (VIX, SPX)."""
    signals: List[SignalSource] = []
    try:
        from src.services.external.market_data_client import fetch_market_data
        data = await fetch_market_data()
        vix = data.get("VIX")
        spx = data.get("SPX")
        if vix is not None:
            if vix > 30:
                signals.append(SignalSource(type="market", headline=f"VIX at {vix:.1f} — extreme fear", severity="critical"))
            elif vix > 25:
                signals.append(SignalSource(type="market", headline=f"VIX at {vix:.1f} — elevated volatility", severity="high"))
            elif vix > 20:
                signals.append(SignalSource(type="market", headline=f"VIX at {vix:.1f} — above average", severity="medium"))
            else:
                signals.append(SignalSource(type="market", headline=f"VIX at {vix:.1f} — calm market", severity="low"))
        if spx is not None:
            signals.append(SignalSource(type="market", headline=f"S&P 500 at {spx:,.0f}", severity="low"))
    except Exception as e:
        logger.debug("RiskMirror: market data fetch failed: %s", e)
    return signals


async def _fetch_climate_signals(db: AsyncSession) -> List[SignalSource]:
    """Fetch climate signals for top portfolio cities."""
    signals: List[SignalSource] = []
    try:
        from src.services.climate_anomalies_service import climate_anomalies_service
        # Get distinct cities from active assets
        result = await db.execute(
            select(Asset.city, Asset.latitude, Asset.longitude)
            .where(Asset.status == "active")
            .where(Asset.city.is_not(None))
            .distinct()
            .limit(3)
        )
        cities = result.all()
        for city_row in cities:
            city_name = city_row.city
            lat = city_row.latitude
            lon = city_row.longitude
            if lat is None or lon is None:
                continue
            try:
                anomalies = await climate_anomalies_service.get_anomalies(
                    latitude=float(lat), longitude=float(lon)
                )
                if anomalies and hasattr(anomalies, "alerts") and anomalies.alerts:
                    for alert in anomalies.alerts[:1]:
                        alert_text = alert if isinstance(alert, str) else str(alert)
                        signals.append(SignalSource(
                            type="climate",
                            headline=f"{city_name}: {alert_text[:150]}",
                            severity="high",
                        ))
                elif anomalies and hasattr(anomalies, "heat_stress_active") and anomalies.heat_stress_active:
                    signals.append(SignalSource(
                        type="climate",
                        headline=f"{city_name}: Heat stress conditions active",
                        severity="high",
                    ))
            except Exception:
                pass
    except Exception as e:
        logger.debug("RiskMirror: climate signals failed: %s", e)
    return signals


async def _generate_morning_brief(
    focus: str, top_risk: str, dont_touch: str, signals: List[SignalSource],
) -> Optional[str]:
    """Generate LLM morning brief from collected signals."""
    try:
        from src.services.nvidia_llm import llm_service, LLMModel
        if not llm_service.is_available:
            return None
        signal_text = "\n".join(
            f"- [{s.type.upper()}] ({s.severity}) {s.headline}" for s in signals[:8]
        )
        prompt = (
            f"You are a risk platform morning brief generator.\n"
            f"Today's focus: {focus}\n"
            f"Top risk: {top_risk}\n"
            f"Don't touch: {dont_touch}\n\n"
            f"Signals:\n{signal_text}\n\n"
            f"Write a 2-3 sentence morning brief for a portfolio manager. "
            f"Be concise, actionable, and mention the most important signal. No markdown."
        )
        response = await llm_service.generate(
            prompt=prompt,
            model=LLMModel.LLAMA_8B,
            max_tokens=200,
            temperature=0.3,
            system_prompt="You are a concise risk analyst. Write a brief morning summary in 2-3 sentences.",
        )
        return (response.content or "").strip()[:500] or None
    except Exception as e:
        logger.debug("RiskMirror: LLM morning brief failed: %s", e)
        return None


# Today-card cache (3 min TTL) to reduce load and avoid Overseer flagging slow endpoint
_TODAY_CARD_CACHE: Optional[Dict[str, Any]] = None
_TODAY_CARD_CACHE_TS: float = 0
_TODAY_CARD_CACHE_TTL: float = 180.0


# ==================== ENDPOINTS ====================


async def _today_card_focus(db: AsyncSession) -> str:
    """Fetch focus (active or latest stress scenario)."""
    try:
        running = await db.execute(
            select(StressTest)
            .where(StressTest.status == StressTestStatus.RUNNING.value)
            .order_by(StressTest.updated_at.desc().nulls_last())
            .limit(1)
        )
        active_test = running.scalar_one_or_none()
        if active_test:
            return active_test.name or "Active stress test"
        completed = await db.execute(
            select(StressTest)
            .where(StressTest.status == StressTestStatus.COMPLETED.value)
            .order_by(StressTest.updated_at.desc().nulls_last())
            .limit(1)
        )
        last = completed.scalar_one_or_none()
        return last.name or "Latest scenario" if last else "Portfolio overview"
    except Exception as e:
        logger.debug("Today card: stress test lookup failed: %s", e)
        return "Portfolio overview"


async def _today_card_top_risk(db: AsyncSession) -> Tuple[str, Optional[str]]:
    """Fetch top-1 risk asset."""
    try:
        combined = (
            func.coalesce(Asset.climate_risk_score, 0)
            + func.coalesce(Asset.physical_risk_score, 0)
            + func.coalesce(Asset.network_risk_score, 0)
        ) / 3
        result = await db.execute(
            select(Asset.id, Asset.name)
            .where(Asset.status == "active")
            .order_by(combined.desc())
            .limit(1)
        )
        row = result.one_or_none()
        if row:
            return (row.name or "Unknown asset", str(row.id))
    except Exception as e:
        logger.debug("Today card: top risk lookup failed: %s", e)
    return ("—", None)


async def _today_card_dont_touch(db: AsyncSession) -> Tuple[str, Optional[str]]:
    """Fetch don't-touch (lowest-risk) asset."""
    try:
        combined = (
            func.coalesce(Asset.climate_risk_score, 0)
            + func.coalesce(Asset.physical_risk_score, 0)
            + func.coalesce(Asset.network_risk_score, 0)
        ) / 3
        result = await db.execute(
            select(Asset.id, Asset.name)
            .where(Asset.status == "active")
            .order_by(combined.asc())
            .limit(1)
        )
        row = result.one_or_none()
        if row:
            return (row.name or "—", str(row.id))
    except Exception as e:
        logger.debug("Today card: dont_touch lookup failed: %s", e)
    return ("—", None)


@router.get("/today-card", response_model=TodayCardResponse)
async def get_today_card(db: AsyncSession = Depends(get_db)):
    """
    RiskMirror: One card for the day enriched with news, climate, and market signals.
    Returns focus, top risk, don't touch, main reason, morning brief, and signal sources.
    Used by Dashboard and Command Center as the single "start of day" view.
    Cached 60s to reduce latency and external/LLM load on repeated calls.
    """
    global _TODAY_CARD_CACHE, _TODAY_CARD_CACHE_TS
    if _TODAY_CARD_CACHE is not None and (time.time() - _TODAY_CARD_CACHE_TS) < _TODAY_CARD_CACHE_TTL:
        return TodayCardResponse(**_TODAY_CARD_CACHE)

    focus = "Portfolio overview"
    top_risk = "—"
    top_risk_id: Optional[str] = None
    dont_touch = "—"
    dont_touch_id: Optional[str] = None
    main_reason: Optional[str] = None
    all_signals: List[SignalSource] = []
    sources_used: List[str] = []

    # Run DB lookups in parallel
    try:
        focus, top_risk_pair, dont_touch_pair = await asyncio.gather(
            _today_card_focus(db),
            _today_card_top_risk(db),
            _today_card_dont_touch(db),
        )
        top_risk, top_risk_id = top_risk_pair
        dont_touch, dont_touch_id = dont_touch_pair
    except Exception as e:
        logger.debug("Today card: parallel DB failed: %s", e)

    # Main reason: from highest-severity active alert
    try:
        alerts = sentinel_agent.get_active_alerts()
        unresolved = [a for a in alerts if not a.resolved]
        if unresolved:
            a = unresolved[0]
            main_reason = f"{a.title}: {a.message[:120]}" if a.message else a.title
            sources_used.append("alert")
            for ua in unresolved[:2]:
                all_signals.append(SignalSource(
                    type="alert",
                    headline=ua.title or "Active alert",
                    severity="critical" if ua.severity == AlertSeverity.CRITICAL else "high",
                ))
    except Exception as e:
        logger.debug("Today card: alerts lookup failed: %s", e)

    # Fetch external signals in parallel with short timeout (keep today-card fast; GDELT often slow)
    _SIGNALS_TIMEOUT = 4.0
    try:
        news_signals, market_signals, climate_signals = await asyncio.wait_for(
            asyncio.gather(
                _fetch_news_signals(),
                _fetch_market_signals(),
                _fetch_climate_signals(db),
            ),
            timeout=_SIGNALS_TIMEOUT,
        )
    except asyncio.TimeoutError:
        logger.debug("Today card: signals fetch timed out after %.0fs", _SIGNALS_TIMEOUT)
        news_signals = []
        market_signals = []
        climate_signals = []

    if news_signals:
        sources_used.append("news")
        all_signals.extend(news_signals)
    if market_signals:
        sources_used.append("market")
        all_signals.extend(market_signals)
    if climate_signals:
        sources_used.append("climate")
        all_signals.extend(climate_signals)

    # If no main_reason from alerts, synthesize from top signal
    if not main_reason and all_signals:
        top_signal = max(
            all_signals,
            key=lambda s: {"critical": 4, "high": 3, "medium": 2, "low": 1}.get(s.severity, 0),
        )
        main_reason = f"[{top_signal.type.upper()}] {top_signal.headline}"

    # LLM morning brief with short timeout (don't block card; Overseer flags slow endpoints)
    _BRIEF_TIMEOUT = 3.0
    try:
        morning_brief = await asyncio.wait_for(
            _generate_morning_brief(focus, top_risk, dont_touch, all_signals),
            timeout=_BRIEF_TIMEOUT,
        )
    except asyncio.TimeoutError:
        logger.debug("Today card: morning brief LLM timed out after %.0fs", _BRIEF_TIMEOUT)
        morning_brief = None

    response = TodayCardResponse(
        focus=focus,
        top_risk=top_risk,
        top_risk_id=top_risk_id,
        dont_touch=dont_touch,
        dont_touch_id=dont_touch_id,
        main_reason=main_reason,
        morning_brief=morning_brief,
        sources=sources_used,
        signals=all_signals,
    )
    _TODAY_CARD_CACHE = response.model_dump()
    _TODAY_CARD_CACHE_TS = time.time()
    return response


@router.get("/sentiment-meter", response_model=SentimentMeterResponse)
async def get_sentiment_meter(db: AsyncSession = Depends(get_db)):
    """
    Panic/Hype meter (0–100) and one main reason.
    Aggregates: alert counts (critical/high → panic), portfolio weighted risk, no external market data required.
    """
    value = 50
    label = "neutral"
    main_reason = "Portfolio and alerts within normal range."

    # Alert pressure: more critical/high → lower meter (panic)
    try:
        alerts = sentinel_agent.get_active_alerts()
        unresolved = [a for a in alerts if not a.resolved]
        critical = sum(1 for a in unresolved if a.severity == AlertSeverity.CRITICAL)
        high = sum(1 for a in unresolved if a.severity == AlertSeverity.HIGH)
        if critical > 0:
            value = max(0, 50 - critical * 20)
            label = "panic"
            main_reason = unresolved[0].title if unresolved else "Critical alerts active."
        elif high >= 2:
            value = max(0, 50 - high * 8)
            label = "panic" if value < 35 else "neutral"
            main_reason = unresolved[0].title if unresolved else "Elevated alert count."
        elif high == 1 and unresolved:
            value = 42
            label = "neutral"
            main_reason = unresolved[0].title
    except Exception as e:
        logger.debug("Sentiment meter: alerts failed: %s", e)

    # Portfolio risk: high weighted risk → shift toward panic
    try:
        row = await db.execute(
            select(
                func.avg(
                    (
                        func.coalesce(Asset.climate_risk_score, 0)
                        + func.coalesce(Asset.physical_risk_score, 0)
                        + func.coalesce(Asset.network_risk_score, 0)
                    )
                    / 3.0
                ).label("avg_risk")
            ).where(Asset.status == "active")
        )
        r = row.scalar_one_or_none()
        if r and r.avg_risk is not None:
            avg_100 = _normalize_risk(r.avg_risk)
            if avg_100 >= 70 and label == "neutral":
                value = min(value, 35)
                label = "panic"
                main_reason = main_reason or "Portfolio risk elevated."
            elif avg_100 >= 55 and value > 40:
                value = min(value, 45)
    except Exception as e:
        logger.debug("Sentiment meter: portfolio risk failed: %s", e)

    value = max(0, min(100, int(value)))
    if label == "neutral" and value < 40:
        label = "panic"
    elif label == "neutral" and value > 60:
        label = "hype"

    return SentimentMeterResponse(value=value, label=label, main_reason=main_reason)


# ==================== WAR ROOM CARD ====================


@router.get("/war-room-card", response_model=WarRoomCardResponse)
async def get_war_room_card(db: AsyncSession = Depends(get_db)):
    """
    War Room Card: board-ready single card with 3 risks, 3 actions, 1 priority.
    Aggregates data from asset risks, alerts, and optionally LLM for priority selection.
    Designed for executive decision-making.
    """
    top_risks: List[WarRoomRisk] = []
    actions: List[WarRoomAction] = []
    today_priority = {"title": "Monitor portfolio", "reason": "No critical signals detected."}
    data_sources: List[str] = []

    # --- Top 3 risks from highest-risk assets ---
    try:
        combined = (
            func.coalesce(Asset.climate_risk_score, 0)
            + func.coalesce(Asset.physical_risk_score, 0)
            + func.coalesce(Asset.network_risk_score, 0)
        ) / 3
        result = await db.execute(
            select(
                Asset.name,
                Asset.city,
                Asset.asset_type,
                Asset.climate_risk_score,
                Asset.physical_risk_score,
                Asset.network_risk_score,
                combined.label("combined_risk"),
            )
            .where(Asset.status == "active")
            .order_by(combined.desc())
            .limit(3)
        )
        rows = result.all()
        for row in rows:
            risk_val = _normalize_risk(float(row.combined_risk or 0))
            if risk_val >= 80:
                severity = "critical"
            elif risk_val >= 60:
                severity = "high"
            elif risk_val >= 40:
                severity = "medium"
            else:
                severity = "low"
            # Determine risk driver / sector
            c = float(row.climate_risk_score or 0)
            p = float(row.physical_risk_score or 0)
            n = float(row.network_risk_score or 0)
            if c >= p and c >= n:
                sector = "climate"
            elif p >= n:
                sector = "physical"
            else:
                sector = "network"
            asset_name = row.name or "Unknown asset"
            location = f" ({row.city})" if row.city else ""
            top_risks.append(WarRoomRisk(
                name=f"{asset_name}{location} — risk {risk_val:.0f}%",
                severity=severity,
                sector=sector,
            ))
        data_sources.append("portfolio")
    except Exception as e:
        logger.debug("War room card: top risks failed: %s", e)

    # --- Enrich with alert-based risks ---
    try:
        alerts = sentinel_agent.get_active_alerts()
        unresolved = [a for a in alerts if not a.resolved]
        for a in unresolved[:2]:
            sev = "critical" if a.severity == AlertSeverity.CRITICAL else "high"
            top_risks.append(WarRoomRisk(
                name=a.title or "Active alert",
                severity=sev,
                sector="alert",
            ))
        if unresolved:
            data_sources.append("alerts")
    except Exception as e:
        logger.debug("War room card: alerts failed: %s", e)

    # Keep top 3 risks sorted by severity
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    top_risks.sort(key=lambda r: severity_order.get(r.severity, 9))
    top_risks = top_risks[:3]

    # --- Generate 3 actions based on risk profile ---
    if top_risks:
        has_critical = any(r.severity == "critical" for r in top_risks)
        has_climate = any(r.sector == "climate" for r in top_risks)
        has_network = any(r.sector == "network" for r in top_risks)
        has_physical = any(r.sector == "physical" for r in top_risks)

        if has_critical:
            actions.append(WarRoomAction(
                action="Convene risk committee for critical exposure review",
                priority="immediate",
                impact="Reduce response time to critical threats",
            ))
        if has_climate:
            actions.append(WarRoomAction(
                action="Review climate hedging positions for exposed assets",
                priority="immediate" if has_critical else "short-term",
                impact="Mitigate climate-driven losses",
            ))
        if has_network:
            actions.append(WarRoomAction(
                action="Assess supply chain and network dependencies",
                priority="short-term",
                impact="Reduce cascade risk from network failures",
            ))
        if has_physical:
            actions.append(WarRoomAction(
                action="Verify insurance coverage for physical risk assets",
                priority="short-term",
                impact="Ensure adequate loss coverage",
            ))
        # Always suggest stress test
        actions.append(WarRoomAction(
            action="Run updated stress test on top-3 risk assets",
            priority="short-term",
            impact="Quantify potential losses under current conditions",
        ))
    else:
        actions = [
            WarRoomAction(action="Review portfolio allocation", priority="medium-term", impact="Optimize risk-return profile"),
            WarRoomAction(action="Monitor emerging risk signals", priority="short-term", impact="Early warning detection"),
            WarRoomAction(action="Schedule quarterly stress test", priority="medium-term", impact="Regulatory compliance"),
        ]

    actions = actions[:3]

    # --- Today's priority: pick from top risk + LLM synthesis ---
    if top_risks:
        top_r = top_risks[0]
        today_priority = {
            "title": top_r.name,
            "reason": f"Highest severity ({top_r.severity}) in {top_r.sector} sector. Immediate attention recommended.",
        }

    # Try LLM for better priority synthesis (with timeout so card doesn't hang)
    _WAR_ROOM_LLM_TIMEOUT = 8.0
    try:
        from src.services.nvidia_llm import llm_service, LLMModel
        if llm_service.is_available and top_risks:
            risk_text = "; ".join(f"{r.name} ({r.severity})" for r in top_risks)
            action_text = "; ".join(a.action for a in actions)
            prompt = (
                f"Top 3 risks: {risk_text}\n"
                f"Actions: {action_text}\n\n"
                f"Pick THE ONE priority for today. Reply in exactly this format:\n"
                f"PRIORITY: <one line title>\n"
                f"REASON: <one line reason why this is #1>"
            )
            response = await asyncio.wait_for(
                llm_service.generate(
                    prompt=prompt,
                    model=LLMModel.LLAMA_8B,
                    max_tokens=150,
                    temperature=0.2,
                    system_prompt="You are a concise risk advisor for a board executive. Pick one priority.",
                ),
                timeout=_WAR_ROOM_LLM_TIMEOUT,
            )
            content = (response.content or "").strip()
            if "PRIORITY:" in content and "REASON:" in content:
                parts = content.split("REASON:")
                title_part = parts[0].replace("PRIORITY:", "").strip()
                reason_part = parts[1].strip() if len(parts) > 1 else ""
                today_priority = {
                    "title": title_part[:200],
                    "reason": reason_part[:300],
                }
                data_sources.append("llm")
    except asyncio.TimeoutError:
        logger.debug("War room card: LLM priority timed out after %.0fs", _WAR_ROOM_LLM_TIMEOUT)
    except Exception as e:
        logger.debug("War room card: LLM priority failed: %s", e)

    return WarRoomCardResponse(
        top_risks=top_risks,
        actions=actions,
        today_priority=today_priority,
        generated_at=datetime.utcnow().isoformat(),
        data_sources=data_sources,
    )
