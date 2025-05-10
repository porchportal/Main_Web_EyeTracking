from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, Optional
import logging
from auth import verify_api_key
from services.data_center_service import data_center_service

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

@router.get("/update")
async def get_admin_data(
    userId: str = Query(..., description="User ID"),
    type: str = Query(..., description="Type of data to get (settings/image)"),
    api_key: str = Depends(verify_api_key)
):
    """Get admin data (settings or image) for a user"""
    try:
        if not userId or not type:
            raise HTTPException(status_code=400, detail="Missing required fields")
            
        # Determine the key based on type
        if type == 'settings':
            key = f"settings_{userId}"
        elif type == 'image':
            key = f"image_{userId}"
        else:
            raise HTTPException(status_code=400, detail="Invalid type")
            
        # Get data from data center
        data = await data_center_service.get_value(key)
        
        # If no data found, return default settings
        if data is None and type == 'settings':
            data = {
                "times": 1,
                "delay": 3,
                "image_path": "/asfgrebvxcv",
                "updateImage": "image.jpg",
                "set_timeRandomImage": 1,
                "every_set": 2,
                "zoom_percentage": 100,
                "position_zoom": [3, 4],
                "state_isProcessOn": True,
                "currentlyPage": "str",
                "freeState": 3
            }
        
        return {
            "success": True,
            "type": type,
            "userId": userId,
            "data": data
        }
        
    except Exception as e:
        logger.error(f"Error getting admin data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/update")
async def update_admin_data(update_data: Dict[str, Any], api_key: str = Depends(verify_api_key)):
    """Handle all admin updates (settings and images)"""
    try:
        user_id = update_data.get('userId')
        update_type = update_data.get('type')
        data = update_data.get('data')
        
        if not user_id or not update_type or not data:
            raise HTTPException(status_code=400, detail="Missing required fields")
            
        # Determine the key based on update type
        if update_type == 'settings':
            key = f"settings_{user_id}"
        elif update_type == 'image':
            key = f"image_{user_id}"
        else:
            raise HTTPException(status_code=400, detail="Invalid update type")
            
        # Update in data center
        await data_center_service.update_value(key, data)
        
        return {
            "success": True,
            "message": f"{update_type.capitalize()} updated successfully",
            "type": update_type,
            "userId": user_id,
            "data": data
        }
        
    except Exception as e:
        logger.error(f"Error updating admin data: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 