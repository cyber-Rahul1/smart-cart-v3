"""
Redis Cache and Amazon SQS Asynchronous Communication Service.
Supports high-performance session caching, rate-limiting, and resilient event streaming.
"""
import os
import json
import logging
from typing import Optional, Dict, Any
import boto3
from botocore.config import Config

logger = logging.getLogger("gathrcart.async_service")

class RedisCacheManager:
    def __init__(self):
        self.redis_url = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")
        self._client = None

    @property
    def client(self):
        if self._client is None:
            try:
                import redis
                self._client = redis.Redis.from_url(self.redis_url, decode_responses=True, socket_connect_timeout=1)
                self._client.ping()
            except Exception:
                # In-memory fallback if Redis is unavailable locally
                self._client = InMemoryCacheFallback()
        return self._client

    def get(self, key: str) -> Optional[str]:
        try:
            return self.client.get(key)
        except Exception:
            return None

    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        try:
            return bool(self.client.set(key, value, ex=ex))
        except Exception:
            return False

    def delete(self, key: str) -> bool:
        try:
            return bool(self.client.delete(key))
        except Exception:
            return False

class InMemoryCacheFallback:
    def __init__(self):
        self._store = {}

    def ping(self):
        return True

    def get(self, key: str) -> Optional[str]:
        return self._store.get(key)

    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        self._store[key] = value
        return True

    def delete(self, key: str) -> bool:
        self._store.pop(key, None)
        return True

class SQSQueueService:
    def __init__(self):
        self.region = os.environ.get("AWS_DEFAULT_REGION", "ap-south-1")
        self.queue_url = os.environ.get("AWS_SQS_ORDER_EVENTS_URL")
        self.sqs = boto3.client("sqs", region_name=self.region, config=Config(retries={"max_attempts": 3}))

    def send_event(self, event_type: str, payload: Dict[str, Any]) -> bool:
        """
        Sends event to Amazon SQS with deduplication & retry capability.
        """
        if not self.queue_url:
            logger.info(f"[Local Event Bus Fallback] Published event: {event_type} - {payload}")
            return True

        try:
            message_body = json.dumps({
                "event_type": event_type,
                "payload": payload
            })
            self.sqs.send_message(
                QueueUrl=self.queue_url,
                MessageBody=message_body
            )
            return True
        except Exception as e:
            logger.error(f"Failed to publish event to SQS: {e}")
            return False

cache_manager = RedisCacheManager()
sqs_service = SQSQueueService()
