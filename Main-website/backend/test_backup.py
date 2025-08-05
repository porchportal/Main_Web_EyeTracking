#!/usr/bin/env python3
"""
Test script for backup functionality
"""
import asyncio
import sys
import os
from pathlib import Path

# Add the auth_service directory to the path
sys.path.append(str(Path(__file__).parent / 'auth_service'))

from auth_service.db.backup_manager import backup_manager
from auth_service.db.mongodb import MongoDB

async def test_backup():
    """Test the backup functionality"""
    print("🔧 Testing Backup System...")
    
    try:
        # Connect to MongoDB
        print("📡 Connecting to MongoDB...")
        if not await MongoDB.connect():
            print("❌ Failed to connect to MongoDB")
            return False
        
        print("✅ Connected to MongoDB successfully")
        
        # Test backup manager initialization
        print("🔧 Initializing backup manager...")
        db_name = os.getenv("MONGODB_DB_NAME", "eye_tracking_db")
        await backup_manager.initialize(MongoDB._client, db_name)
        print("✅ Backup manager initialized")
        
        # Test manual backup
        print("💾 Performing manual backup...")
        await backup_manager.perform_backup()
        print("✅ Manual backup completed")
        
        # Test getting backup files
        print("📁 Getting backup files...")
        files = backup_manager.get_backup_files()
        print(f"✅ Found {len(files)} backup files")
        
        for file_info in files[:3]:  # Show first 3 files
            print(f"   📄 {file_info['name']} ({file_info['size']} bytes)")
        
        # Test backup status
        print("📊 Backup status:")
        print(f"   Auto-backup enabled: {backup_manager._auto_backup_enabled}")
        print(f"   Backup directory: {backup_manager._backup_dir}")
        print(f"   Running: {backup_manager._running}")
        
        print("✅ All backup tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Backup test failed: {e}")
        return False
    finally:
        # Clean up
        await MongoDB.close()
        backup_manager.stop()

if __name__ == "__main__":
    success = asyncio.run(test_backup())
    sys.exit(0 if success else 1) 