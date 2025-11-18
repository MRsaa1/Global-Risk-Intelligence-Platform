"""
Streaming Data Processor

Process real-time streaming data for risk calculations.
"""

from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
import structlog
import pandas as pd
from collections import deque

logger = structlog.get_logger(__name__)


class StreamingDataProcessor:
    """
    Streaming Data Processor.
    
    Processes real-time streaming data for risk calculations.
    """

    def __init__(self, window_size: int = 100):
        """
        Initialize streaming data processor.

        Args:
            window_size: Size of sliding window
        """
        self.window_size = window_size
        self.data_windows: Dict[str, deque] = {}
        self.processors: Dict[str, Callable] = {}

    def register_processor(
        self,
        metric_name: str,
        processor: Callable[[List[float]], float],
    ) -> None:
        """
        Register processor for metric.

        Args:
            metric_name: Metric name
            processor: Processing function
        """
        self.processors[metric_name] = processor
        logger.info("Processor registered", metric=metric_name)

    def process_streaming_data(
        self,
        portfolio_id: str,
        metric_name: str,
        value: float,
        timestamp: datetime,
    ) -> Optional[float]:
        """
        Process streaming data point.

        Args:
            portfolio_id: Portfolio identifier
            metric_name: Metric name
            value: Metric value
            timestamp: Timestamp

        Returns:
            Processed value (if processor registered)
        """
        key = f"{portfolio_id}:{metric_name}"

        if key not in self.data_windows:
            self.data_windows[key] = deque(maxlen=self.window_size)

        self.data_windows[key].append({
            "value": value,
            "timestamp": timestamp,
        })

        # Process if processor registered
        if metric_name in self.processors:
            values = [d["value"] for d in self.data_windows[key]]
            processed = self.processors[metric_name](values)
            logger.debug(
                "Processed streaming data",
                portfolio_id=portfolio_id,
                metric=metric_name,
                processed_value=processed,
            )
            return processed

        return None

    def get_window_statistics(
        self,
        portfolio_id: str,
        metric_name: str,
    ) -> Dict[str, float]:
        """
        Get statistics for data window.

        Args:
            portfolio_id: Portfolio identifier
            metric_name: Metric name

        Returns:
            Statistics dictionary
        """
        key = f"{portfolio_id}:{metric_name}"
        window = self.data_windows.get(key, deque())

        if not window:
            return {}

        values = [d["value"] for d in window]

        return {
            "mean": sum(values) / len(values),
            "min": min(values),
            "max": max(values),
            "std": self._calculate_std(values),
            "count": len(values),
        }

    def _calculate_std(self, values: List[float]) -> float:
        """Calculate standard deviation."""
        if len(values) < 2:
            return 0.0
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
        return variance ** 0.5

