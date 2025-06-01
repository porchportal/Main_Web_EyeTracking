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
            logger.info(f"Attempting to connect to MongoDB (attempt {cls._connection_attempts})")
            
            cls._client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
            cls._db = cls._client[os.getenv("MONGODB_DB_NAME")]
            
            # Verify connection
            await cls._client.admin.command('ping')
            logger.info("Successfully connected to MongoDB")
            
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
            raise Exception("Database not connected. Please call connect() first.")
        return cls._db

# Initialize db instance for import elsewhere
db = MongoDB()