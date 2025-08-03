from fastapi import APIRouter, HTTPException
from db.data_center import data_center_service
import json
from typing import List, Dict, Any
from datetime import datetime
import logging

# Set up router
router = APIRouter(
    prefix="/api/data-center",
    tags=["data_center"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)

logger = logging.getLogger(__name__)

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

@router.get("/settings/{user_id}")
async def get_settings(user_id: str):
    """Get settings for a specific user"""
    try:
        settings = await data_center_service.get_value(f"settings_{user_id}")
        if settings:
            return settings
        return {"times": 1, "delay": 3}  # Default settings
    except Exception as e:
        logger.error(f"Error getting settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/settings/{user_id}")
async def update_settings(user_id: str, settings: Dict[str, Any]):
    """Update settings for a specific user"""
    try:
        await data_center_service.update_value(
            f"settings_{user_id}",
            settings,
            "json"
        )
        return {"success": True, "message": "Settings updated successfully"}
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/image/{user_id}")
async def get_image(user_id: str):
    """Get image for a specific user"""
    try:
        image = await data_center_service.get_value(f"image_{user_id}")
        if image:
            return {"image": image}
        return {"image": None}
    except Exception as e:
        logger.error(f"Error getting image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/image/{user_id}")
async def update_image(user_id: str, image_data: Dict[str, str]):
    """Update image for a specific user"""
    try:
        await data_center_service.update_value(
            f"image_{user_id}",
            image_data["image"],
            "image"
        )
        return {"success": True, "message": "Image updated successfully"}
    except Exception as e:
        logger.error(f"Error updating image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/zoom/{user_id}")
async def get_zoom(user_id: str):
    """Get zoom level for a specific user"""
    try:
        zoom = await data_center_service.get_value(f"zoom_{user_id}")
        if zoom:
            return {"zoom": zoom}
        return {"zoom": 1.0}  # Default zoom level
    except Exception as e:
        logger.error(f"Error getting zoom level: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/zoom/{user_id}")
async def update_zoom(user_id: str, zoom_data: Dict[str, float]):
    """Update zoom level for a specific user"""
    try:
        await data_center_service.update_value(
            f"zoom_{user_id}",
            zoom_data["zoom"],
            "number"
        )
        return {"success": True, "message": "Zoom level updated successfully"}
    except Exception as e:
        logger.error(f"Error updating zoom level: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/values")
async def get_values():
    """Get all values from the data center"""
    try:
        # Initialize the service if needed
        await data_center_service.initialize()
        
        # Get all values (already serialized by DataCenter class)
        values = await data_center_service.get_all_values()
        return values
    except Exception as e:
        logger.error(f"Error getting all values: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/update")
async def update_value(data: Dict[str, Any]):
    """Update a value in the data center"""
    try:
        key = data.get("key")
        value = data.get("value")
        data_type = data.get("data_type", "json")
        
        if not key or value is None:
            raise HTTPException(status_code=400, detail="Missing required fields")
            
        await data_center_service.update_value(key, value, data_type)
        return {"success": True, "message": "Value updated successfully"}
    except Exception as e:
        logger.error(f"Error updating value: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 