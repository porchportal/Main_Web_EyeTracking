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

# ============================================================================
# USER INITIALIZATION ENDPOINTS (from consent_initialization.py)
# ============================================================================

@router.post("/initialize-user", response_model=DataResponse)
async def initialize_user_data(request: ConsentInitializationRequest):
    """Initialize user data using DataCenter when consent is accepted"""
    try:
        user_id = request.user_id
        email = request.email
        
        # Initialize DataCenter
        await DataCenter.initialize()
        
        # Create user profile using DataCenter models
        user_profile = UserProfile(
            username="",
            sex="",
            age="",
            night_mode=False
        )
        
        # Create user settings using DataCenter models
        user_settings = UserSettings(
            times_set_random=1,
            delay_set_random=3,
            run_every_of_random=1,
            set_timeRandomImage=1,
            times_set_calibrate=1,
            every_set=0,
            zoom_percentage=150,
            position_zoom=[0, 0],
            currentlyPage="home",
            state_isProcessOn=False,
            freeState=0,
            buttons_order="",
            order_click="",
            image_background_paths=["/backgrounds/one.jpg"],
            public_data_access=False,
            enable_background_change=False
        )
        
        # Create complete user object
        user = User(profile=user_profile, settings=user_settings)
        
        # Save user to DataCenter
        save_result = await DataCenter.save_user(user_id, user)
        
        if not save_result:
            raise Exception("Failed to save user data to DataCenter")
        
        # Also save to user_preferences collection for consent tracking
        await PreferencesService.initialize_collection()
        
        # Create consent record in user_preferences
        consent_update = ConsentUpdate(consent_status=True)
        await PreferencesService.update_consent(user_id, consent_update)
        
        logger.info(f"Successfully initialized user data for {user_id}")
        
        return DataResponse(
            success=True,
            message="User data initialized successfully",
            data={
                "user_id": user_id,
                "consent_accepted": True,
                "timestamp": datetime.utcnow(),
                "data_center_saved": save_result
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
        # Initialize DataCenter
        await DataCenter.initialize()
        
        # Check if user exists in DataCenter
        user_data = await DataCenter.get_user(user_id)
        
        # Also check user_preferences for consent status
        await PreferencesService.initialize_collection()
        user_preferences = await PreferencesService.get_preferences(user_id)
        
        is_initialized = user_data is not None
        has_consent = user_preferences is not None
        
        return DataResponse(
            success=True,
            data={
                "user_id": user_id,
                "is_initialized": is_initialized,
                "has_consent_data": has_consent,
                "user_data": user_data.model_dump() if user_data else None,
                "consent_data": user_preferences if user_preferences else None
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
    """Update user profile using DataCenter"""
    try:
        # Initialize DataCenter
        await DataCenter.initialize()
        
        # Get existing user data
        existing_user = await DataCenter.get_user(user_id)
        
        if not existing_user:
            # If no user exists, create them first
            await initialize_user_data(ConsentInitializationRequest(
                user_id=user_id,
                email="test@example.com"
            ))
            existing_user = await DataCenter.get_user(user_id)
        
        # Update the profile
        updated_profile = UserProfile(
            username=profile_update.username,
            sex=profile_update.sex,
            age=profile_update.age,
            night_mode=profile_update.night_mode
        )
        
        # Create updated user object
        updated_user = User(
            profile=updated_profile,
            settings=existing_user.settings
        )
        
        # Save updated user
        save_result = await DataCenter.save_user(user_id, updated_user)
        
        if not save_result:
            raise Exception("Failed to update user profile")
        
        logger.info(f"Successfully updated user profile for {user_id}")
        
        return DataResponse(
            success=True,
            message="User profile updated successfully",
            data={
                "user_id": user_id,
                "profile": updated_profile.model_dump()
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