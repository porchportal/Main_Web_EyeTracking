from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
import logging
import threading
import time
from bson import ObjectId
from dotenv import load_dotenv
from pathlib import Path
from typing import List, Dict, Any

# Load environment variables
env_path = Path(__file__).parent.parent / '.env.backend'
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

class DataCenter:
    _client = None
    _db = None
    _collection = None
    _initialized = False
    
    # Service layer attributes
    _instance = None
    _service_initialized = False
    _subscribers = set()
    _update_thread = None

    def __new__(cls):
        """Singleton pattern for service layer"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    async def initialize(cls):
        """Initialize MongoDB connection"""
        try:
            if cls._initialized:
                return True

            logger.info(f"Initializing DataCenter with URL: {os.getenv('MONGODB_URL')}")
            cls._client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
            cls._db = cls._client[os.getenv("MONGODB_DB_NAME")]
            
            # Create collection if it doesn't exist
            collections = await cls._db.list_collection_names()
            if 'data_center' not in collections:
                await cls._db.create_collection('data_center')
            
            cls._collection = cls._db['data_center']
            
            # Verify connection and collection
            await cls._db.command('ping')
            await cls._collection.create_index('key', unique=True)
            
            cls._initialized = True
            logger.info("DataCenter initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize DataCenter: {str(e)}")
            raise

    async def initialize_service(self):
        """Initialize the service layer"""
        if not self._service_initialized:
            await self.initialize()
            self._service_initialized = True
            logger.info("DataCenter service layer initialized successfully")

    def start_update_thread(self):
        """Start the background thread for periodic updates"""
        if not self._service_initialized:
            self._service_initialized = True
            self._update_thread = threading.Thread(target=self._update_loop)
            self._update_thread.daemon = True
            self._update_thread.start()

    def stop_update_thread(self):
        """Stop the background thread"""
        self._service_initialized = False
        if self._update_thread:
            self._update_thread.join()

    def _update_loop(self):
        """Background thread that updates subscribers every 5 seconds"""
        while self._service_initialized:
            try:
                data = self.get_all_values_sync()
                for subscriber in self._subscribers:
                    try:
                        subscriber(data)
                    except Exception as e:
                        logger.error(f"Error updating subscriber: {e}")
                time.sleep(5)
            except Exception as e:
                logger.error(f"Error in update loop: {e}")
                time.sleep(5)

    def subscribe(self, callback):
        """Subscribe to data updates"""
        self._subscribers.add(callback)
        if not self._service_initialized:
            self._service_initialized = True
            self.start_update_thread()

    def unsubscribe(self, callback):
        """Unsubscribe from data updates"""
        self._subscribers.discard(callback)
        if not self._subscribers and self._service_initialized:
            self.stop_update_thread()

    @classmethod
    async def update_value(cls, key, value, data_type):
        """Update a value in the data center"""
        try:
            if not cls._initialized:
                await cls.initialize()

            logger.info(f"Updating value for key: {key}, value: {value}, data_type: {data_type}")
            
            # Ensure the collection is initialized
            if cls._collection is None:
                raise Exception("DataCenter collection not initialized")

            result = await cls._collection.update_one(
                {'key': key},
                {
                    '$set': {
                        'value': value,
                        'data_type': data_type,
                        'updated_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            
            logger.info(f"Updated value for key {key}: {result.modified_count} documents modified, upserted_id: {result.upserted_id}")
            
            # Verify the update
            if result.modified_count == 0 and not result.upserted_id:
                logger.warning(f"No changes made for key {key}")
            
            return result
        except Exception as e:
            logger.error(f"Error updating value for key {key}: {str(e)}")
            raise

    @classmethod
    async def get_value(cls, key):
        """Get a value from the data center"""
        try:
            if not cls._initialized:
                await cls.initialize()

            # Ensure the collection is initialized
            if cls._collection is None:
                raise Exception("DataCenter collection not initialized")

            result = await cls._collection.find_one({'key': key})
            return result['value'] if result else None
        except Exception as e:
            logger.error(f"Error getting value for key {key}: {str(e)}")
            raise

    @classmethod
    def _serialize_value(cls, value):
        """Helper method to serialize MongoDB values for JSON"""
        if isinstance(value, ObjectId):
            return str(value)
        elif isinstance(value, datetime):
            return value.isoformat()
        elif isinstance(value, dict):
            return {k: cls._serialize_value(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [cls._serialize_value(v) for v in value]
        return value

    @classmethod
    async def get_all_values(cls):
        """Get all values from the data center"""
        try:
            if not cls._initialized:
                await cls.initialize()

            # Ensure the collection is initialized
            if cls._collection is None:
                raise Exception("DataCenter collection not initialized")

            cursor = cls._collection.find({})
            values = await cursor.to_list(length=None)
            
            # Serialize values for JSON
            serialized_values = []
            for value in values:
                serialized_value = {}
                for k, v in value.items():
                    serialized_value[k] = cls._serialize_value(v)
                serialized_values.append(serialized_value)
            
            return serialized_values
        except Exception as e:
            logger.error(f"Error getting all values: {str(e)}")
            raise

    def get_all_values_sync(self):
        """Synchronous version for background thread"""
        try:
            if not self._initialized:
                return []
            
            # This is a simplified version for the background thread
            # In a real implementation, you might want to use a sync MongoDB driver
            return []
        except Exception as e:
            logger.error(f"Error getting all values sync: {str(e)}")
            return []

    @classmethod
    async def delete_value(cls, key):
        """Delete a value from the data center"""
        try:
            if not cls._initialized:
                await cls.initialize()

            # Ensure the collection is initialized
            if cls._collection is None:
                raise Exception("DataCenter collection not initialized")

            result = await cls._collection.delete_one({'key': key})
            logger.info(f"Deleted value for key {key}: {result.deleted_count} documents deleted")
            return result
        except Exception as e:
            logger.error(f"Error deleting value for key {key}: {str(e)}")
            raise

    @classmethod
    async def update_user_settings_with_images(cls, user_id, settings_data, image_canva_data=None):
        """Update user settings with optional image&pdf_canva data"""
        try:
            if not cls._initialized:
                await cls.initialize()

            logger.info(f"Updating user settings for user_id: {user_id}")
            
            # Ensure the collection is initialized
            if cls._collection is None:
                raise Exception("DataCenter collection not initialized")

            # Update settings
            settings_result = await cls.update_value(
                f"settings_{user_id}",
                settings_data,
                "json"
            )

            # Update image&pdf_canva data if provided
            if image_canva_data:
                image_result = await cls.update_value(
                    f"image_canva_{user_id}",
                    image_canva_data,
                    "json"
                )
                logger.info(f"Updated image_canva for user {user_id}: {image_result}")
            
            return {
                "settings_result": settings_result,
                "image_canva_result": image_result if image_canva_data else None
            }
        except Exception as e:
            logger.error(f"Error updating user settings with images for user {user_id}: {str(e)}")
            raise

    @classmethod
    async def get_user_complete_data(cls, user_id):
        """Get complete user data including settings and image&pdf_canva"""
        try:
            if not cls._initialized:
                await cls.initialize()

            # Get settings
            settings = await cls.get_value(f"settings_{user_id}")
            
            # Get image&pdf_canva data
            image_canva = await cls.get_value(f"image_canva_{user_id}")
            
            return {
                "settings": settings,
                "image&pdf_canva": image_canva
            }
        except Exception as e:
            logger.error(f"Error getting complete user data for user {user_id}: {str(e)}")
            raise

    # Service layer methods
    async def get_value_service(self, key: str) -> Any:
        """Get a value from the data center (service layer)"""
        try:
            if not self._service_initialized:
                await self.initialize_service()
            return await self.get_value(key)
        except Exception as e:
            logger.error(f"Error getting value for key {key}: {str(e)}")
            raise

    async def update_value_service(self, key: str, value: Any, data_type: str = "json"):
        """Update a value in the data center (service layer)"""
        try:
            if not self._service_initialized:
                await self.initialize_service()
            return await self.update_value(key, value, data_type)
        except Exception as e:
            logger.error(f"Error updating value for key {key}: {str(e)}")
            raise

    async def get_all_values_service(self) -> List[Dict[str, Any]]:
        """Get all values from the data center (service layer)"""
        try:
            if not self._service_initialized:
                await self.initialize_service()
            return await self.get_all_values()
        except Exception as e:
            logger.error(f"Error getting all values: {str(e)}")
            raise

    async def delete_value_service(self, key: str):
        """Delete a value from the data center (service layer)"""
        try:
            if not self._service_initialized:
                await self.initialize_service()
            return await self.delete_value(key)
        except Exception as e:
            logger.error(f"Error deleting value for key {key}: {str(e)}")
            raise

# Create a singleton instance for service layer usage
data_center_service = DataCenter() 