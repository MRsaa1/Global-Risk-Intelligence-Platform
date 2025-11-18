"""
Query optimization utilities for database and API queries.
"""

from typing import Any, Dict, List, Optional, Set
import structlog

logger = structlog.get_logger(__name__)


class QueryOptimizer:
    """Optimize queries for better performance."""

    @staticmethod
    def optimize_select_fields(
        fields: List[str], required_fields: Set[str], available_fields: Set[str]
    ) -> List[str]:
        """
        Optimize SELECT fields to include only required fields.

        Args:
            fields: Requested fields
            required_fields: Fields that must be included
            available_fields: All available fields

        Returns:
            Optimized list of fields
        """
        # Include required fields
        optimized = set(required_fields)

        # Add requested fields that are available
        for field in fields:
            if field in available_fields:
                optimized.add(field)

        return sorted(optimized)

    @staticmethod
    def build_index_hints(
        table: str, filters: Dict[str, Any], available_indexes: List[str]
    ) -> List[str]:
        """
        Build index hints based on filters.

        Args:
            table: Table name
            filters: Filter conditions
            available_indexes: List of available indexes

        Returns:
            List of index hints
        """
        hints = []

        # Check which indexes match the filters
        filter_keys = set(filters.keys())
        for index in available_indexes:
            # Simple heuristic: if index columns match filter keys
            index_cols = set(index.split("_") if "_" in index else [index])
            if filter_keys.intersection(index_cols):
                hints.append(index)

        return hints

    @staticmethod
    def optimize_joins(
        tables: List[str], join_conditions: Dict[str, List[str]]
    ) -> List[Dict[str, Any]]:
        """
        Optimize join order based on table sizes and join conditions.

        Args:
            tables: List of tables to join
            join_conditions: Join conditions between tables

        Returns:
            Optimized join order
        """
        # Placeholder - would use query optimizer logic
        # In production, would consider:
        # - Table sizes
        # - Index availability
        # - Join selectivity

        joins = []
        for i, table in enumerate(tables):
            if i > 0:
                prev_table = tables[i - 1]
                conditions = join_conditions.get(f"{prev_table}_{table}", [])
                joins.append(
                    {
                        "table": table,
                        "type": "INNER",
                        "conditions": conditions,
                    }
                )

        return joins

    @staticmethod
    def paginate_query(
        query: str, page: int = 1, page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Add pagination to query.

        Args:
            query: Base query
            page: Page number (1-indexed)
            page_size: Items per page

        Returns:
            Dictionary with paginated query and metadata
        """
        offset = (page - 1) * page_size

        # Add LIMIT and OFFSET
        paginated_query = f"{query} LIMIT {page_size} OFFSET {offset}"

        return {
            "query": paginated_query,
            "page": page,
            "page_size": page_size,
            "offset": offset,
        }

