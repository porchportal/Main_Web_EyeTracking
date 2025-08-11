#!/usr/bin/env python3
"""
Test script to demonstrate the correct settings format in data_centralization
"""
import json
import os
from pathlib import Path
from datetime import datetime
import uuid

def create_sample_settings_file():
    """Create a sample settings file in the correct format"""
    print("🚀 Creating Sample Settings File in Data Centralization")
    print("=" * 60)
    
    # Define base directory
    base_dir = Path(__file__).parent / "resource_security"
    data_cent_dir = base_dir / "data_centralization"
    data_cent_dir.mkdir(exist_ok=True)
    
    # Sample user ID
    user_id = "user456"
    
    # Create settings file with the exact format you specified
    settings_file = data_cent_dir / f"{user_id}.json"
    
    # Sample settings data in the exact format you want
    sample_settings_data = [
        {
            "_id": {"$oid": "6899645ca38cd1d7c3534373"},
            "key": f"settings_{user_id}",
            "value": {
                "times_set_random": 3,
                "delay_set_random": 5,
                "run_every_of_random": 2,
                "set_timeRandomImage": 1,
                "times_set_calibrate": 5,
                "every_set": 1,
                "zoom_percentage": 150,
                "position_zoom": [50, 100],
                "currentlyPage": "home",
                "state_isProcessOn": True,
                "freeState": 1,
                "buttons_order": "random,calibrate,process",
                "order_click": "random",
                "image_background_paths": ["/backgrounds/default.jpg"],
                "public_data_access": False,
                "enable_background_change": False
            },
            "data_type": "json",
            "created_at": {"$date": "2025-08-11T03:32:44.859Z"},
            "updated_at": {"$date": "2025-08-11T03:32:44.859Z"}
        },
        {
            "_id": {"$oid": "6899645ca38cd1d7c3534374"},
            "key": f"profile_{user_id}",
            "value": {
                "username": "testuser",
                "sex": "male",
                "age": "25",
                "night_mode": True
            },
            "data_type": "json",
            "created_at": {"$date": "2025-08-11T03:32:44.859Z"},
            "updated_at": {"$date": "2025-08-11T03:32:44.859Z"}
        }
    ]
    
    with open(settings_file, 'w') as f:
        json.dump(sample_settings_data, f, indent=2)
    
    print(f"✅ Created settings file: {settings_file}")
    print("\n📄 File contents preview:")
    print("-" * 40)
    
    # Show the first document (settings)
    settings_doc = sample_settings_data[0]
    print(json.dumps(settings_doc, indent=2))
    
    print("\n" + "=" * 60)
    print("✅ Settings file created with the exact format you specified!")
    print("\n📝 Key Points:")
    print("• Settings are saved to data_centralization collection")
    print("• File is named by user ID: user456.json")
    print("• Data format matches MongoDB structure exactly")
    print("• Key format: 'settings_user456'")
    print("• All settings fields are included as specified")

def show_directory_structure():
    """Show the directory structure"""
    print("\n=== Directory Structure ===")
    
    base_dir = Path(__file__).parent / "resource_security"
    
    if base_dir.exists():
        print(f"📁 {base_dir}")
        
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
    # Create sample settings file
    create_sample_settings_file()
    
    # Show directory structure
    show_directory_structure()

if __name__ == "__main__":
    main()
