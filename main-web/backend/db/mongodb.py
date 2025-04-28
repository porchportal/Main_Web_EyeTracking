# backend/db/mongodb.py
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MongoDB:
    _client: Optional[AsyncIOMotorClient] = None
    _db = None
    _connection_string: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    _db_name: str = os.getenv("MONGODB_DB_NAME", "eye_tracking_db")
    
    @classmethod
    async def connect(cls) -> bool:
        """Initialize MongoDB connection."""
        try:
            if cls._client is None:
                logger.info(f"Connecting to MongoDB at {cls._connection_string}")
                cls._client = AsyncIOMotorClient(cls._connection_string)
                cls._db = cls._client[cls._db_name]
                
                # Verify connection
                await cls._client.admin.command('ping')
                logger.info("Successfully connected to MongoDB")
                
                # Ensure users collection exists
                collections = await cls._db.list_collection_names()
                if "users" not in collections:
                    logger.info("Creating users collection")
                    await cls._db.create_collection("users")
                
                return True
            return True
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            return False
    
    @classmethod
    async def ensure_connected(cls) -> bool:
        """Ensure MongoDB connection is active."""
        if cls._client is None:
            return await cls.connect()
        try:
            await cls._client.admin.command('ping')
            return True
        except Exception as e:
            logger.error(f"MongoDB connection check failed: {str(e)}")
            return await cls.connect()
    
    @classmethod
    def get_db(cls):
        """Get database instance."""
        if cls._db is None:
            raise RuntimeError("Database not initialized. Call connect() first.")
        return cls._db
    
    @classmethod
    async def close(cls):
        """Close MongoDB connection."""
        if cls._client is not None:
            logger.info("Closing MongoDB connection")
            cls._client.close()
            cls._client = None
            cls._db = None

# Initialize db instance for import elsewhere
db = MongoDB()