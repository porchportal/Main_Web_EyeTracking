#!/usr/bin/env python3
"""
Cleanup script to remove old profile data from data_centralization collection
and ensure user data is properly stored in user_preferences collection.
"""

import asyncio
import logging
from datetime import datetime
from db.mongodb import MongoDB

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def cleanup_old_profile_data():
    """Remove old profile data from data_centralization collection"""
    try:
        # Connect to MongoDB
        if not await MongoDB.ensure_connected():
            logger.error("Failed to connect to MongoDB")
            return False
        
        db = MongoDB.get_db()
        if db is None:
            logger.error("Database connection not available")
            return False
        
        # Find and delete profile entries
        profile_filter = {"key": {"$regex": "^profile_"}}
        result = await db.data_centralization.delete_many(profile_filter)
        
        logger.info(f"Deleted {result.deleted_count} profile entries from data_centralization collection")
        
        # Find and delete user_data entries (these should be moved to user_preferences)
        user_data_filter = {"key": {"$regex": "^user_data_"}}
        user_data_entries = await db.data_centralization.find(user_data_filter).to_list(None)
        
        logger.info(f"Found {len(user_data_entries)} user_data entries to migrate")
        
        # For each user_data entry, ensure it exists in user_preferences collection
        for entry in user_data_entries:
            user_id = entry["key"].replace("user_data_", "")
            user_data = entry["value"]
            
            # Check if user exists in user_preferences
            existing_user = await db.user_preferences.find_one({"user_id": user_id})
            
            if not existing_user:
                # Create user in user_preferences collection
                profile_data = user_data.get("profile", {})
                settings_data = user_data.get("settings", {})
                
                user_preferences = {
                    "user_id": user_id,
                    "consent_status": user_data.get("consent_accepted", True),
                    "consent_updated_at": datetime.utcnow(),
                    "preferences": {
                        "username": profile_data.get("username", ""),
                        "email": profile_data.get("email", "test@example.com"),
                        "sex": profile_data.get("sex", ""),
                        "age": profile_data.get("age", ""),
                        "night_mode": profile_data.get("night_mode", False),
                        "settings": settings_data
                    },
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                await db.user_preferences.insert_one(user_preferences)
                logger.info(f"Migrated user {user_id} to user_preferences collection")
            else:
                logger.info(f"User {user_id} already exists in user_preferences collection")
        
        # Delete user_data entries from data_centralization
        result = await db.data_centralization.delete_many(user_data_filter)
        logger.info(f"Deleted {result.deleted_count} user_data entries from data_centralization collection")
        
        return True
        
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        return False

async def main():
    """Main cleanup function"""
    logger.info("Starting cleanup of old profile data...")
    
    success = await cleanup_old_profile_data()
    
    if success:
        logger.info("Cleanup completed successfully")
    else:
        logger.error("Cleanup failed")
    
    # Close MongoDB connection
    await MongoDB.close_connection()

if __name__ == "__main__":
    asyncio.run(main())
