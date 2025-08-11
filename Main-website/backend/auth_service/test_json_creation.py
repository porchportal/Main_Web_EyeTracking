#!/usr/bin/env python3
"""
Test script to demonstrate JSON file creation functionality
"""
import asyncio
import sys
import os
from pathlib import Path

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db.services.user_preferences_service import UserPreferencesService
from db.services.data_centralization_service import DataCentralizationService
from db.data_centralization import UserProfile

async def test_user_preferences_json_creation():
    """Test user preferences JSON file creation"""
    print("=== Testing User Preferences JSON Creation ===")
    
    # Test user IDs
    test_users = [
        "f084cf66-3b92-427d-8071-28f74288719c",
        "example-user-123",
        "test-user-456"
    ]
    
    for user_id in test_users:
        print(f"\n--- Testing user: {user_id} ---")
        
        # Create sample profile data
        profile_data = {
            "user_id": user_id,
            "consent_accepted": True,
            "consent_timestamp": "2025-08-11T05:37:45.532Z",
            "profile": {
                "username": f"user_{user_id[:8]}",
                "sex": "male" if "123" in user_id else "female",
                "age": "25",
                "night_mode": True
            },
            "updated_at": "2025-08-11T05:37:45.532Z"
        }
        
        # Test saving to JSON
        try:
            UserPreferencesService._save_to_json(user_id, profile_data)
            print(f"✅ Successfully created/updated JSON for user {user_id}")
            
            # Check if file exists
            json_file = UserPreferencesService._get_user_json_file_path(user_id)
            if json_file.exists():
                print(f"✅ JSON file exists: {json_file}")
            else:
                print(f"❌ JSON file not found: {json_file}")
                
        except Exception as e:
            print(f"❌ Error creating JSON for user {user_id}: {e}")

async def test_data_centralization_json_creation():
    """Test data centralization JSON file creation"""
    print("\n=== Testing Data Centralization JSON Creation ===")
    
    # Test user IDs
    test_users = [
        "f084cf66-3b92-427d-8071-28f74288719c",
        "example-user-123",
        "test-user-456"
    ]
    
    for user_id in test_users:
        print(f"\n--- Testing user: {user_id} ---")
        
        # Test profile data
        profile_key = f"profile_{user_id}"
        profile_value = {
            "username": f"user_{user_id[:8]}",
            "sex": "male" if "123" in user_id else "female",
            "age": "25",
            "night_mode": True
        }
        
        try:
            DataCentralizationService._save_to_json(profile_key, profile_value, "json")
            print(f"✅ Successfully saved profile data for user {user_id}")
        except Exception as e:
            print(f"❌ Error saving profile data for user {user_id}: {e}")
        
        # Test settings data
        settings_key = f"settings_{user_id}"
        settings_value = {
            "times_set_random": 1,
            "delay_set_random": 3,
            "zoom_percentage": 100,
            "position_zoom": [0, 0],
            "currentlyPage": "home",
            "state_isProcessOn": False
        }
        
        try:
            DataCentralizationService._save_to_json(settings_key, settings_value, "json")
            print(f"✅ Successfully saved settings data for user {user_id}")
        except Exception as e:
            print(f"❌ Error saving settings data for user {user_id}: {e}")

def show_directory_structure():
    """Show the created directory structure"""
    print("\n=== Directory Structure ===")
    
    resource_dir = Path(__file__).parent / "resource_security"
    
    if resource_dir.exists():
        print(f"📁 {resource_dir}")
        
        # User preferences directory
        user_pref_dir = resource_dir / "user_preferences"
        if user_pref_dir.exists():
            print(f"  📁 {user_pref_dir.name}/")
            for file in user_pref_dir.glob("*.json"):
                print(f"    📄 {file.name}")
        
        # Data centralization directory
        data_cent_dir = resource_dir / "data_centralization"
        if data_cent_dir.exists():
            print(f"  📁 {data_cent_dir.name}/")
            for file in data_cent_dir.glob("*.json"):
                print(f"    📄 {file.name}")
    else:
        print("❌ Resource security directory not found")

async def main():
    """Main test function"""
    print("🚀 Starting JSON File Creation Test")
    print("=" * 50)
    
    # Test user preferences
    await test_user_preferences_json_creation()
    
    # Test data centralization
    await test_data_centralization_json_creation()
    
    # Show directory structure
    show_directory_structure()
    
    print("\n" + "=" * 50)
    print("✅ Test completed!")

if __name__ == "__main__":
    asyncio.run(main())
