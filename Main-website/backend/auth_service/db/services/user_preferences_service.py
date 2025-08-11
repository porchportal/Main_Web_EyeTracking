# backend/services/user_preferences_service.py
from typing import Optional, Dict, Any, List
import logging
from datetime import datetime
from bson import ObjectId
from pymongo.errors import DuplicateKeyError, PyMongoError

from model_preference.preferences import UserPreferences, UserPreferencesUpdate, ConsentUpdate
from db.mongodb import db

# Import UserProfile from data_centralization for compatibility
try:
    from db.data_centralization import UserProfile
except ImportError:
    # Fallback if import fails
    from pydantic import BaseModel, Field
    from pydantic.config import ConfigDict
    
    class UserProfile(BaseModel):
        model_config = ConfigDict(extra="ignore")
        username: str = Field(default="", max_length=100)
        sex: str = Field(default="")
        age: str = Field(default="")
        night_mode: bool = False

logger = logging.getLogger(__name__)

class UserPreferencesService:
    """Service for managing user preferences in MongoDB"""
    collection_name = "user_preferences"

    @classmethod
    async def get_user_preferences(cls, user_id: str) -> Optional[Dict[str, Any]]:
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
    async def get_preferences(cls, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user preferences by user ID (alias for get_user_preferences)"""
        return await cls.get_user_preferences(user_id)

    @classmethod
    async def create_user_preferences(cls, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new user preferences"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Ensure required fields are present
            if "user_id" not in user_data:
                raise ValueError("user_id is required")
            
            # Ensure timestamps are set
            now = datetime.utcnow()
            user_data["created_at"] = user_data.get("created_at", now)
            user_data["updated_at"] = user_data.get("updated_at", now)
            
            # Create preferences document
            result = await collection.insert_one(user_data)
            
            if result.inserted_id:
                # Get the created document with the ID
                created_preferences = await collection.find_one({"_id": result.inserted_id})
                
                if created_preferences:
                    created_preferences["_id"] = str(created_preferences["_id"])
                    return created_preferences
                    
            raise Exception("Failed to retrieve created preferences")
            
        except DuplicateKeyError:
            logger.warning(f"User preferences already exist for user {user_data.get('user_id')}")
            # Get existing preferences instead
            existing = await cls.get_user_preferences(user_data.get('user_id'))
            if existing:
                return existing
            raise
        except PyMongoError as e:
            logger.error(f"Database error creating preferences for user {user_data.get('user_id')}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error creating preferences for user {user_data.get('user_id')}: {e}")
            raise

    @classmethod
    async def create_preferences(cls, preferences: UserPreferences) -> Dict[str, Any]:
        """Create new user preferences from Pydantic model"""
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
    async def update_user_preferences(cls, user_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update user preferences"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Filter out None values
            update_data = {k: v for k, v in update_data.items() if v is not None}
            
            # Add updated_at timestamp
            update_data["updated_at"] = datetime.utcnow()
            
            # Update preferences
            result = await collection.find_one_and_update(
                {"user_id": user_id},
                {"$set": update_data},
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
    async def update_preferences(cls, user_id: str, update: UserPreferencesUpdate) -> Optional[Dict[str, Any]]:
        """Update user preferences from Pydantic model"""
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
    async def update_consent_status(cls, user_id: str, consent_status: bool, timestamp: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
        """Update user consent status specifically"""
        try:
            update_data = {
                "consent_status": consent_status,
                "consent_updated_at": timestamp or datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            return await cls.update_user_preferences(user_id, update_data)
            
        except Exception as e:
            logger.error(f"Error updating consent status for user {user_id}: {e}")
            raise

    @classmethod
    async def update_consent(cls, user_id: str, update: ConsentUpdate) -> Optional[Dict[str, Any]]:
        """Update user consent status from Pydantic model"""
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
    async def update_user_profile(cls, user_id: str, profile_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update user profile information"""
        try:
            # Get existing preferences
            existing_preferences = await cls.get_user_preferences(user_id)
            
            if not existing_preferences:
                # Create new user if doesn't exist
                existing_preferences = await cls.create_user_preferences({
                    "user_id": user_id,
                    "consent_status": True,
                    "consent_updated_at": datetime.utcnow(),
                    "preferences": {}
                })
            
            # Update the preferences with new profile data
            current_preferences = existing_preferences.get("preferences", {})
            updated_preferences = {**current_preferences, **profile_data}
            
            # Update the preferences
            update_data = {"preferences": updated_preferences}
            return await cls.update_user_preferences(user_id, update_data)
            
        except Exception as e:
            logger.error(f"Error updating user profile for {user_id}: {e}")
            raise

    @classmethod
    async def delete_user_preferences(cls, user_id: str) -> bool:
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
    async def delete_preferences(cls, user_id: str) -> bool:
        """Delete user preferences (alias for delete_user_preferences)"""
        return await cls.delete_user_preferences(user_id)

    @classmethod
    async def get_all_users(cls) -> List[Dict[str, Any]]:
        """Get all user preferences"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Find all documents
            cursor = collection.find({})
            users = []
            
            async for doc in cursor:
                doc["_id"] = str(doc["_id"])
                users.append(doc)
            
            logger.info(f"Retrieved {len(users)} users from user_preferences collection")
            return users
            
        except PyMongoError as e:
            logger.error(f"Database error retrieving all users: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving all users: {e}")
            raise

    @classmethod
    async def get_users_by_consent_status(cls, consent_status: bool) -> List[Dict[str, Any]]:
        """Get users by consent status"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Find documents by consent status
            cursor = collection.find({"consent_status": consent_status})
            users = []
            
            async for doc in cursor:
                doc["_id"] = str(doc["_id"])
                users.append(doc)
            
            logger.info(f"Retrieved {len(users)} users with consent_status={consent_status}")
            return users
            
        except PyMongoError as e:
            logger.error(f"Database error retrieving users by consent status: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving users by consent status: {e}")
            raise

    @classmethod
    async def get_active_users(cls, days_active: int = 30) -> List[Dict[str, Any]]:
        """Get users active within the specified number of days"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Calculate the date threshold
            from datetime import timedelta
            threshold_date = datetime.utcnow() - timedelta(days=days_active)
            
            # Find documents with last_active after threshold
            cursor = collection.find({
                "last_active": {"$gte": threshold_date}
            })
            users = []
            
            async for doc in cursor:
                doc["_id"] = str(doc["_id"])
                users.append(doc)
            
            logger.info(f"Retrieved {len(users)} active users in the last {days_active} days")
            return users
            
        except PyMongoError as e:
            logger.error(f"Database error retrieving active users: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving active users: {e}")
            raise

    @classmethod
    async def update_last_active(cls, user_id: str) -> bool:
        """Update user's last active timestamp"""
        try:
            update_data = {
                "last_active": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            result = await cls.update_user_preferences(user_id, update_data)
            return result is not None
            
        except Exception as e:
            logger.error(f"Error updating last active for user {user_id}: {e}")
            raise

    @classmethod
    async def initialize_collection(cls):
        """Create indexes for the user_preferences collection"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Create index on user_id for faster lookups and to ensure uniqueness
            # Handle potential index conflicts by using sparse=True to match existing index
            try:
                await collection.create_index("user_id", unique=True, sparse=True)
            except Exception as e:
                if "IndexKeySpecsConflict" in str(e):
                    logger.info("Index already exists with different specs, skipping user_id index creation")
                else:
                    raise
            
            # Create index on consent_status for filtering
            try:
                await collection.create_index("consent_status")
            except Exception as e:
                if "IndexKeySpecsConflict" in str(e):
                    logger.info("Index already exists, skipping consent_status index creation")
                else:
                    raise
            
            # Create index on last_active for querying active users
            try:
                await collection.create_index("last_active")
            except Exception as e:
                if "IndexKeySpecsConflict" in str(e):
                    logger.info("Index already exists, skipping last_active index creation")
                else:
                    raise
            
            # Create index on created_at for querying by registration date
            try:
                await collection.create_index("created_at")
            except Exception as e:
                if "IndexKeySpecsConflict" in str(e):
                    logger.info("Index already exists, skipping created_at index creation")
                else:
                    raise
            
            logger.info(f"Initialized {cls.collection_name} collection with indexes")
            
        except PyMongoError as e:
            logger.error(f"Database error initializing user_preferences collection: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error initializing user_preferences collection: {e}")
            raise

    @classmethod
    async def get_user_count(cls) -> int:
        """Get total number of users"""
        try:
            collection = db.get_db()[cls.collection_name]
            count = await collection.count_documents({})
            return count
            
        except PyMongoError as e:
            logger.error(f"Database error getting user count: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error getting user count: {e}")
            raise

    @classmethod
    async def get_consent_statistics(cls) -> Dict[str, int]:
        """Get consent statistics"""
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Count users by consent status
            consented_count = await collection.count_documents({"consent_status": True})
            not_consented_count = await collection.count_documents({"consent_status": False})
            no_consent_count = await collection.count_documents({"consent_status": {"$exists": False}})
            
            return {
                "consented": consented_count,
                "not_consented": not_consented_count,
                "no_consent_record": no_consent_count,
                "total": consented_count + not_consented_count + no_consent_count
            }
            
        except PyMongoError as e:
            logger.error(f"Database error getting consent statistics: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error getting consent statistics: {e}")
            raise

    # ========================================
    # DATA CENTRALIZATION INTEGRATION METHODS
    # ========================================

    @classmethod
    async def save_user_data_to_preferences(cls, user_id: str, profile: UserProfile, consent_accepted: bool = True) -> bool:
        """
        Save user data to user_preferences collection in the specified format.
        This stores data in the user_preferences collection with the key-value structure.
        """
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Prepare the value object in the specified format
            value_data = {
                "user_id": user_id,
                "consent_accepted": consent_accepted,
                "consent_timestamp": datetime.utcnow().isoformat(),
                "profile": profile.model_dump(),
                "updated_at": datetime.utcnow()
            }
            
            # Save to user_preferences collection with key-value structure
            key = f"user_data_{user_id}"
            document = {
                "key": key,
                "value": value_data,
                "data_type": "user_consent",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            # Update with upsert (create if doesn't exist)
            result = await collection.update_one(
                {"key": key},
                {"$set": document},
                upsert=True
            )
            
            logger.info(f"Saved user data to user_preferences for user {user_id}")
            return result.acknowledged
            
        except Exception as e:
            logger.error(f"Error saving user data to preferences for {user_id}: {e}")
            raise

    @classmethod
    async def get_user_data_from_preferences(cls, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user data from user_preferences collection.
        """
        try:
            collection = db.get_db()[cls.collection_name]
            
            key = f"user_data_{user_id}"
            document = await collection.find_one({"key": key})
            
            if document and document.get("value"):
                logger.info(f"Retrieved user data from user_preferences for user {user_id}")
                return document.get("value")
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user data from preferences for {user_id}: {e}")
            raise

    @classmethod
    async def update_user_profile_in_preferences(cls, user_id: str, profile: UserProfile) -> bool:
        """
        Update user profile in user_preferences collection.
        """
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Get existing data
            existing_data = await cls.get_user_data_from_preferences(user_id)
            
            if existing_data:
                # Update existing data
                existing_data["profile"] = profile.model_dump()
                existing_data["updated_at"] = datetime.utcnow()
            else:
                # Create new data
                existing_data = {
                    "user_id": user_id,
                    "consent_accepted": True,
                    "consent_timestamp": datetime.utcnow().isoformat(),
                    "profile": profile.model_dump(),
                    "updated_at": datetime.utcnow()
                }
            
            # Save to user_preferences collection
            key = f"user_data_{user_id}"
            document = {
                "key": key,
                "value": existing_data,
                "data_type": "user_consent",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            result = await collection.update_one(
                {"key": key},
                {"$set": document},
                upsert=True
            )
            
            logger.info(f"Updated user profile in user_preferences for user {user_id}")
            return result.acknowledged
            
        except Exception as e:
            logger.error(f"Error updating user profile in preferences for {user_id}: {e}")
            raise

    @classmethod
    async def create_user_with_profile(cls, user_id: str, profile: UserProfile, consent_accepted: bool = True) -> Dict[str, Any]:
        """
        Create user in user_preferences collection with the specified format.
        """
        try:
            # Save to user_preferences collection with the specified format
            await cls.save_user_data_to_preferences(user_id, profile, consent_accepted)
            
            logger.info(f"Created user in user_preferences collection for user {user_id}")
            return {"user_id": user_id, "created": True}
            
        except Exception as e:
            logger.error(f"Error creating user with profile for {user_id}: {e}")
            raise

    @classmethod
    async def update_user_profile_in_preferences_format(cls, user_id: str, profile: UserProfile) -> bool:
        """
        Update user profile in user_preferences collection with the specified format.
        """
        try:
            # Update in user_preferences collection with the specified format
            await cls.update_user_profile_in_preferences(user_id, profile)
            
            logger.info(f"Updated user profile in user_preferences collection for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating user profile in preferences for {user_id}: {e}")
            raise

    @classmethod
    async def delete_user_from_preferences(cls, user_id: str) -> bool:
        """
        Delete user from user_preferences collection.
        """
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Delete from user_preferences collection
            key = f"user_data_{user_id}"
            result = await collection.delete_one({"key": key})
            
            logger.info(f"Deleted user from user_preferences collection for user {user_id}")
            return result.deleted_count > 0
            
        except Exception as e:
            logger.error(f"Error deleting user from preferences for {user_id}: {e}")
            raise

    @classmethod
    async def get_all_user_profiles(cls) -> List[Dict[str, Any]]:
        """
        Get all user profiles from user_preferences collection in the specified format.
        """
        try:
            collection = db.get_db()[cls.collection_name]
            
            # Find all documents with user_consent data_type
            cursor = collection.find({"data_type": "user_consent"})
            profiles = []
            
            async for doc in cursor:
                if doc.get("value") and doc.get("value", {}).get("profile"):
                    profiles.append(doc)
            
            logger.info(f"Retrieved {len(profiles)} user profiles from user_preferences collection")
            return profiles
            
        except Exception as e:
            logger.error(f"Error getting all user profiles: {e}")
            raise
