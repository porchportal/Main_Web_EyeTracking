# backend/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from config.settings import settings

# API Key header
api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Depends(api_key_header)):
    """
    Verify the API key from the request header
    """
    if api_key != settings.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key"
        )
    return api_key 