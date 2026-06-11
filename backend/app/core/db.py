import logging
from supabase import create_client, Client, ClientOptions
from httpx import Timeout
from app.core.config import settings

logger = logging.getLogger(__name__)

# Configure explicit timeouts to avoid WinError 10060 hangs
# connect=10s for TCP handshake, read=30s for response, write=10s, pool=10s
_timeout = Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)

# Initialize Supabase client with proper timeout via ClientOptions
supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_KEY,
    options=ClientOptions(
        postgrest_client_timeout=_timeout,
        storage_client_timeout=20,
        function_client_timeout=5,
    )
)

logger.info(f"Supabase client initialized for: {settings.SUPABASE_URL}")

def get_db() -> Client:
    """Helper function to retrieve Supabase client instance"""
    return supabase
