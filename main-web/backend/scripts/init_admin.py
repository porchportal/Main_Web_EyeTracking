import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(dotenv_path='.env.backend')

async def init_admin():
    try:
        # MongoDB connection
        MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        logger.info(f"Connecting to MongoDB at: {MONGODB_URL}")
        
        client = AsyncIOMotorClient(MONGODB_URL)
        db = client.eyetracking

        # Admin credentials from environment variables
        admin_username = os.getenv("ADMIN_USERNAME", "admin")
        admin_password = os.getenv("ADMIN_PASSWORD", "1234")
        
        logger.info(f"Initializing admin with username: {admin_username}")

        # Check if collection exists
        collections = await db.list_collection_names()
        logger.info(f"Available collections: {collections}")
        
        if "admins" not in collections:
            logger.info("Creating 'admins' collection")
            await db.create_collection("admins")

        # Check if admin already exists
        existing_admin = await db.admins.find_one({"username": admin_username})
        
        if not existing_admin:
            # Create new admin
            await db.admins.insert_one({
                "username": admin_username,
                "password": admin_password
            })
            logger.info(f"Admin user '{admin_username}' created successfully")
        else:
            # Update existing admin password
            await db.admins.update_one(
                {"username": admin_username},
                {"$set": {"password": admin_password}}
            )
            logger.info(f"Admin user '{admin_username}' password updated")

        # Verify the admin was created/updated
        admin = await db.admins.find_one({"username": admin_username})
        logger.info(f"Admin verification: {admin}")

    except Exception as e:
        logger.error(f"Error initializing admin: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(init_admin()) 