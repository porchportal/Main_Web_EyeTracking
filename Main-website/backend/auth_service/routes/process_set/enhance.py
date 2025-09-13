# enhance.py - Routes for handling enhance face functionality
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from typing import List, Dict, Any, Optional
import os
import logging
import httpx
from pydantic import BaseModel

# Import auth
from auth import verify_api_key

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/enhance", tags=["enhance"])

class EnhanceRequest(BaseModel):
    user_id: str
    set_numbers: List[int]
    enhanceFace: bool = True

class EnhanceResponse(BaseModel):
    status: str
    message: str
    data: Optional[Dict[str, Any]] = None

@router.post("/process", dependencies=[Depends(verify_api_key)])
async def process_with_enhance(request: EnhanceRequest):
    """
    Process images with enhance face toggle.
    If enhanceFace=True: saves to /enhance directory
    If enhanceFace=False: saves to /complete directory
    """
    try:
        logger.info(f"Received enhance processing request for user {request.user_id}, enhanceFace={request.enhanceFace}")
        
        # Get image service URL from environment
        image_service_url = os.getenv("IMAGE_SERVICE_URL", "http://image_service:8010")
        
        # Make HTTP call to image service with enhanceFace parameter
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{image_service_url}/process-images",
                json={
                    "setNumbers": request.set_numbers,
                    "userId": request.user_id,
                    "enhanceFace": request.enhanceFace
                },
                timeout=300.0  # 5 minutes timeout
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Image service error: {response.text}"
                )
            
            # Return the response from image service
            return {
                "status": "success",
                "message": f"Images processed successfully with enhanceFace={request.enhanceFace}",
                "data": response.json()
            }
        
    except httpx.RequestError as e:
        logger.error(f"Error connecting to image service: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Image service unavailable"
        )
    except Exception as e:
        logger.error(f"Error in enhance processing: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.get("/status/{user_id}")
async def get_enhance_status(user_id: str):
    """Get the enhance processing status for a user"""
    try:
        # Check if enhance directory exists and has files
        enhance_dir = f"/app/resource_security/public/enhance/{user_id}"
        complete_dir = f"/app/resource_security/public/complete/{user_id}"
        
        enhance_files = []
        complete_files = []
        
        if os.path.exists(enhance_dir):
            enhance_files = [f for f in os.listdir(enhance_dir) if f.endswith(('.jpg', '.png', '.csv'))]
        
        if os.path.exists(complete_dir):
            complete_files = [f for f in os.listdir(complete_dir) if f.endswith(('.jpg', '.png', '.csv'))]
        
        return {
            "status": "success",
            "data": {
                "user_id": user_id,
                "enhance_files_count": len(enhance_files),
                "complete_files_count": len(complete_files),
                "enhance_files": enhance_files[:10],  # Show first 10 files
                "complete_files": complete_files[:10]  # Show first 10 files
            }
        }
    except Exception as e:
        logger.error(f"Error getting enhance status for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.post("/toggle/{user_id}")
async def toggle_enhance_face(user_id: str, enhanceFace: bool):
    """Toggle enhance face setting for a user"""
    try:
        # This could be used to update user preferences
        # For now, just return the toggle status
        return {
            "status": "success",
            "message": f"Enhance face setting updated for user {user_id}",
            "data": {
                "user_id": user_id,
                "enhanceFace": enhanceFace
            }
        }
    except Exception as e:
        logger.error(f"Error toggling enhance face for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
