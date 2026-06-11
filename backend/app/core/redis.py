import logging
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)

_real_redis = None
_fake_redis = None
_use_fake = False

async def get_redis():
    """Helper to get async redis client with transparent in-memory fallback"""
    global _real_redis, _fake_redis, _use_fake
    
    if _use_fake:
        if _fake_redis is None:
            import fakeredis.aioredis
            logger.info("Using in-memory FakeRedis client.")
            _fake_redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
        return _fake_redis
        
    if _real_redis is None:
        try:
            client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            # Perform a quick ping test
            await client.ping()
            _real_redis = client
            logger.info("Connected to Redis server.")
        except Exception as e:
            logger.warning(
                f"Redis server connection failed: {e}. "
                "Switching to transparent in-memory FakeRedis fallback."
            )
            _use_fake = True
            import fakeredis.aioredis
            _fake_redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
            return _fake_redis
            
    return _real_redis

