# auth_service/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
import os
from dotenv import load_dotenv
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Load environment variables
env_path = Path(__file__).parent.parent / '.env.backend'
load_dotenv(dotenv_path=env_path)

# API Key header
api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Depends(api_key_header)):
    """
    Verify the API key from the request header.
    Requires API_KEY to be set in environment variables.
    """
    expected_api_key = os.getenv("API_KEY")

    # Fail securely if API_KEY is not configured
    if not expected_api_key:
        logger.error("API_KEY environment variable is not set! Authentication cannot proceed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: API authentication not properly configured"
        )

    # Verify the API key
    if api_key != expected_api_key:
        logger.warning(f"Invalid API key attempt from request")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key"
        )

    return api_key 