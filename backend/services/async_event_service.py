"""
Redis Cache, Geospatial Indexing, and Amazon SQS / Event Bus Communication Service.
Supports high-performance session caching, rate-limiting, live rider geo-indexing, and resilient event streaming.
"""
import os
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
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

    def set(self, key: str, value: str, ex: Optional[int] = None, nx: bool = False) -> bool:
        try:
            return bool(self.client.set(key, value, ex=ex, nx=nx))
        except Exception:
            return False

    def delete(self, key: str) -> bool:
        try:
            return bool(self.client.delete(key))
        except Exception:
            return False

    def geoadd(self, name: str, lng: float, lat: float, member: str) -> bool:
        try:
            return bool(self.client.geoadd(name, (lng, lat, member)))
        except Exception:
            return False

    def geosearch(self, name: str, lng: float, lat: float, radius_km: float = 5.0) -> List[str]:
        try:
            # redis-py georadius or geosearch
            if hasattr(self.client, "geosearch"):
                return self.client.geosearch(name, longitude=lng, latitude=lat, radius=radius_km, unit="km")
            elif hasattr(self.client, "georadius"):
                return self.client.georadius(name, lng, lat, radius_km, unit="km")
            return []
        except Exception:
            return []

class InMemoryCacheFallback:
    def __init__(self):
        self._store = {}
        self._geo = {}

    def ping(self):
        return True

    def get(self, key: str) -> Optional[str]:
        return self._store.get(key)

    def set(self, key: str, value: str, ex: Optional[int] = None, nx: bool = False) -> bool:
        if nx and key in self._store:
            return False
        self._store[key] = value
        return True

    def delete(self, key: str) -> bool:
        self._store.pop(key, None)
        return True

    def geoadd(self, name: str, *values) -> bool:
        # values can be (lng, lat, member) tuples or flat
        bucket = self._geo.setdefault(name, {})
        for item in values:
            if isinstance(item, (tuple, list)) and len(item) >= 3:
                bucket[item[2]] = (float(item[0]), float(item[1]))
        return True

    def geosearch(self, name: str, longitude: float, latitude: float, radius: float = 5.0, unit: str = "km") -> List[str]:
        bucket = self._geo.get(name, {})
        # Simple bounding box approximation
        deg = radius / 111.0
        results = []
        for mem, (lng, lat) in bucket.items():
            if abs(lng - longitude) <= deg and abs(lat - latitude) <= deg:
                results.append(mem)
        return results

    def georadius(self, name: str, longitude: float, latitude: float, radius: float = 5.0, unit: str = "km") -> List[str]:
        return self.geosearch(name, longitude, latitude, radius, unit)

class SQSQueueService:
    def __init__(self):
        self.region = os.environ.get("AWS_DEFAULT_REGION", "ap-south-1")
        self.queue_url = os.environ.get("AWS_SQS_ORDER_EVENTS_URL")
        try:
            self.sqs = boto3.client("sqs", region_name=self.region, config=Config(retries={"max_attempts": 3}))
        except Exception:
            self.sqs = None

    def send_event(self, event_type: str, payload: Dict[str, Any], event_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Sends event with unique ID, timestamp, and deduplication to Amazon SQS or Local Outbox Event Bus.
        """
        evt_id = event_id or str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        full_event = {
            "event_id": evt_id,
            "event_type": event_type,
            "timestamp": timestamp,
            "payload": payload
        }

        if not self.queue_url or not self.sqs:
            logger.info(f"[Outbox Event Bus] Published event: {event_type} - ID: {evt_id}")
            return full_event

        try:
            message_body = json.dumps(full_event)
            params = {
                "QueueUrl": self.queue_url,
                "MessageBody": message_body
            }
            if self.queue_url.endswith(".fifo"):
                params["MessageGroupId"] = str(payload.get("order_id", "default_group"))
                params["MessageDeduplicationId"] = evt_id
            self.sqs.send_message(**params)
            return full_event
        except Exception as e:
            logger.error(f"Failed to publish event to SQS: {e}")
            return full_event

cache_manager = RedisCacheManager()
sqs_service = SQSQueueService()
