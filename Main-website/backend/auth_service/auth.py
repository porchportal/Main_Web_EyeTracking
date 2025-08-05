# auth_service/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / '.env.backend'
load_dotenv(dotenv_path=env_path)

# API Key header
api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Depends(api_key_header)):
    """
    Verify the API key from the request header
    """
    expected_api_key = os.getenv("API_KEY", "A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV")
    if api_key != expected_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key"
        )
    return api_key 