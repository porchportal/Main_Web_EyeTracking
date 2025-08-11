# backend/services/data_centralization_service.py
from typing import Optional, Dict, Any, List
import logging
from datetime import datetime
from bson import ObjectId
from pymongo.errors import PyMongoError

from db.mongodb import db

logger = logging.getLogger(__name__)

class DataCentralizationService:
    """Service for managing data centralization in MongoDB"""
    collection_name = "data_centralization"

    @classmethod
    async def get_value(cls, key: str) -> Optional[Any]:
        """Get a value by key from data_centralization collection"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Find document by key
            result = await collection.find_one({"key": key})
            
            if result:
                return result.get("value")
            return None
            
        except PyMongoError as e:
            logger.error(f"Database error retrieving value for key {key}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving value for key {key}: {e}")
            raise

    @classmethod
    async def update_value(cls, key: str, value: Any, data_type: str = "json") -> bool:
        """Update a value in data_centralization collection"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Prepare update data
            update_data = {
                "key": key,
                "value": value,
                "data_type": data_type,
                "updated_at": datetime.utcnow()
            }
            
            # Update with upsert (create if doesn't exist)
            result = await collection.update_one(
                {"key": key},
                {
                    "$set": update_data,
                    "$setOnInsert": {"created_at": datetime.utcnow()}
                },
                upsert=True
            )
            
            logger.info(f"Updated key '{key}' in data_centralization collection")
            return result.acknowledged
            
        except PyMongoError as e:
            logger.error(f"Database error updating value for key {key}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error updating value for key {key}: {e}")
            raise

    @classmethod
    async def delete_value(cls, key: str) -> bool:
        """Delete a value by key from data_centralization collection"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Delete document by key
            result = await collection.delete_one({"key": key})
            
            logger.info(f"Deleted key '{key}' from data_centralization collection")
            return result.acknowledged
            
        except PyMongoError as e:
            logger.error(f"Database error deleting value for key {key}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error deleting value for key {key}: {e}")
            raise

    @classmethod
    async def get_all_values(cls) -> Dict[str, Any]:
        """Get all values from data_centralization collection"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Find all documents
            cursor = collection.find({})
            values = {}
            
            async for doc in cursor:
                values[doc["key"]] = doc.get("value")
            
            logger.info(f"Retrieved {len(values)} values from data_centralization collection")
            return values
            
        except PyMongoError as e:
            logger.error(f"Database error retrieving all values: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving all values: {e}")
            raise

    @classmethod
    async def get_user_settings(cls, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user settings from data_centralization collection"""
        try:
            settings_key = f"settings_{user_id}"
            return await cls.get_value(settings_key)
            
        except Exception as e:
            logger.error(f"Error getting user settings for {user_id}: {e}")
            raise

    @classmethod
    async def get_user_settings_with_model(cls, user_id: str):
        """Get user settings using UserSettings model from data_centralization collection"""
        try:
            # Import UserSettings for validation
            try:
                from db.data_centralization import UserSettings
            except ImportError:
                from pydantic import BaseModel, Field, conint
                from pydantic.config import ConfigDict
                from typing import List
                
                class UserSettings(BaseModel):
                    model_config = ConfigDict(extra="ignore")
                    
                    # --- randomizer ---
                    times_set_random: conint(ge=0) = 1
                    delay_set_random: conint(ge=0) = 3
                    run_every_of_random: conint(ge=0) = 1
                    set_timeRandomImage: conint(ge=0) = 1
                    
                    # --- calibrate ---
                    times_set_calibrate: conint(ge=0) = 1
                    every_set: conint(ge=0) = 0
                    
                    # --- ui ---
                    zoom_percentage: conint(ge=10, le=400) = 100
                    position_zoom: List[int] = Field(default_factory=lambda: [0, 0])
                    currentlyPage: str = "home"
                    
                    # --- system ---
                    state_isProcessOn: bool = False
                    freeState: conint(ge=0) = 0
                    buttons_order: str = ""
                    order_click: str = ""
                    
                    # --- assets (multiple paths) ---
                    image_background_paths: List[str] = Field(default_factory=list)
                    
                    # --- system control ---
                    public_data_access: bool = False
                    enable_background_change: bool = False
            
            # Get settings data
            settings_data = await cls.get_user_settings(user_id)
            
            if settings_data:
                # Convert to UserSettings model
                settings = UserSettings(**settings_data)
                logger.info(f"Retrieved user settings with model for user {user_id}")
                return settings
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user settings with model for {user_id}: {e}")
            raise

    @classmethod
    async def save_user_settings(cls, user_id: str, settings: Dict[str, Any]) -> bool:
        """Save user settings to data_centralization collection"""
        try:
            settings_key = f"settings_{user_id}"
            return await cls.update_value(settings_key, settings, "json")
            
        except Exception as e:
            logger.error(f"Error saving user settings for {user_id}: {e}")
            raise

    @classmethod
    async def save_user_settings_with_model(cls, user_id: str, user_settings) -> bool:
        """Save user settings using UserSettings model to data_centralization collection"""
        try:
            # Import UserSettings for validation
            try:
                from db.data_centralization import UserSettings
            except ImportError:
                from pydantic import BaseModel, Field, conint
                from pydantic.config import ConfigDict
                from typing import List
                
                class UserSettings(BaseModel):
                    model_config = ConfigDict(extra="ignore")
                    
                    # --- randomizer ---
                    times_set_random: conint(ge=0) = 1
                    delay_set_random: conint(ge=0) = 3
                    run_every_of_random: conint(ge=0) = 1
                    set_timeRandomImage: conint(ge=0) = 1
                    
                    # --- calibrate ---
                    times_set_calibrate: conint(ge=0) = 1
                    every_set: conint(ge=0) = 0
                    
                    # --- ui ---
                    zoom_percentage: conint(ge=10, le=400) = 100
                    position_zoom: List[int] = Field(default_factory=lambda: [0, 0])
                    currentlyPage: str = "home"
                    
                    # --- system ---
                    state_isProcessOn: bool = False
                    freeState: conint(ge=0) = 0
                    buttons_order: str = ""
                    order_click: str = ""
                    
                    # --- assets (multiple paths) ---
                    image_background_paths: List[str] = Field(default_factory=list)
                    
                    # --- system control ---
                    public_data_access: bool = False
                    enable_background_change: bool = False
            
            # Validate settings data
            if isinstance(user_settings, dict):
                settings = UserSettings(**user_settings)
            else:
                settings = user_settings
            
            # Convert to dict for storage
            settings_dict = settings.model_dump()
            
            # Save to data_centralization collection
            settings_key = f"settings_{user_id}"
            result = await cls.update_value(settings_key, settings_dict, "json")
            
            logger.info(f"Saved user settings with model to data_centralization for user {user_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error saving user settings with model for {user_id}: {e}")
            raise

    @classmethod
    async def get_user_complete_data(cls, user_id: str) -> Dict[str, Any]:
        """Get complete user data including settings and image&pdf_canva"""
        try:
            settings = await cls.get_value(f"settings_{user_id}")
            image_canva = await cls.get_value(f"image&pdf_canva_{user_id}")
            
            return {
                "settings": settings,
                "image&pdf_canva": image_canva
            }
            
        except Exception as e:
            logger.error(f"Error getting complete user data for {user_id}: {e}")
            return {"settings": None, "image&pdf_canva": None}

    @classmethod
    async def update_user_settings_with_images(cls, user_id: str, settings: Dict[str, Any], image_canva_data: Optional[Any] = None) -> bool:
        """Update user settings and optionally image&pdf_canva data"""
        try:
            # Update settings
            settings_result = await cls.save_user_settings(user_id, settings)
            
            # Update image&pdf_canva if provided
            image_result = True
            if image_canva_data is not None:
                image_result = await cls.update_value(f"image&pdf_canva_{user_id}", image_canva_data, "image")
            
            return settings_result and image_result
            
        except Exception as e:
            logger.error(f"Error updating user settings with images for {user_id}: {e}")
            raise

    @classmethod
    async def delete_user_settings(cls, user_id: str) -> bool:
        """Delete user settings data from data_centralization collection"""
        try:
            # Delete settings-related keys
            keys_to_delete = [
                f"settings_{user_id}",
                f"image_{user_id}",
                f"zoom_{user_id}",
                f"image&pdf_canva_{user_id}"
            ]
            
            results = []
            for key in keys_to_delete:
                result = await cls.delete_value(key)
                results.append(result)
            
            return all(results)
            
        except Exception as e:
            logger.error(f"Error deleting user settings for {user_id}: {e}")
            raise

    @classmethod
    async def initialize_collection(cls):
        """Create indexes for the data_centralization collection"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Create index on key for faster lookups
            try:
                await collection.create_index("key", unique=True)
            except Exception as e:
                if "IndexKeySpecsConflict" in str(e):
                    logger.info("Index already exists, skipping key index creation")
                else:
                    raise
            
            # Create index on data_type for filtering
            try:
                await collection.create_index("data_type")
            except Exception as e:
                if "IndexKeySpecsConflict" in str(e):
                    logger.info("Index already exists, skipping data_type index creation")
                else:
                    raise
            
            # Create index on updated_at for querying recent changes
            try:
                await collection.create_index("updated_at")
            except Exception as e:
                if "IndexKeySpecsConflict" in str(e):
                    logger.info("Index already exists, skipping updated_at index creation")
                else:
                    raise
            
            logger.info(f"Initialized {cls.collection_name} collection with indexes")
            
        except PyMongoError as e:
            logger.error(f"Database error initializing data_centralization collection: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error initializing data_centralization collection: {e}")
            raise

    @classmethod
    async def get_values_by_type(cls, data_type: str) -> Dict[str, Any]:
        """Get all values of a specific data type"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Find documents by data_type
            cursor = collection.find({"data_type": data_type})
            values = {}
            
            async for doc in cursor:
                values[doc["key"]] = doc.get("value")
            
            logger.info(f"Retrieved {len(values)} values of type '{data_type}' from data_centralization collection")
            return values
            
        except PyMongoError as e:
            logger.error(f"Database error retrieving values by type {data_type}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving values by type {data_type}: {e}")
            raise

    # ========================================
    # USER PROFILE INTEGRATION METHODS
    # ========================================

    @classmethod
    async def get_all_user_profiles(cls) -> Dict[str, Any]:
        """Get all user profile data from data_centralization collection"""
        try:
            return await cls.get_values_by_type("user_consent")
        except Exception as e:
            logger.error(f"Error getting all user profiles: {e}")
            raise

    @classmethod
    async def get_user_profile(cls, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user profile data from data_centralization collection"""
        try:
            key = f"user_data_{user_id}"
            value = await cls.get_value(key)
            
            if value and value.get("data_type") == "user_consent":
                return value
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user profile for {user_id}: {e}")
            raise

    @classmethod
    async def save_user_profile(cls, user_id: str, profile_data: Dict[str, Any], consent_accepted: bool = True) -> bool:
        """Save user profile data to data_centralization collection"""
        try:
            # Import UserProfile for validation
            try:
                from db.data_centralization import UserProfile
            except ImportError:
                from pydantic import BaseModel, Field
                from pydantic.config import ConfigDict
                
                class UserProfile(BaseModel):
                    model_config = ConfigDict(extra="ignore")
                    username: str = Field(default="", max_length=100)
                    sex: str = Field(default="")
                    age: str = Field(default="")
                    night_mode: bool = False
            
            # Validate profile data
            profile = UserProfile(**profile_data)
            
            # Prepare the value object
            value_data = {
                "user_id": user_id,
                "consent_accepted": consent_accepted,
                "consent_timestamp": datetime.utcnow().isoformat(),
                "profile": profile.model_dump(),
                "updated_at": datetime.utcnow()
            }
            
            # Save to collection
            key = f"user_data_{user_id}"
            result = await cls.update_value(
                key=key,
                value=value_data,
                data_type="user_consent"
            )
            
            logger.info(f"Saved user profile to data_centralization for user {user_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error saving user profile for {user_id}: {e}")
            raise
