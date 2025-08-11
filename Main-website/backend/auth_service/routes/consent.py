# backend/routes/consent.py
from fastapi import APIRouter, HTTPException, Path, Query, status
from typing import Optional, List, Dict, Any
import logging
import json
import os
from pathlib import Path as PathLib
from pydantic import BaseModel
from datetime import datetime

from model_preference.preferences import ConsentUpdate, UserPreferencesUpdate
from model_preference.response import DataResponse, ErrorResponse
from db.services.user_preferences_service import UserPreferencesService as PreferencesService
from db.data_centralization import DataCenter, UserProfile, UserSettings, User
from db.mongodb import db

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

# Define paths for consent data
RESOURCE_SECURITY_DIR = PathLib(__file__).parent.parent / "resource_security"
CONSENT_DATA_FILE = RESOURCE_SECURITY_DIR / "consent_data.json"

class ConsentDataModel(BaseModel):
    userId: str
    status: bool
    timestamp: str
    receivedAt: Optional[str] = None

class ConsentInitializationRequest(BaseModel):
    user_id: str
    email: str = "test@example.com"  # Default email as per requirement

class UserProfileUpdate(BaseModel):
    username: str = ""
    sex: str = ""
    age: str = ""
    night_mode: bool = False

def ensure_consent_file_exists():
    """Ensure the consent data file and directory exist"""
    RESOURCE_SECURITY_DIR.mkdir(exist_ok=True)
    if not CONSENT_DATA_FILE.exists():
        CONSENT_DATA_FILE.write_text("[]")

def read_consent_data() -> List[Dict[str, Any]]:
    """Read consent data from JSON file"""
    ensure_consent_file_exists()
    try:
        with open(CONSENT_DATA_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []

def write_consent_data(data: List[Dict[str, Any]]):
    """Write consent data to JSON file"""
    ensure_consent_file_exists()
    with open(CONSENT_DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)



# ============================================================================
# CONSENT STATUS MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/{user_id}", response_model=DataResponse)
async def get_user_consent(user_id: str = Path(..., description="User ID")):
    """Get user consent status by user ID"""
    try:
        from db.services.user_preferences_service import UserPreferencesService
        
        # Get user data from user_preferences collection
        user_data = await UserPreferencesService.get_user_data_from_preferences(user_id)
        
        if not user_data:
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
                "consent_status": user_data.get("consent_accepted"),
                "consent_updated_at": user_data.get("consent_timestamp")
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
        from db.services.user_preferences_service import UserPreferencesService
        
        # Get existing user data
        existing_data = await UserPreferencesService.get_user_data_from_preferences(user_id)
        
        if existing_data:
            # Update existing data
            existing_data["consent_accepted"] = update.consent_status
            existing_data["consent_timestamp"] = (update.timestamp or datetime.utcnow()).isoformat()
            existing_data["updated_at"] = datetime.utcnow()
            
            # Save updated data
            key = f"user_data_{user_id}"
            document = {
                "key": key,
                "value": existing_data,
                "data_type": "user_consent",
                "updated_at": datetime.utcnow()
            }
            
            collection = db.get_db()["user_preferences"]
            result = await collection.update_one(
                {"key": key},
                {"$set": document},
                upsert=True
            )
            
            updated = result.acknowledged
        else:
            # Create new user data with consent
            user_profile = UserProfile(
                username="",
                sex="",
                age="",
                night_mode=False
            )
            
            updated = await UserPreferencesService.save_user_data_to_preferences(
                user_id, user_profile, consent_accepted=update.consent_status
            )
        
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
        from db.services.user_preferences_service import UserPreferencesService
        
        # Delete user data from user_preferences collection
        deleted = await UserPreferencesService.delete_user_from_preferences(user_id)
        
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

# ============================================================================
# USER INITIALIZATION ENDPOINTS (from consent_initialization.py)
# ============================================================================

@router.post("/initialize-user", response_model=DataResponse)
async def initialize_user_data(request: ConsentInitializationRequest):
    """Initialize user data using both services when consent is accepted"""
    try:
        from db.services.user_preferences_service import UserPreferencesService
        from db.services.data_centralization_service import DataCentralizationService
        from db.data_centralization import UserSettings
        
        user_id = request.user_id
        email = request.email
        
        # Create user profile using DataCenter models
        user_profile = UserProfile(
            username="",
            sex="",
            age="",
            night_mode=False
        )
        
        # Create default user settings
        user_settings = UserSettings(
            times_set_random=3,
            delay_set_random=5,
            run_every_of_random=2,
            set_timeRandomImage=1,
            times_set_calibrate=5,
            every_set=1,
            zoom_percentage=150,
            position_zoom=[50, 100],
            currentlyPage="home",
            state_isProcessOn=True,
            freeState=1,
            buttons_order="random,calibrate,process",
            order_click="random",
            image_background_paths=["/backgrounds/default.jpg"],
            public_data_access=False,
            enable_background_change=False
        )
        
        # Save user profile to user_preferences collection
        profile_save_result = await UserPreferencesService.save_user_data_to_preferences(user_id, user_profile, consent_accepted=True)
        
        # Save user settings to data_centralization collection
        settings_save_result = await DataCentralizationService.save_user_settings_with_model(user_id, user_settings)
        
        if not profile_save_result or not settings_save_result:
            raise Exception("Failed to save user data")
        
        logger.info(f"Successfully initialized user data for {user_id}")
        
        return DataResponse(
            success=True,
            message="User data initialized successfully",
            data={
                "user_id": user_id,
                "consent_accepted": True,
                "timestamp": datetime.utcnow(),
                "user_preferences_saved": profile_save_result,
                "data_centralization_saved": settings_save_result
            }
        )
        
    except Exception as e:
        logger.error(f"Error initializing user data for {request.user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize user data: {str(e)}"
        )

@router.get("/check-user/{user_id}", response_model=DataResponse)
async def check_user_initialization(user_id: str):
    """Check if user data has been initialized"""
    try:
        from db.services.user_preferences_service import UserPreferencesService
        
        # Check if user exists in user_preferences collection
        user_data = await UserPreferencesService.get_user_data_from_preferences(user_id)
        
        is_initialized = user_data is not None
        has_consent = user_data is not None and user_data.get("consent_accepted", False)
        
        return DataResponse(
            success=True,
            data={
                "user_id": user_id,
                "is_initialized": is_initialized,
                "has_consent_data": has_consent,
                "user_data": user_data if user_data else None,
                "consent_data": user_data if user_data else None
            }
        )
        
    except Exception as e:
        logger.error(f"Error checking user initialization for {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check user initialization: {str(e)}"
        )

@router.put("/update-user-profile/{user_id}", response_model=DataResponse)
async def update_user_profile(user_id: str, profile_update: UserProfileUpdate):
    """Update user profile and settings using both services"""
    try:
        from db.services.user_preferences_service import UserPreferencesService
        from db.services.data_centralization_service import DataCentralizationService
        from db.data_centralization import UserSettings
        
        # Update the profile
        updated_profile = UserProfile(
            username=profile_update.username,
            sex=profile_update.sex,
            age=profile_update.age,
            night_mode=profile_update.night_mode
        )
        
        # Create default user settings
        user_settings = UserSettings(
            times_set_random=3,
            delay_set_random=5,
            run_every_of_random=2,
            set_timeRandomImage=1,
            times_set_calibrate=5,
            every_set=1,
            zoom_percentage=150,
            position_zoom=[50, 100],
            currentlyPage="home",
            state_isProcessOn=True,
            freeState=1,
            buttons_order="random,calibrate,process",
            order_click="random",
            image_background_paths=["/backgrounds/default.jpg"],
            public_data_access=False,
            enable_background_change=False
        )
        
        # Save profile to user_preferences collection
        profile_save_result = await UserPreferencesService.update_user_profile_in_preferences(user_id, updated_profile)
        
        # Save settings to data_centralization collection
        settings_save_result = await DataCentralizationService.save_user_settings_with_model(user_id, user_settings)
        
        if not profile_save_result or not settings_save_result:
            raise Exception("Failed to update user data")
        
        logger.info(f"Successfully updated user profile and settings for {user_id}")
        
        return DataResponse(
            success=True,
            message="User profile and settings updated successfully",
            data={
                "user_id": user_id,
                "profile": updated_profile.model_dump(),
                "settings": user_settings.model_dump()
            }
        )
        
    except Exception as e:
        logger.error(f"Error updating user profile for {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user profile: {str(e)}"
        )

# ============================================================================
# ADMIN ENDPOINTS FOR CONSENT DATA MANAGEMENT
# ============================================================================

@router.get("/admin/consent-data")
async def get_admin_consent_data():
    """Get all consent data for admin interface"""
    try:
        consent_data = read_consent_data()
        logger.info(f"Retrieved {len(consent_data)} consent records")
        return consent_data
    except Exception as e:
        logger.error(f"Error reading consent data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to read consent data"
        )

@router.post("/admin/consent-data")
async def save_admin_consent_data(consent_data: ConsentDataModel):
    """Save consent data to admin file"""
    try:
        # Read existing data
        existing_data = read_consent_data()
        
        # Check if user already exists
        existing_index = next(
            (i for i, data in enumerate(existing_data) if data.get("userId") == consent_data.userId),
            -1
        )
        
        # Prepare data to save
        data_to_save = consent_data.dict()
        data_to_save["receivedAt"] = datetime.utcnow().isoformat()
        
        if existing_index != -1:
            # Update existing entry
            existing_data[existing_index] = data_to_save
        else:
            # Add new entry
            existing_data.append(data_to_save)
        
        # Save updated data
        write_consent_data(existing_data)
        logger.info(f"Saved consent data for user {consent_data.userId}")
        
        return {"success": True, "message": "Consent data saved successfully"}
    except Exception as e:
        logger.error(f"Error saving consent data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save consent data"
        )

@router.delete("/admin/consent-data/{user_id}")
async def delete_admin_consent_data(user_id: str):
    """Delete consent data from admin file"""
    try:
        # Read existing data
        existing_data = read_consent_data()
        
        # Filter out the user to be deleted
        updated_data = [data for data in existing_data if data.get("userId") != user_id]
        
        # Save updated data
        write_consent_data(updated_data)
        logger.info(f"Deleted consent data for user {user_id}")
        
        return {"success": True, "message": "Consent data deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting consent data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete consent data"
        )