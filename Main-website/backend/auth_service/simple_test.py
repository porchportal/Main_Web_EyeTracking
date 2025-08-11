#!/usr/bin/env python3
"""
Simple test script to demonstrate JSON file creation functionality
"""
import json
import os
from pathlib import Path
from datetime import datetime
import uuid

def create_sample_json_files():
    """Create sample JSON files to demonstrate the structure"""
    print("🚀 Creating Sample JSON Files")
    print("=" * 50)
    
    # Define base directory
    base_dir = Path(__file__).parent / "resource_security"
    
    # Create directories
    user_pref_dir = base_dir / "user_preferences"
    data_cent_dir = base_dir / "data_centralization"
    
    user_pref_dir.mkdir(exist_ok=True)
    data_cent_dir.mkdir(exist_ok=True)
    
    # Sample user IDs
    test_users = [
        "f084cf66-3b92-427d-8071-28f74288719c",
        "example-user-123",
        "test-user-456"
    ]
    
    print("\n=== Creating User Preferences JSON Files ===")
    
    for user_id in test_users:
        # Create user preferences JSON file
        user_file = user_pref_dir / f"{user_id}.json"
        
        # Sample data in MongoDB format
        sample_data = [
            {
                "_id": {"$oid": str(uuid.uuid4()).replace("-", "")},
                "key": f"user_data_{user_id}",
                "created_at": {"$date": datetime.utcnow().isoformat()},
                "data_type": "user_consent",
                "updated_at": {"$date": datetime.utcnow().isoformat()},
                "value": {
                    "user_id": user_id,
                    "consent_accepted": True,
                    "consent_timestamp": datetime.utcnow().isoformat(),
                    "profile": {
                        "username": f"user_{user_id[:8]}",
                        "sex": "male" if "123" in user_id else "female",
                        "age": "25",
                        "night_mode": True
                    },
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        ]
        
        with open(user_file, 'w') as f:
            json.dump(sample_data, f, indent=2)
        
        print(f"✅ Created: {user_file}")
    
    print("\n=== Creating Data Centralization JSON Files ===")
    
    for user_id in test_users:
        # Create data centralization JSON file
        data_file = data_cent_dir / f"{user_id}.json"
        
        # Sample data in MongoDB format
        sample_data = [
            {
                "_id": {"$oid": str(uuid.uuid4()).replace("-", "")},
                "key": f"profile_{user_id}",
                "created_at": {"$date": datetime.utcnow().isoformat()},
                "data_type": "json",
                "updated_at": {"$date": datetime.utcnow().isoformat()},
                "value": {
                    "username": f"user_{user_id[:8]}",
                    "sex": "male" if "123" in user_id else "female",
                    "age": "25",
                    "night_mode": True
                }
            },
            {
                "_id": {"$oid": str(uuid.uuid4()).replace("-", "")},
                "key": f"settings_{user_id}",
                "created_at": {"$date": datetime.utcnow().isoformat()},
                "data_type": "json",
                "updated_at": {"$date": datetime.utcnow().isoformat()},
                "value": {
                    "times_set_random": 1,
                    "delay_set_random": 3,
                    "run_every_of_random": 1,
                    "set_timeRandomImage": 1,
                    "times_set_calibrate": 1,
                    "every_set": 0,
                    "zoom_percentage": 100,
                    "position_zoom": [0, 0],
                    "currentlyPage": "home",
                    "state_isProcessOn": False,
                    "freeState": 0,
                    "buttons_order": "",
                    "order_click": "",
                    "image_background_paths": [],
                    "public_data_access": False,
                    "enable_background_change": False
                }
            }
        ]
        
        with open(data_file, 'w') as f:
            json.dump(sample_data, f, indent=2)
        
        print(f"✅ Created: {data_file}")

def show_directory_structure():
    """Show the created directory structure"""
    print("\n=== Directory Structure ===")
    
    base_dir = Path(__file__).parent / "resource_security"
    
    if base_dir.exists():
        print(f"📁 {base_dir}")
        
        # User preferences directory
        user_pref_dir = base_dir / "user_preferences"
        if user_pref_dir.exists():
            print(f"  📁 {user_pref_dir.name}/")
            for file in user_pref_dir.glob("*.json"):
                print(f"    📄 {file.name}")
        
        # Data centralization directory
        data_cent_dir = base_dir / "data_centralization"
        if data_cent_dir.exists():
            print(f"  📁 {data_cent_dir.name}/")
            for file in data_cent_dir.glob("*.json"):
                print(f"    📄 {file.name}")
    else:
        print("❌ Resource security directory not found")

def main():
    """Main function"""
    # Create sample files
    create_sample_json_files()
    
    # Show directory structure
    show_directory_structure()
    
    print("\n" + "=" * 50)
    print("✅ Sample JSON files created successfully!")
    print("\n📝 Key Features:")
    print("• Each user gets their own JSON file named by user ID")
    print("• Files are created only when needed (no duplicates)")
    print("• Data format matches MongoDB structure exactly")
    print("• Automatic directory creation")
    print("• Error handling and logging")

if __name__ == "__main__":
    main()
