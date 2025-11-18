"""Tests for entity resolution."""

import pytest

from libs.entity_resolution import EntityResolver, SanctionsChecker


class TestEntityResolver:
    """Tests for EntityResolver."""

    def test_resolve_by_lei(self):
        """Test resolving entity by LEI."""
        resolver = EntityResolver()

        lei = "12345678901234567890"
        result = resolver.resolve_by_lei(lei)

        assert result is not None
        assert result["lei"] == lei

    def test_invalid_lei(self):
        """Test invalid LEI format."""
        resolver = EntityResolver()

        result = resolver.resolve_by_lei("invalid")
        assert result is None

    def test_resolve_by_name(self):
        """Test resolving entity by name."""
        resolver = EntityResolver()

        results = resolver.resolve_by_name("Test Company", jurisdiction="US")

        assert isinstance(results, list)
        assert len(results) > 0


class TestSanctionsChecker:
    """Tests for SanctionsChecker."""

    def test_check_entity(self):
        """Test checking entity against sanctions."""
        checker = SanctionsChecker()

        result = checker.check_entity("Test Entity", lei="12345678901234567890")

        assert "is_sanctioned" in result
        assert isinstance(result["is_sanctioned"], bool)
        assert "matches" in result

    def test_check_batch(self):
        """Test batch sanctions check."""
        checker = SanctionsChecker()

        entities = [
            {"name": "Entity 1", "lei": "12345678901234567890"},
            {"name": "Entity 2", "lei": "09876543210987654321"},
        ]

        results = checker.check_batch(entities)

        assert len(results) == 2
        assert all("is_sanctioned" in r for r in results)

