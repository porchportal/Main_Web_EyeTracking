# backend/auth_service/routes/admin_destroy_data.py
"""
Admin endpoint for completely destroying user data
- Removes user from consent_data.json
- Deletes user folders from captures, complete, and enhance directories
"""

from fastapi import APIRouter, HTTPException, Header, status
from typing import Optional
import logging
import json
import shutil
from pathlib import Path
from pydantic import BaseModel

# Set up router
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    responses={
        401: {"description": "Unauthorized"},
        500: {"description": "Internal server error"}
    }
)

logger = logging.getLogger(__name__)

# Define paths
RESOURCE_SECURITY_DIR = Path(__file__).parent.parent / "resource_security"
CONSENT_DATA_FILE = RESOURCE_SECURITY_DIR / "consent_data.json"
PUBLIC_DIR = RESOURCE_SECURITY_DIR / "public"

class DestroyUserRequest(BaseModel):
    userId: str

class DestroyUserResponse(BaseModel):
    success: bool
    message: str
    deleted_from_consent_data: bool
    deleted_folders: list[str]
    folder_count: int

def ensure_consent_file_exists():
    """Ensure the consent data file and directory exist"""
    RESOURCE_SECURITY_DIR.mkdir(exist_ok=True)
    if not CONSENT_DATA_FILE.exists():
        CONSENT_DATA_FILE.write_text("[]")

def read_consent_data() -> list[dict]:
    """Read consent data from JSON file"""
    ensure_consent_file_exists()
    try:
        with open(CONSENT_DATA_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []

def write_consent_data(data: list[dict]):
    """Write consent data to JSON file"""
    ensure_consent_file_exists()
    with open(CONSENT_DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@router.post("/destroy-user-data", response_model=DestroyUserResponse)
async def destroy_user_data(
    request: DestroyUserRequest,
    x_api_key: Optional[str] = Header(None)
):
    """
    Completely destroy all user data:
    - Remove from consent_data.json
    - Delete user folders from captures, complete, and enhance directories
    """
    try:
        # Validate API key
        import os
        expected_api_key = os.getenv('API_KEY')

        if not expected_api_key:
            logger.error('API_KEY environment variable is not set')
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server configuration error: API key not configured"
            )

        if not x_api_key or x_api_key != expected_api_key:
            logger.error(f'API Key validation failed for destroy-user-data')
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: Invalid API key"
            )

        user_id = request.userId
        logger.info(f"🗑️ Starting data destruction for user: {user_id}")

        # 1. Remove user from consent_data.json
        deleted_from_consent_data = False
        try:
            consent_data = read_consent_data()
            original_count = len(consent_data)

            # Filter out the user to be deleted
            updated_consent_data = [data for data in consent_data if data.get("userId") != user_id]

            if len(updated_consent_data) < original_count:
                write_consent_data(updated_consent_data)
                deleted_from_consent_data = True
                logger.info(f"✅ Deleted user {user_id} from consent_data.json")
            else:
                logger.info(f"ℹ️ User {user_id} not found in consent_data.json")
        except Exception as json_error:
            logger.error(f"❌ Failed to delete from consent_data.json: {json_error}")

        # 2. Delete user folders from captures, complete, and enhance directories
        folders_to_delete = [
            PUBLIC_DIR / "captures" / user_id,
            PUBLIC_DIR / "complete" / user_id,
            PUBLIC_DIR / "enhance" / user_id
        ]

        deleted_folders = []
        for folder in folders_to_delete:
            if folder.exists() and folder.is_dir():
                try:
                    shutil.rmtree(folder)
                    deleted_folders.append(str(folder.relative_to(RESOURCE_SECURITY_DIR)))
                    logger.info(f"✅ Deleted folder: {folder}")
                except Exception as folder_error:
                    logger.error(f"❌ Failed to delete folder {folder}: {folder_error}")
            else:
                logger.info(f"ℹ️ Folder does not exist: {folder}")

        # Build success message
        message_parts = []
        if deleted_from_consent_data:
            message_parts.append("Removed from consent_data.json")
        if deleted_folders:
            message_parts.append(f"Deleted {len(deleted_folders)} folder(s)")

        success_message = ". ".join(message_parts) if message_parts else "No data found to delete"

        logger.info(f"✅ Data destruction completed for user {user_id}: {success_message}")

        return DestroyUserResponse(
            success=True,
            message=success_message,
            deleted_from_consent_data=deleted_from_consent_data,
            deleted_folders=deleted_folders,
            folder_count=len(deleted_folders)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error destroying user data for {request.userId}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to destroy user data: {str(e)}"
        )
