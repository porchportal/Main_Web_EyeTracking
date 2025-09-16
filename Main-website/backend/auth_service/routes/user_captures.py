# routes/user_captures.py - User-specific capture file saving
from fastapi import APIRouter, HTTPException, Depends, Body
from fastapi.responses import JSONResponse
import os
import base64
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
import logging

# Import auth
from auth import verify_api_key

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user-captures", tags=["user-captures"])

# Base path for captures - now in resource_security/public
BASE_CAPTURES_PATH = Path(__file__).parent.parent / "resource_security" / "public" / "captures"

# Globals to track capture groups per user
user_capture_groups = {}
CAPTURE_GROUP_TIMEOUT = 5  # 5 seconds

def get_highest_existing_number(user_captures_dir: Path) -> int:
    """Find the highest existing capture number for a user"""
    try:
        if not user_captures_dir.exists():
            return 0

        files = [f for f in user_captures_dir.iterdir() if f.is_file()]
        capture_files = [f for f in files if 
                        (f.name.startswith('screen_') or 
                         f.name.startswith('webcam_') or 
                         f.name.startswith('webcam_sub_') or
                         f.name.startswith('parameter_')) and
                        f.name.endswith(('.jpg', '.png', '.csv'))]

        if not capture_files:
            return 0

        numbers = []
        for file in capture_files:
            # Extract number from filename like screen_001.jpg
            parts = file.stem.split('_')
            if len(parts) >= 2:
                try:
                    numbers.append(int(parts[-1]))
                except ValueError:
                    continue

        return max(numbers) if numbers else 0
    except Exception as error:
        logger.error(f'Error finding highest capture number: {error}')
        return 0

def ensure_user_captures_directory(user_id: str) -> Path:
    """Ensure user's capture directory exists and return the path"""
    user_dir = BASE_CAPTURES_PATH / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir

@router.post("/save/{user_id}")
async def save_user_capture(
    user_id: str,
    capture_data: Dict[str, Any] = Body(...),
    api_key: str = Depends(verify_api_key)
):
    """Save capture files for a specific user"""
    try:
        # Validate required fields
        required_fields = ['imageData', 'filename', 'type']
        for field in required_fields:
            if field not in capture_data:
                logger.error(f"❌ Missing required field: {field}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing required field: {field}"
                )

        image_data = capture_data['imageData']
        filename = capture_data['filename']
        file_type = capture_data['type']
        capture_group = capture_data.get('captureGroup')

        # Ensure user directory exists
        user_captures_dir = ensure_user_captures_directory(user_id)

        # Handle capture grouping for this user
        user_key = f"{user_id}_{capture_group}" if capture_group else user_id
        current_group_data = user_capture_groups.get(user_key)
        
        if current_group_data and capture_group:
            # Use existing number for this group
            next_number = current_group_data['number']
        else:
            # Get next number from highest existing
            next_number = get_highest_existing_number(user_captures_dir) + 1
            
            # Store this number for the group if specified
            if capture_group:
                user_capture_groups[user_key] = {
                    'number': next_number,
                    'timestamp': datetime.now()
                }

        # Create filename with padded number
        padded_number = str(next_number).zfill(3)
        
        # Handle special case for sub camera files (webcam_sub_001.jpg)
        condition1 = filename.startswith('webcam_sub_')
        condition2 = file_type == 'webcam_sub'
        should_use_sub_logic = condition1 or condition2
        
        if should_use_sub_logic:
            # For sub camera files, keep the "webcam_sub" prefix
            prefix = 'webcam_sub'
            extension = filename.split('.')[-1]
            final_filename = f"{prefix}_{padded_number}.{extension}"
        else:
            # For other files, use the first part before underscore
            prefix = filename.split('_')[0]
            extension = filename.split('.')[-1]
            final_filename = f"{prefix}_{padded_number}.{extension}"

        # Process the data based on type
        if file_type == 'parameters' and filename.endswith('.csv'):
            if not image_data.startswith('data:'):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid CSV data format. Expected data URL."
                )
            # Extract base64 data
            base64_data = image_data.split(',')[1]
            file_content = base64.b64decode(base64_data)
        else:
            if not image_data.startswith('data:image/'):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid image data format. Expected base64 data URL."
                )
            # Extract base64 image data
            import re
            base64_data = re.sub(r'^data:image/\w+;base64,', '', image_data)
            file_content = base64.b64decode(base64_data)

        # Save the file
        file_path = user_captures_dir / final_filename
        
        try:
            with open(file_path, 'wb') as f:
                f.write(file_content)
            
            # Verify file was actually written
            if not file_path.exists():
                raise Exception("File was not created after write operation")
                
        except Exception as write_error:
            raise write_error

        return JSONResponse({
            "success": True,
            "message": f"Saved {file_type} as {final_filename}",
            "filename": final_filename,
            "number": next_number,
            "path": f"/captures/{user_id}/{final_filename}",
            "folder": user_id,
            "group": capture_group,
            "user_id": user_id
        })

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(error)}"
        )

@router.get("/status/{user_id}")
async def get_user_capture_status(
    user_id: str,
    api_key: str = Depends(verify_api_key)
):
    """Get capture status for a specific user"""
    try:
        user_captures_dir = BASE_CAPTURES_PATH / user_id
        
        if not user_captures_dir.exists():
            return JSONResponse({
                "user_id": user_id,
                "total_captures": 0,
                "last_capture": None,
                "directory_exists": False
            })

        # Count files
        files = [f for f in user_captures_dir.iterdir() if f.is_file()]
        capture_files = [f for f in files if 
                        (f.name.startswith('screen_') or 
                         f.name.startswith('webcam_') or 
                         f.name.startswith('webcam_sub_') or
                         f.name.startswith('parameter_')) and
                        f.name.endswith(('.jpg', '.png', '.csv'))]

        # Get last modified time
        last_modified = None
        if capture_files:
            last_modified = max(f.stat().st_mtime for f in capture_files)
            last_modified = datetime.fromtimestamp(last_modified).isoformat()

        # Count captures more accurately - each capture can have 3-5 files:
        # screen_xxx.jpg, webcam_xxx.jpg, webcam_sub_xxx.jpg (optional), parameter_xxx.csv
        screen_files = [f for f in capture_files if f.name.startswith('screen_')]
        webcam_files = [f for f in capture_files if f.name.startswith('webcam_') and not f.name.startswith('webcam_sub_')]
        webcam_sub_files = [f for f in capture_files if f.name.startswith('webcam_sub_')]
        parameter_files = [f for f in capture_files if f.name.startswith('parameter_')]
        
        # Total captures is the number of screen files (each capture has exactly one screen)
        total_captures = len(screen_files)
        
        return JSONResponse({
            "user_id": user_id,
            "total_captures": total_captures,
            "last_capture": last_modified,
            "directory_exists": True,
            "directory_path": str(user_captures_dir),
            "file_counts": {
                "screen_files": len(screen_files),
                "webcam_files": len(webcam_files),
                "webcam_sub_files": len(webcam_sub_files),
                "parameter_files": len(parameter_files),
                "total_files": len(capture_files)
            }
        })

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get capture status: {str(error)}"
        )

@router.delete("/clear/{user_id}")
async def clear_user_captures(
    user_id: str,
    api_key: str = Depends(verify_api_key)
):
    """Clear all capture files for a specific user"""
    try:
        user_captures_dir = BASE_CAPTURES_PATH / user_id
        
        if not user_captures_dir.exists():
            return JSONResponse({
                "success": True,
                "message": f"No capture directory found for user {user_id}"
            })

        # Remove all files in the directory
        files_removed = 0
        for file in user_captures_dir.iterdir():
            if file.is_file():
                file.unlink()
                files_removed += 1

        # Remove the directory itself
        user_captures_dir.rmdir()

        # Clear any stored group data for this user
        keys_to_remove = [key for key in user_capture_groups.keys() if key.startswith(user_id)]
        for key in keys_to_remove:
            user_capture_groups.pop(key, None)

        return JSONResponse({
            "success": True,
            "message": f"Cleared {files_removed} capture files for user {user_id}",
            "files_removed": files_removed
        })

    except Exception as error:
        logger.error(f"Error clearing captures for user {user_id}: {error}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear captures: {str(error)}"
        )
