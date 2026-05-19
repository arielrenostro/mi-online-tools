from __future__ import annotations
import asyncio
import time
from app.datalog.disk_store import CACHE_DIR

TTL_SECONDS      = 3600
INTERVAL_SECONDS = 600


async def cleanup_loop() -> None:
    while True:
        await asyncio.sleep(INTERVAL_SECONDS)
        now = time.time()
        for f in CACHE_DIR.glob("*.json"):
            try:
                if f.stat().st_mtime < now - TTL_SECONDS:
                    f.unlink(missing_ok=True)
            except OSError:
                pass
