"""
Real-Time Data Streaming

Kafka-based real-time data streaming for risk metrics.
"""

from libs.streaming.kafka_streamer import KafkaStreamer
from libs.streaming.data_processor import StreamingDataProcessor

__all__ = [
    "KafkaStreamer",
    "StreamingDataProcessor",
]

__version__ = "1.0.0"

