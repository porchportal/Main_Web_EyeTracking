from typing import List, Any, Dict, Optional
from pydantic import BaseModel, Field, conint, field_validator
from pydantic.config import ConfigDict
import logging
from .mongodb import MongoDB
from datetime import datetime


# --------------------
# USER PROFILE
# --------------------
class UserProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")  # ignore unknown fields
    username: str = Field(default="", max_length=100)
    # email: str = Field(default="", max_length=255)
    sex: str = Field(default="")
    age: str = Field(default="")
    night_mode: bool = False


# --------------------
# SETTINGS
# --------------------
class UserSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")  # ignore unknown fields

    # --- randomizer ---
    times_set_random: conint(ge=0) = 1
    delay_set_random: conint(ge=0) = 3
    
    # --- process image background ---
    every_set: conint(ge=0) = 0
    set_timeRandomImage: conint(ge=0) = 1

    # --- calibrate ---
    times_set_calibrate: conint(ge=0) = 1
    run_every_of_random: conint(ge=0) = 1

    # --- ui ---
    zoom_percentage: conint(ge=10, le=400) = 100
    position_zoom: List[int] = Field(default_factory=lambda: [0, 0])
    currentlyPage: str = "home"

    # --- system ---
    state_isProcessOn: bool = False
    freeState: conint(ge=0) = 0
    buttons_order: str = ""
    # order_click: str = ""

    # --- assets (multiple paths) ---
    image_background_paths: List[str] = Field(default_factory=list)

    # --- system control ---
    public_data_access: bool = False
    enable_background_change: bool = False

    # ---- validators ----
    @field_validator("position_zoom")
    @classmethod
    def validate_position_zoom(cls, v: List[int]) -> List[int]:
        if len(v) != 2:
            raise ValueError("position_zoom must be exactly [x, y]")
        return v

    @field_validator("image_background_paths", mode="before")
    @classmethod
    def coerce_paths_to_list(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            return [v]
        return v


# --------------------
# MAIN USER MODEL
# --------------------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")  # ignore unknown fields
    profile: UserProfile = Field(default_factory=UserProfile)
    settings: UserSettings = Field(default_factory=UserSettings)

    def merge_update(self, patches: Dict[str, Any]) -> "User":
        """Partial update helper."""
        return self.model_copy(update=patches)


# --------------------
# DATA CENTER SERVICE
# --------------------
logger = logging.getLogger(__name__)

class DataCenterService:
    """
    Service class to manage user data using MongoDB.
    Provides the same interface as the original DataCenter class.
    """
    
    def __init__(self):
        self.initialized = False
    
    async def initialize(self) -> bool:
        """Initialize the data center service."""
        try:
            if not await MongoDB.ensure_connected():
                logger.error("Failed to connect to MongoDB for DataCenter initialization")
                return False
            self.initialized = True
            logger.info("DataCenter service initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Error initializing DataCenter service: {e}")
            return False
    
    async def get_value(self, key: str) -> Optional[Any]:
        """Get a value by key from MongoDB."""
        try:
            if not self.initialized:
                await self.initialize()
            
            if not await MongoDB.ensure_connected():
                logger.error("MongoDB connection not available")
                return None
            
            db = MongoDB.get_db()
            if db is None:
                return None
            
            # Get from data_centralization collection in eye_tracking database
            result = await db.data_centralization.find_one({"key": key})
            if result:
                return result.get("value")
            return None
        except Exception as e:
            logger.error(f"Error getting value for key {key}: {e}")
            return None
    
    async def update_value(self, key: str, value: Any, data_type: str = "json") -> bool:
        """Update a value in MongoDB."""
        try:
            if not self.initialized:
                await self.initialize()
            
            if not await MongoDB.ensure_connected():
                logger.error("MongoDB connection not available")
                return False
            
            db = MongoDB.get_db()
            if db is None:
                return False
            
            # Update in data_centralization collection in eye_tracking database
            update_data = {
                "key": key,
                "value": value,
                "data_type": data_type,
                "updated_at": datetime.utcnow(),
                "created_at": datetime.utcnow()  # Will only be set on insert
            }
            
            result = await db.data_centralization.update_one(
                {"key": key},
                {
                    "$set": {
                        "key": key,
                        "value": value,
                        "data_type": data_type,
                        "updated_at": datetime.utcnow()
                    },
                    "$setOnInsert": {
                        "created_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            
            logger.info(f"Updated key '{key}' in data_centralization collection")
            return result.acknowledged
        except Exception as e:
            logger.error(f"Error updating value for key {key}: {e}")
            return False
    
    async def delete_value(self, key: str) -> bool:
        """Delete a value by key from MongoDB."""
        try:
            if not self.initialized:
                await self.initialize()
            
            if not await MongoDB.ensure_connected():
                logger.error("MongoDB connection not available")
                return False
            
            db = MongoDB.get_db()
            if db is None:
                return False
            
            result = await db.data_centralization.delete_one({"key": key})
            logger.info(f"Deleted key '{key}' from data_centralization collection")
            return result.acknowledged
        except Exception as e:
            logger.error(f"Error deleting value for key {key}: {e}")
            return False
    
    async def get_all_values(self) -> Dict[str, Any]:
        """Get all values from MongoDB."""
        try:
            if not self.initialized:
                await self.initialize()
            
            if not await MongoDB.ensure_connected():
                logger.error("MongoDB connection not available")
                return {}
            
            db = MongoDB.get_db()
            if db is None:
                return {}
            
            cursor = db.data_centralization.find({})
            values = {}
            async for doc in cursor:
                values[doc["key"]] = doc.get("value")
            
            logger.info(f"Retrieved {len(values)} values from data_centralization collection")
            return values
        except Exception as e:
            logger.error(f"Error getting all values: {e}")
            return {}
    
    async def get_user_complete_data(self, user_id: str) -> Dict[str, Any]:
        """Get complete user data including settings and image&pdf_canva."""
        try:
            settings = await self.get_value(f"settings_{user_id}")
            image_canva = await self.get_value(f"image&pdf_canva_{user_id}")
            
            return {
                "settings": settings,
                "image&pdf_canva": image_canva
            }
        except Exception as e:
            logger.error(f"Error getting complete user data for {user_id}: {e}")
            return {"settings": None, "image&pdf_canva": None}
    
    async def update_user_settings_with_images(self, user_id: str, settings: Dict[str, Any], image_canva_data: Optional[Any] = None) -> bool:
        """Update user settings and optionally image&pdf_canva data."""
        try:
            # Update settings
            settings_result = await self.update_value(f"settings_{user_id}", settings, "json")
            
            # Update image&pdf_canva if provided
            image_result = True
            if image_canva_data is not None:
                image_result = await self.update_value(f"image&pdf_canva_{user_id}", image_canva_data, "image")
            
            return settings_result and image_result
        except Exception as e:
            logger.error(f"Error updating user settings with images for {user_id}: {e}")
            return False
    
    async def save_user(self, user_id: str, user: User) -> bool:
        """Save a complete User object to the database."""
        try:
            # Save user profile
            profile_result = await self.update_value(f"profile_{user_id}", user.profile.model_dump(), "json")
            
            # Save user settings  
            settings_result = await self.update_value(f"settings_{user_id}", user.settings.model_dump(), "json")
            
            return profile_result and settings_result
        except Exception as e:
            logger.error(f"Error saving user {user_id}: {e}")
            return False

    async def save_user_profile_to_preferences(self, user_id: str, profile: UserProfile, consent_accepted: bool = True) -> bool:
        """Save user profile to user_preferences collection in the specified format."""
        try:
            from db.services.user_preferences_service import UserPreferencesService
            
            # Use the UserPreferencesService to save in the correct format
            result = await UserPreferencesService.save_user_data_to_preferences(user_id, profile, consent_accepted)
            
            logger.info(f"Saved user profile to user_preferences for user {user_id}")
            return result
        except Exception as e:
            logger.error(f"Error saving user profile to preferences for {user_id}: {e}")
            return False

    async def save_user_settings_to_centralization(self, user_id: str, user_settings) -> bool:
        """Save user settings to data_centralization collection using UserSettings model."""
        try:
            from db.services.data_centralization_service import DataCentralizationService
            
            # Use the DataCentralizationService to save settings
            result = await DataCentralizationService.save_user_settings_with_model(user_id, user_settings)
            
            logger.info(f"Saved user settings to data_centralization for user {user_id}")
            return result
        except Exception as e:
            logger.error(f"Error saving user settings to centralization for {user_id}: {e}")
            return False

    async def get_user_settings_from_centralization(self, user_id: str):
        """Get user settings from data_centralization collection using UserSettings model."""
        try:
            from db.services.data_centralization_service import DataCentralizationService
            
            # Use the DataCentralizationService to get settings
            settings = await DataCentralizationService.get_user_settings_with_model(user_id)
            
            logger.info(f"Retrieved user settings from data_centralization for user {user_id}")
            return settings
        except Exception as e:
            logger.error(f"Error getting user settings from centralization for {user_id}: {e}")
            return None
    
    async def get_user(self, user_id: str) -> Optional[User]:
        """Get a complete User object from the database."""
        try:
            # Get profile data
            profile_data = await self.get_value(f"profile_{user_id}")
            if profile_data is None:
                profile_data = {}
            
            # Get settings data
            settings_data = await self.get_value(f"settings_{user_id}")
            if settings_data is None:
                settings_data = {}
            
            # Create User object
            user = User(
                profile=UserProfile(**profile_data),
                settings=UserSettings(**settings_data)
            )
            
            return user
        except Exception as e:
            logger.error(f"Error getting user {user_id}: {e}")
            return None
    
    async def delete_user(self, user_id: str) -> bool:
        """Delete all data for a user."""
        try:
            # Delete all keys related to this user
            keys_to_delete = [
                f"profile_{user_id}",
                f"settings_{user_id}",
                f"image_{user_id}",
                f"zoom_{user_id}",
                f"image&pdf_canva_{user_id}"
            ]
            
            results = []
            for key in keys_to_delete:
                result = await self.delete_value(key)
                results.append(result)
            
            return all(results)
        except Exception as e:
            logger.error(f"Error deleting user {user_id}: {e}")
            return False


# Create singleton instance
data_center_service = DataCenterService()

# Create class-level interface for compatibility with existing code
class DataCenter:
    """
    Static class interface for compatibility with existing code.
    Delegates to the data_center_service instance.
    """
    
    @staticmethod
    async def initialize() -> bool:
        return await data_center_service.initialize()
    
    @staticmethod
    async def get_value(key: str) -> Optional[Any]:
        return await data_center_service.get_value(key)
    
    @staticmethod
    async def update_value(key: str, value: Any, data_type: str = "json") -> bool:
        return await data_center_service.update_value(key, value, data_type)
    
    @staticmethod
    async def delete_value(key: str) -> bool:
        return await data_center_service.delete_value(key)
    
    @staticmethod
    async def get_all_values() -> Dict[str, Any]:
        return await data_center_service.get_all_values()
    
    @staticmethod
    async def get_user_complete_data(user_id: str) -> Dict[str, Any]:
        return await data_center_service.get_user_complete_data(user_id)
    
    @staticmethod
    async def update_user_settings_with_images(user_id: str, settings: Dict[str, Any], image_canva_data: Optional[Any] = None) -> bool:
        return await data_center_service.update_user_settings_with_images(user_id, settings, image_canva_data)
    
    @staticmethod
    async def save_user(user_id: str, user: User) -> bool:
        return await data_center_service.save_user(user_id, user)
    
    @staticmethod
    async def get_user(user_id: str) -> Optional[User]:
        return await data_center_service.get_user(user_id)
    
    @staticmethod
    async def delete_user(user_id: str) -> bool:
        return await data_center_service.delete_user(user_id)
    
    @staticmethod
    async def save_user_profile_to_preferences(user_id: str, profile: UserProfile, consent_accepted: bool = True) -> bool:
        return await data_center_service.save_user_profile_to_preferences(user_id, profile, consent_accepted)
    
    @staticmethod
    async def save_user_settings_to_centralization(user_id: str, user_settings) -> bool:
        return await data_center_service.save_user_settings_to_centralization(user_id, user_settings)
    
    @staticmethod
    async def get_user_settings_from_centralization(user_id: str):
        return await data_center_service.get_user_settings_from_centralization(user_id)
