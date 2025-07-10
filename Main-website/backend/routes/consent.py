# backend/routes/consent.py
from fastapi import APIRouter, HTTPException, Path, Query, status
from typing import Optional
import logging

from model_preference.preferences import ConsentUpdate
from model_preference.response import DataResponse, ErrorResponse
from services.preferences import PreferencesService
from datetime import datetime

# Set up router
router = APIRouter(
    prefix="/consent",
    tags=["consent"],
    responses={
        404: {"model": ErrorResponse, "description": "User consent not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)

logger = logging.getLogger(__name__)

@router.get("/{user_id}", response_model=DataResponse)
async def get_user_consent(user_id: str = Path(..., description="User ID")):
    """Get user consent status by user ID"""
    try:
        # Use the existing preferences service to get user data
        preferences = await PreferencesService.get_preferences(user_id)
        
        if not preferences:
            # Return empty data with null consent status if user not found
            return DataResponse(
                success=True,
                message="No consent status found for user",
                data={
                    "user_id": user_id,
                    "consent_status": None,
                    "consent_updated_at": None
                }
            )
        
        # Return just the consent-related data
        return DataResponse(
            success=True,
            data={
                "user_id": user_id,
                "consent_status": preferences.get("consent_status"),
                "consent_updated_at": preferences.get("consent_updated_at")
            }
        )
        
    except Exception as e:
        logger.error(f"Error retrieving consent for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve user consent: {str(e)}"
        )

@router.put("/{user_id}", response_model=DataResponse)
async def update_user_consent(
    update: ConsentUpdate,
    user_id: str = Path(..., description="User ID")
):
    """Update user consent status"""
    try:
        # Use the existing consent update method from PreferencesService
        updated = await PreferencesService.update_consent(user_id, update)
        
        return DataResponse(
            success=True,
            message=f"User consent status updated to {update.consent_status}",
            data={
                "user_id": user_id,
                "consent_status": update.consent_status,
                "consent_updated_at": update.timestamp or datetime.utcnow()
            }
        )
    except Exception as e:
        logger.error(f"Error updating consent for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user consent: {str(e)}"
        )

@router.delete("/{user_id}", response_model=DataResponse)
async def delete_user_consent(user_id: str = Path(..., description="User ID")):
    """Delete user consent data"""
    try:
        # Use the existing preferences service to delete user data
        deleted = await PreferencesService.delete_preferences(user_id)
        
        if not deleted:
            return DataResponse(
                success=True,
                message="No consent data found to delete",
            )
            
        return DataResponse(
            success=True,
            message="User consent data deleted successfully"
        )
    except Exception as e:
        logger.error(f"Error deleting consent for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user consent: {str(e)}"
        )