"""
Batch processing utilities for efficient bulk operations.
"""

from typing import Any, Callable, Dict, List, Optional, TypeVar
from collections import defaultdict
import structlog

logger = structlog.get_logger(__name__)

T = TypeVar("T")
R = TypeVar("R")


class BatchProcessor:
    """Process items in batches for efficiency."""

    def __init__(self, batch_size: int = 100, max_wait_time: float = 0.1):
        """
        Initialize batch processor.

        Args:
            batch_size: Maximum batch size
            max_wait_time: Maximum time to wait before processing batch (seconds)
        """
        self.batch_size = batch_size
        self.max_wait_time = max_wait_time
        self._pending_batches: Dict[str, List[Any]] = defaultdict(list)
        self._batch_timers: Dict[str, float] = {}

    def add_to_batch(
        self,
        batch_key: str,
        item: Any,
        processor: Callable[[List[Any]], List[R]],
        force_process: bool = False,
    ) -> Optional[R]:
        """
        Add item to batch and process if batch is full.

        Args:
            batch_key: Key to group items into batches
            item: Item to add
            processor: Function to process batch
            force_process: Force immediate processing

        Returns:
            Result if batch was processed, None otherwise
        """
        import time

        self._pending_batches[batch_key].append(item)

        # Check if batch is full
        if len(self._pending_batches[batch_key]) >= self.batch_size or force_process:
            return self._process_batch(batch_key, processor)

        # Set timer for delayed processing
        if batch_key not in self._batch_timers:
            self._batch_timers[batch_key] = time.time()

        return None

    def _process_batch(
        self, batch_key: str, processor: Callable[[List[Any]], List[R]]
    ) -> List[R]:
        """Process a batch."""
        batch = self._pending_batches.pop(batch_key, [])
        if batch_key in self._batch_timers:
            del self._batch_timers[batch_key]

        if not batch:
            return []

        logger.debug("Processing batch", batch_key=batch_key, size=len(batch))
        results = processor(batch)
        return results

    def flush(self, processor: Callable[[List[Any]], List[R]]) -> Dict[str, List[R]]:
        """Flush all pending batches."""
        results = {}
        for batch_key in list(self._pending_batches.keys()):
            results[batch_key] = self._process_batch(batch_key, processor)
        return results


def batch_process(
    items: List[T],
    processor: Callable[[List[T]], List[R]],
    batch_size: int = 100,
) -> List[R]:
    """
    Process items in batches.

    Args:
        items: List of items to process
        processor: Function to process each batch
        batch_size: Batch size

    Returns:
        List of results
    """
    results = []
    for i in range(0, len(items), batch_size):
        batch = items[i : i + batch_size]
        batch_results = processor(batch)
        results.extend(batch_results)
    return results

