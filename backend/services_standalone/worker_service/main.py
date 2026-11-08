"""
Standalone Background Worker Service.
Polls transactional outbox events, processes deadline closures, and consumes asynchronous tasks.
"""
import asyncio
import logging
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from database.connection import SessionLocal
from database.models import TransactionalOutbox
from services.async_event_service import sqs_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("worker_service")

async def process_outbox_events():
    """
    Polls the transactional outbox table and relays pending events to SQS.
    """
    while True:
        try:
            session = SessionLocal()
            pending_events = session.query(TransactionalOutbox).filter(
                TransactionalOutbox.status == "pending"
            ).limit(20).all()

            for event in pending_events:
                logger.info(f"Relaying outbox event {event.id} ({event.event_type}) to SQS")
                success = sqs_service.send_event(event.event_type, {"event_id": event.id, "payload": event.payload_json})
                if success:
                    event.status = "published"
                else:
                    event.retry_count += 1
                    if event.retry_count >= 5:
                        event.status = "failed"
            session.commit()
            session.close()
        except Exception as e:
            logger.error(f"Error in worker loop: {e}")

        await asyncio.sleep(5)

if __name__ == "__main__":
    logger.info("Starting SmartCart Background Worker Service...")
    asyncio.run(process_outbox_events())
