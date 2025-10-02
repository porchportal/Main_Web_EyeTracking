# backend/db/mongodb.py
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
import asyncio
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / '.env.backend'
load_dotenv(dotenv_path=env_path)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import backup manager
from .backup_manager import backup_manager

class MongoDB:
    _client = None
    _db = None
    _connection_attempts = 0
    _max_attempts = 3

    @classmethod
    async def connect(cls):
        try:
            if cls._connection_attempts >= cls._max_attempts:
                logger.error("Max connection attempts reached")
                return False

            cls._connection_attempts += 1
            logger.info("Connecting to MongoDB")
            
            # Get MongoDB credentials from environment
            mongo_username = os.getenv("MONGO_USERNAME")
            mongo_password = os.getenv("MONGO_PASSWORD")
            mongodb_host = os.getenv("MONGODB_HOST", "mongodb")
            mongodb_port = os.getenv("MONGODB_PORT", "27017")
            mongodb_db_name = os.getenv("MONGODB_DB_NAME", "eye_tracking")

            # Build authenticated connection string
            if mongo_username and mongo_password:
                mongodb_url = f"mongodb://{mongo_username}:{mongo_password}@{mongodb_host}:{mongodb_port}/{mongodb_db_name}?authSource={mongodb_db_name}"
                logger.info(f"Connecting to MongoDB with authentication at {mongodb_host}:{mongodb_port}")
            else:
                # Fallback for development without auth (not recommended for production)
                mongodb_url = f"mongodb://{mongodb_host}:{mongodb_port}/{mongodb_db_name}"
                logger.warning("Connecting to MongoDB WITHOUT authentication - not recommended for production!")

            logger.info(f"Using database: {mongodb_db_name}")

            cls._client = AsyncIOMotorClient(mongodb_url)
            cls._db = cls._client[mongodb_db_name]
            
            # Verify connection
            await cls._client.admin.command('ping')
            logger.info("Successfully connected to MongoDB")
            
            # Initialize backup manager
            await backup_manager.initialize(cls._client, mongodb_db_name)
            
            # Reset connection attempts on success
            cls._connection_attempts = 0
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            if cls._client:
                cls._client.close()
                cls._client = None
                cls._db = None
            return False

    @classmethod
    async def close(cls):
        if cls._client:
            try:
                cls._client.close()
                logger.info("Closed MongoDB connection")
            except Exception as e:
                logger.error(f"Error closing MongoDB connection: {str(e)}")
            finally:
                cls._client = None
                cls._db = None

    @classmethod
    async def ensure_connected(cls):
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
        if cls._db is None:
            return None
        return cls._db

# Initialize db instance for import elsewhere
db = MongoDB()