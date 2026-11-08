"""Geo Service: OpenStreetMap (Nominatim) search & reverse geocoding proxy, distance/ETA helpers."""
import math

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from core import current_user

router = APIRouter(prefix="/api/geo", tags=["geo"])
NOMINATIM = "https://nominatim.openstreetmap.org"
HEADERS = {"User-Agent": "GathrCart/1.0 (local commerce app)", "Accept-Language": "en"}
_cache: dict[str, object] = {}


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    (lat1, lng1), (lat2, lng2) = a, b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def eta_minutes(km: float) -> int:
    """City two-wheeler estimate: ~18 km/h average plus 2 min for parking & handover."""
    return max(1, round(km / 18 * 60 + 2))


def short_address(a: dict) -> str:
    ad = a.get("address") or {}
    parts = [ad.get(k) for k in ("house_number", "road", "neighbourhood", "suburb", "city_district", "city", "town", "village", "postcode")]
    seen, out = set(), []
    for p in parts:
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return ", ".join(out) or a.get("display_name", "")


async def _get(path: str, params: dict):
    key = path + str(sorted(params.items()))
    if key in _cache:
        return _cache[key]
    try:
        async with httpx.AsyncClient(timeout=8, headers=HEADERS) as c:
            r = await c.get(f"{NOMINATIM}/{path}", params={**params, "format": "jsonv2", "addressdetails": 1})
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPError:
        raise HTTPException(503, "Map search is busy right now. Try again in a moment.")
    if len(_cache) > 2000:
        _cache.clear()
    _cache[key] = data
    return data


@router.get("/reverse")
async def reverse(lat: float = Query(ge=-90, le=90), lng: float = Query(ge=-180, le=180), user=Depends(current_user)):
    data = await _get("reverse", {"lat": round(lat, 5), "lon": round(lng, 5), "zoom": 18})
    if not isinstance(data, dict) or data.get("error"):
        return {"lat": lat, "lng": lng, "line": "", "area": ""}
    ad = data.get("address") or {}
    return {"lat": lat, "lng": lng, "line": short_address(data),
            "area": ad.get("suburb") or ad.get("neighbourhood") or ad.get("city_district") or ad.get("city") or ""}


@router.get("/search")
async def search(q: str = Query(min_length=3, max_length=120), lat: float | None = None, lng: float | None = None, user=Depends(current_user)):
    params = {"q": q, "countrycodes": "in", "limit": 5}
    if lat is not None and lng is not None:  # prefer places around the current pin (~30 km box)
        params["viewbox"] = f"{lng - 0.3},{lat + 0.3},{lng + 0.3},{lat - 0.3}"
    data = await _get("search", params)
    return [{"lat": float(d["lat"]), "lng": float(d["lon"]), "name": d.get("name") or short_address(d).split(",")[0],
             "line": short_address(d)} for d in (data if isinstance(data, list) else [])]
