import asyncio
from core import db, iso, now

async def main():
    doc = {
        "id": "home_banner",
        "image_url": "/assets/images/home_greeting_banner.jpg",
        "title": "Hi {name}",
        "subtitle": "What are we ordering today?",
        "updated_at": iso(now())
    }
    existing = await db.platform_config.find_one({"id": "home_banner"})
    if existing:
        await db.platform_config.update_one({"id": "home_banner"}, {"$set": doc})
    else:
        await db.platform_config.insert_one(doc)
    saved = await db.platform_config.find_one({"id": "home_banner"}, {"_id": 0})
    print("SAVED_BANNER:", saved)

if __name__ == "__main__":
    asyncio.run(main())

