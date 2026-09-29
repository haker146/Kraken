import aiohttp
import asyncio
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

class AsyncManifestEngine:
    """Asynchronous engine for fetching manifests using aiohttp with Zero-Downtime provider aggregation."""
    
    PROVIDERS = [
        "https://api.hubcap.network/manifest/",
        "https://api.depotbox.org/v1/",
        "https://api.ryuu.moe/manifests/"
    ]
    
    def __init__(self):
        self._session: Optional[aiohttp.ClientSession] = None
        self._cache: Dict[str, Any] = {}

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5.0),
                headers={"User-Agent": "Kraken/2.0"}
            )
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def fetch_manifest(self, app_id: str, depot_id: str) -> Optional[dict]:
        """Fetch manifest with failover chain."""
        cache_key = f"{app_id}_{depot_id}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        session = await self._get_session()
        
        for provider in self.PROVIDERS:
            url = f"{provider}{app_id}/{depot_id}"
            try:
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        self._cache[cache_key] = data
                        return data
                    elif response.status == 404:
                        continue # Not found on this provider, try next
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                logger.warning(f"Provider {provider} failed: {e}")
                continue
                
        return None

# Singleton instance for the application
engine = AsyncManifestEngine()

def run_async_task(coro):
    """Utility to run an async task in a new event loop if needed, usually called by QThread."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.run_until_complete(engine.close())
        loop.close()
