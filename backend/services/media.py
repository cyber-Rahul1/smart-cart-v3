"""Media Service: seller photo uploads to Emergent Object Storage; public read of catalog images."""
import logging
import os

import requests
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from core import db, iso, new_id, now, require

logger = logging.getLogger("gathrcart.media")
router = APIRouter(prefix="/api", tags=["media"])

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ["EMERGENT_LLM_KEY"]
APP_NAME = os.environ["APP_NAME"]
MAX_BYTES = 5 * 1024 * 1024
TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic"}
storage_key = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def _call(method: str, path: str, **kw):
    global storage_key
    for attempt in range(2):
        key = init_storage()
        resp = requests.request(method, f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, **kw.pop("headers", {})}, timeout=120, **kw)
        if resp.status_code == 503 and attempt == 0:
            storage_key = None  # stale key: re-init once
            continue
        return resp
    return resp


def put_object(path: str, data: bytes, content_type: str) -> dict:
    resp = _call("PUT", path, data=data, headers={"Content-Type": content_type})
    if resp.status_code == 402:
        raise HTTPException(402, "Photo storage is out of credits. Please try again later.")
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    resp = _call("GET", path)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


@router.post("/seller/upload")
async def upload(file: UploadFile = File(...), user=Depends(require("seller"))):
    ctype = (file.content_type or "").lower()
    if ctype not in TYPES:
        raise HTTPException(400, "Upload a JPG, PNG, WEBP or HEIC photo")
    chunks, total = [], 0
    while chunk := await file.read(256 * 1024):
        total += len(chunk)
        if total > MAX_BYTES:
            raise HTTPException(400, "Photo must be under 5 MB")
        chunks.append(chunk)
    data = b"".join(chunks)
    head = data[:12]
    is_img = head.startswith(b"\xff\xd8\xff") or head.startswith(b"\x89PNG") or (head[:4] == b"RIFF" and head[8:12] == b"WEBP") or head[4:8] == b"ftyp"
    if not is_img:
        raise HTTPException(400, "That file isn't a valid photo")
    fid = new_id()
    path = f"{APP_NAME}/uploads/{user['id']}/{fid}.{TYPES[ctype]}"
    try:
        result = await run_in_threadpool(put_object, path, data, ctype)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Remote proxy upload failed, using resilient local storage: %s", exc)
        local_dir = os.path.join(os.path.dirname(__file__), "..", "uploads", user["id"])
        os.makedirs(local_dir, exist_ok=True)
        local_file_path = os.path.join(local_dir, f"{fid}.{TYPES[ctype]}")
        with open(local_file_path, "wb") as out_f:
            out_f.write(data)
        result = {"path": f"local://{local_file_path}"}
    await db.files.insert_one({"id": fid, "owner_id": user["id"], "storage_path": result["path"], "content_type": ctype, "size": len(data),
                               "original_name": file.filename, "visibility": "public_catalog", "is_deleted": False, "created_at": iso(now())})
    return {"id": fid, "url": f"/api/files/{fid}"}


@router.get("/files/{fid}")
async def read_file(fid: str):
    """Catalog photos are public (shown to every customer); only DB-registered, non-deleted files are served."""
    rec = await db.files.find_one({"id": fid, "is_deleted": False, "visibility": "public_catalog"}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "File not found")
    try:
        if rec["storage_path"].startswith("local://"):
            local_p = rec["storage_path"].replace("local://", "")
            with open(local_p, "rb") as in_f:
                data = in_f.read()
            ctype = rec.get("content_type", "application/octet-stream")
        else:
            data, ctype = await run_in_threadpool(get_object, rec["storage_path"])
    except Exception as exc:
        logger.exception("download failed: %s", exc)
        raise HTTPException(502, "Couldn't load the photo")
    return Response(content=data, media_type=rec.get("content_type") or ctype, headers={"Cache-Control": "public, max-age=604800, immutable"})
