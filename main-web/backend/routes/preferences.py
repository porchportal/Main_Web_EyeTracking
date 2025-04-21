# backend/routes/preferences.py
from fastapi import APIRouter, Depends, HTTPException, status, Path, Query
from typing import Optional, Dict, Any, List
import logging

from model_preference.preferences import UserPreferences, UserPreferencesUpdate, ConsentUpdate
from model_preference.response import DataResponse, ErrorResponse
from services.preferences import PreferencesService

# Set up router
router = APIRouter(
    prefix="/user-preferences",
    tags=["user-preferences"],
    responses={
        404: {"model": ErrorResponse, "description": "User preferences not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)

logger = logging.getLogger(__name__)

@router.get("/{user_id}", response_model=DataResponse[Dict[str, Any]])
async def get_user_preferences(user_id: str = Path(..., description="User ID")):
    """Get user preferences by user ID"""
    try:
        preferences = await PreferencesService.get_preferences(user_id)
        
        if not preferences:
            # Return empty data instead of 404 to simplify client handling
            return DataResponse(
                success=True,
                message="No preferences found for user",
                data={"user_id": user_id, "preferences": {}}
            )
            
        return DataResponse(success=True, data=preferences)
        
    except Exception as e:
        logger.error(f"Error retrieving preferences for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve user preferences: {str(e)}"
        )

@router.post("", response_model=DataResponse[Dict[str, Any]])
async def create_user_preferences(preferences: UserPreferences):
    """Create new user preferences"""
    try:
        created = await PreferencesService.create_preferences(preferences)
        return DataResponse(
            success=True,
            message="User preferences created successfully",
            data=created
        )
    except Exception as e:
        logger.error(f"Error creating preferences for user {preferences.user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user preferences: {str(e)}"
        )

@router.put("/{user_id}", response_model=DataResponse[Dict[str, Any]])
async def update_user_preferences(
    update: UserPreferencesUpdate,
    user_id: str = Path(..., description="User ID")
):
    """Update user preferences"""
    try:
        updated = await PreferencesService.update_preferences(user_id, update)
        return DataResponse(
            success=True,
            message="User preferences updated successfully",
            data=updated
        )
    except Exception as e:
        logger.error(f"Error updating preferences for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user preferences: {str(e)}"
        )

@router.put("/{user_id}/consent", response_model=DataResponse[Dict[str, Any]])
async def update_user_consent(
    update: ConsentUpdate,
    user_id: str = Path(..., description="User ID")
):
    """Update user consent status"""
    try:
        updated = await PreferencesService.update_consent(user_id, update)
        return DataResponse(
            success=True,
            message=f"User consent status updated to {update.consent_status}",
            data=updated
        )
    except Exception as e:
        logger.error(f"Error updating consent for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user consent: {str(e)}"
        )

@router.delete("/{user_id}", response_model=DataResponse)
async def delete_user_preferences(user_id: str = Path(..., description="User ID")):
    """Delete user preferences"""
    try:
        deleted = await PreferencesService.delete_preferences(user_id)
        
        if not deleted:
            return DataResponse(
                success=True,
                message="No preferences found to delete",
            )
            
        return DataResponse(
            success=True,
            message="User preferences deleted successfully"
        )
    except Exception as e:
        logger.error(f"Error deleting preferences for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user preferences: {str(e)}"
        )