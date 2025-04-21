# backend/db/mongodb.py
import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import logging
import asyncio

logger = logging.getLogger(__name__)

class MongoDB:
    client = None
    db = None
    is_connected = False
    connection_error = None
    reconnect_attempt = 0
    max_reconnect_attempts = 3

    @classmethod
    async def connect(cls, retry_on_startup=True):
        """Connect to MongoDB with retry logic."""
        if cls.client is not None and cls.is_connected:
            return True
        
        # Reset connection error
        cls.connection_error = None
        
        # Get MongoDB URI from environment variable or use default local URI
        mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        db_name = os.getenv("MONGODB_DB", "face_tracking_app")
        
        try:
            logger.info(f"Connecting to MongoDB at {mongo_uri}...")
            
            # Set a timeout for the connection attempt
            cls.client = AsyncIOMotorClient(mongo_uri, serverSelectionTimeoutMS=5000)
            
            # Verify connection is successful with a ping
            await cls.client.admin.command('ping')
            
            logger.info("Successfully connected to MongoDB")
            
            # Set database
            cls.db = cls.client[db_name]
            cls.is_connected = True
            cls.reconnect_attempt = 0
            
            return True
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            cls.connection_error = str(e)
            cls.is_connected = False
            
            logger.error(f"Failed to connect to MongoDB: {e}")
            
            # If this is a startup attempt and retries are enabled, try again
            if retry_on_startup and cls.reconnect_attempt < cls.max_reconnect_attempts:
                cls.reconnect_attempt += 1
                retry_delay = 2 ** cls.reconnect_attempt  # Exponential backoff
                
                logger.info(f"Retrying connection in {retry_delay} seconds (attempt {cls.reconnect_attempt}/{cls.max_reconnect_attempts})...")
                
                # Schedule reconnection attempt
                await asyncio.sleep(retry_delay)
                return await cls.connect(retry_on_startup)
            
            # Continue application startup even if MongoDB is unavailable
            logger.warning("Application will start without MongoDB connection")
            return False
            
        except Exception as e:
            cls.connection_error = str(e)
            cls.is_connected = False
            
            logger.error(f"Unexpected error connecting to MongoDB: {e}")
            
            # Continue application startup
            logger.warning("Application will start without MongoDB connection")
            return False

    @classmethod
    async def close(cls):
        """Close MongoDB connection."""
        if cls.client is not None:
            logger.info("Closing connection to MongoDB")
            cls.client.close()
            cls.client = None
            cls.db = None
            cls.is_connected = False

    @classmethod
    def get_db(cls):
        """Get database instance or raise appropriate error."""
        if cls.db is None:
            if cls.connection_error:
                raise ConnectionError(f"MongoDB connection failed: {cls.connection_error}")
            else:
                raise ConnectionError("MongoDB connection not established. Call connect() first.")
        return cls.db
    
    @classmethod
    async def ensure_connected(cls):
        """Ensure database is connected, attempt reconnection if needed."""
        if not cls.is_connected:
            return await cls.connect(retry_on_startup=False)
        return True
    
    @classmethod
    def connection_status(cls):
        """Get current connection status information."""
        return {
            "connected": cls.is_connected,
            "error": cls.connection_error
        }

# Initialize db instance for import elsewhere
db = MongoDB()