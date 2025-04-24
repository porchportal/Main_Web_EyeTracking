from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
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

@router.post("/update")
async def update_admin_data(update_data: Dict[str, Any], api_key: str = Depends(verify_api_key)):
    """Handle all admin updates (settings and images)"""
    try:
        user_id = update_data.get('userId')
        update_type = update_data.get('type')
        data = update_data.get('data')
        
        if not user_id or not update_type or not data:
            raise HTTPException(status_code=400, detail="Missing required fields")
            
        # Determine the key and data type based on update type
        if update_type == 'settings':
            key = f"settings_{user_id}"
            data_type = 'json'
        elif update_type == 'image':
            key = f"image_{user_id}"
            data_type = 'image'
        else:
            raise HTTPException(status_code=400, detail="Invalid update type")
            
        # Update in data center
        data_center_service.update_value(key, data, data_type)
        
        return {
            "success": True,
            "message": f"{update_type.capitalize()} updated successfully",
            "type": update_type,
            "userId": user_id
        }
        
    except Exception as e:
        logger.error(f"Error updating admin data: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 