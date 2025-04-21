# backend/services/preferences.py
from typing import Optional, Dict, Any, List
import logging
from datetime import datetime
from bson import ObjectId
from pymongo.errors import DuplicateKeyError, PyMongoError

from model_preference.preferences import UserPreferences, UserPreferencesUpdate, ConsentUpdate
from db.mongodb import db

logger = logging.getLogger(__name__)

class PreferencesService:
    """Service for managing user preferences in MongoDB"""
    collection_name = "user_preferences"

    @classmethod
    async def get_preferences(cls, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user preferences by user ID"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Find user preferences document
            preferences = await collection.find_one({"user_id": user_id})
            
            if preferences:
                # Convert ObjectId to string for JSON serialization
                preferences["_id"] = str(preferences["_id"])
                return preferences
                
            return None
            
        except PyMongoError as e:
            logger.error(f"Database error retrieving preferences for user {user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving preferences for user {user_id}: {e}")
            raise

    @classmethod
    async def create_preferences(cls, preferences: UserPreferences) -> Dict[str, Any]:
        """Create new user preferences"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Convert Pydantic model to dict
            preferences_dict = preferences.dict()
            
            # Ensure created_at and updated_at are set
            now = datetime.utcnow()
            preferences_dict["created_at"] = now
            preferences_dict["updated_at"] = now
            
            # Create preferences document
            result = await collection.insert_one(preferences_dict)
            
            if result.inserted_id:
                # Get the created document with the ID
                created_preferences = await collection.find_one({"_id": result.inserted_id})
                
                if created_preferences:
                    created_preferences["_id"] = str(created_preferences["_id"])
                    return created_preferences
                    
            raise Exception("Failed to retrieve created preferences")
            
        except DuplicateKeyError:
            logger.warning(f"User preferences already exist for user {preferences.user_id}")
            # Get existing preferences instead
            existing = await cls.get_preferences(preferences.user_id)
            if existing:
                return existing
            raise
        except PyMongoError as e:
            logger.error(f"Database error creating preferences for user {preferences.user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error creating preferences for user {preferences.user_id}: {e}")
            raise

    @classmethod
    async def update_preferences(cls, user_id: str, update: UserPreferencesUpdate) -> Optional[Dict[str, Any]]:
        """Update user preferences"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Convert Pydantic model to dict and filter out None values
            update_dict = {k: v for k, v in update.dict().items() if v is not None}
            
            # Add updated_at timestamp
            update_dict["updated_at"] = datetime.utcnow()
            
            # Update preferences
            result = await collection.find_one_and_update(
                {"user_id": user_id},
                {"$set": update_dict},
                return_document=True,
                upsert=True  # Create if doesn't exist
            )
            
            if result:
                result["_id"] = str(result["_id"])
                return result
                
            return None
            
        except PyMongoError as e:
            logger.error(f"Database error updating preferences for user {user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error updating preferences for user {user_id}: {e}")
            raise

    @classmethod
    async def update_consent(cls, user_id: str, update: ConsentUpdate) -> Optional[Dict[str, Any]]:
        """Update user consent status"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Prepare update with consent status and timestamp
            update_dict = {
                "consent_status": update.consent_status,
                "consent_updated_at": update.timestamp or datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            # Update consent status
            result = await collection.find_one_and_update(
                {"user_id": user_id},
                {"$set": update_dict},
                return_document=True,
                upsert=True  # Create if doesn't exist
            )
            
            if result:
                result["_id"] = str(result["_id"])
                return result
                
            return None
            
        except PyMongoError as e:
            logger.error(f"Database error updating consent for user {user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error updating consent for user {user_id}: {e}")
            raise

    @classmethod
    async def delete_preferences(cls, user_id: str) -> bool:
        """Delete user preferences"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Delete preferences document
            result = await collection.delete_one({"user_id": user_id})
            
            # Return whether deletion was successful
            return result.deleted_count > 0
            
        except PyMongoError as e:
            logger.error(f"Database error deleting preferences for user {user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error deleting preferences for user {user_id}: {e}")
            raise

    @classmethod
    async def initialize_collection(cls):
        """Create indexes for the collection"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Create index on user_id for faster lookups and to ensure uniqueness
            await collection.create_index("user_id", unique=True)
            
            # Create index on last_active for querying active users
            await collection.create_index("last_active")
            
            logger.info(f"Initialized {cls.collection_name} collection with indexes")
            
        except PyMongoError as e:
            logger.error(f"Database error initializing preferences collection: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error initializing preferences collection: {e}")
            raise