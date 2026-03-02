"""
Tests for plan features: Today Card, Sentiment Meter, Headline Impact, Climate Haven.
"""
import pytest
from tests.conftest import get_client


def test_dashboard_today_card():
    client = get_client()
    r = client.get("/api/v1/dashboard/today-card")
    assert r.status_code == 200
    data = r.json()
    assert "focus" in data
    assert "top_risk" in data
    assert "dont_touch" in data
    assert "main_reason" in data


def test_dashboard_sentiment_meter():
    client = get_client()
    r = client.get("/api/v1/dashboard/sentiment-meter")
    assert r.status_code == 200
    data = r.json()
    assert "value" in data
    assert data["value"] >= 0 and data["value"] <= 100
    assert data["label"] in ("panic", "neutral", "hype")
    assert "main_reason" in data


def test_analytics_headline_impact():
    client = get_client()
    r = client.post(
        "/api/v1/analytics/headline-impact",
        json={"headline": "Fed raises rates by 25bp"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "sectors" in data
    assert "direction" in data
    assert data["direction"] in ("positive", "negative", "neutral")
    assert data["volatility_estimate"] in ("low", "medium", "high")
    assert "summary" in data


def test_climate_haven():
    client = get_client()
    r = client.get("/api/v1/climate/haven?lat=53.55&lon=9.99")
    assert r.status_code == 200
    data = r.json()
    assert "city_id" in data
    assert "name" in data
    assert "country" in data
    assert "latitude" in data
    assert "longitude" in data
    assert "composite_score" in data
    assert "reason" in data
