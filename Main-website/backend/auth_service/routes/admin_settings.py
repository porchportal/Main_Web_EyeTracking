from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import logging
from auth import verify_api_key
from db.data_center import data_center_service

# Set up router
router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)

logger = logging.getLogger(__name__)

@router.post("/save-settings")
async def save_settings(settings_data: Dict[str, Any], api_key: str = Depends(verify_api_key)):
    """Save settings for a user"""
    try:
        user_id = settings_data.get('userId')
        settings = settings_data.get('settings')
        
        if not user_id or not settings:
            raise HTTPException(status_code=400, detail="Missing required fields")
            
        # Update settings in data center
        data_center_service.update_value(
            f"settings_{user_id}",
            settings,
            "json"
        )
        
        return {"success": True, "message": "Settings saved successfully"}
        
    except Exception as e:
        logger.error(f"Error saving settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save-image")
async def save_image(image_data: Dict[str, Any], api_key: str = Depends(verify_api_key)):
    """Save image for a user"""
    try:
        user_id = image_data.get('userId')
        image = image_data.get('image')
        
        if not user_id or not image:
            raise HTTPException(status_code=400, detail="Missing required fields")
            
        # Update image in data center
        data_center_service.update_value(
            f"image_{user_id}",
            image,
            "image"
        )
        
        return {"success": True, "message": "Image saved successfully"}
        
    except Exception as e:
        logger.error(f"Error saving image: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 