from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from config.settings import settings
import logging
from bson import ObjectId

logger = logging.getLogger(__name__)

class DataCenter:
    _client = None
    _db = None
    _collection = None
    _initialized = False

    @classmethod
    async def initialize(cls):
        """Initialize MongoDB connection"""
        try:
            if cls._initialized:
                return True

            logger.info(f"Initializing DataCenter with URL: {settings.MONGODB_URL}")
            cls._client = AsyncIOMotorClient(settings.MONGODB_URL)
            cls._db = cls._client[settings.MONGODB_DB_NAME]
            
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