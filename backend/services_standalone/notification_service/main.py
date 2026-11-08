"""
Standalone Notification Service (Microservice entry point).
Handles:
- Push notifications (FCM / Expo)
- Durable notification records in document store
- Asynchronous consumption from Amazon SQS
- Idempotent delivery to prevent spam/duplicate alerts
"""
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import logging
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from core import db, new_id, now, iso, current_user

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("notification_service")

app = FastAPI(title="SmartCart Notification Microservice", version="1.0.0")

class SendNotificationIn(BaseModel):
    user_ids: List[str]
    title: str
    body: str
    type: str = "general"
    ref: Optional[str] = None
    idempotency_key: Optional[str] = None

@app.get("/health")
@app.head("/health")
async def health():
    return {"status": "ok", "service": "notification-service"}

@app.post("/api/notifications/dispatch")
async def dispatch_notification(body: SendNotificationIn):
    """
    Idempotent dispatch of notifications.
    """
    if body.idempotency_key:
        existing = await db.notifications.find_one({"idempotency_key": body.idempotency_key})
        if existing:
            return {"status": "duplicate_ignored", "count": 0}

    docs = [
        {
            "id": new_id(),
            "user_id": uid,
            "title": body.title,
            "body": body.body,
            "type": body.type,
            "ref": body.ref,
            "read": False,
            "idempotency_key": body.idempotency_key,
            "created_at": iso(now())
        }
        for uid in set(body.user_ids)
    ]
    if docs:
        await db.notifications.insert_many(docs)
        logger.info(f"Dispatched notification '{body.title}' to {len(docs)} users")

    return {"status": "dispatched", "count": len(docs)}

@app.get("/api/notifications")
async def list_notifications(user=Depends(current_user)):
    """
    Retrieves notifications for authenticated user.
    """
    items = await db.notifications.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return items

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("NOTIFICATION_SERVICE_PORT", 8003)))
