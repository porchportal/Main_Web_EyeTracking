from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from pydantic import BaseModel
import os
import base64
from auth import verify_api_key
import logging
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / '.env.backend'
load_dotenv(dotenv_path=env_path)

# Set up router with /api prefix
router = APIRouter(
    prefix="/api",
    tags=["preview"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)

class PreviewResponse(BaseModel):
    success: bool
    data: Optional[str] = None
    type: Optional[str] = None
    error: Optional[str] = None
    message: Optional[str] = None

@router.get("/list-files", dependencies=[Depends(verify_api_key)])
async def list_files(userId: str = "default", folder: str = "captures"):
    """List files in a specific folder"""
    try:
        # Get the base directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.abspath(os.path.join(current_dir, '../../resource_security/public'))
        
        # Define folder mapping
        folder_mapping = {
            'captures': 'captures',
            'enhance': 'enhance',
            'complete': 'complete'
        }
        
        # Get the actual folder name
        actual_folder = folder_mapping.get(folder, folder)
        
        # If userId is 'default', try to find the first available user folder
        actual_user_id = userId
        if userId == 'default':
            captures_base_path = os.path.join(base_dir, 'captures')
            if os.path.exists(captures_base_path):
                user_folders = [item for item in os.listdir(captures_base_path) 
                              if os.path.isdir(os.path.join(captures_base_path, item)) 
                              and item not in ['enhance', 'complete', 'eye_tracking_captures']]
                if user_folders:
                    actual_user_id = user_folders[0]  # Use the first available user folder
        
        # Handle different folder structures - all folders are user-specific
        if folder in ['enhance', 'complete']:
            # For enhance and complete, they are in /public/{folder}/{userId}/
            file_dir = os.path.join(base_dir, actual_folder, actual_user_id)
        else:
            # For captures, use /public/captures/{userId}
            file_dir = os.path.join(base_dir, 'captures', actual_user_id)
        
        
        if not os.path.exists(file_dir):
            os.makedirs(file_dir, exist_ok=True)
            return {
                "success": True,
                "files": [],
                "message": f"Created empty {actual_folder} folder for user {actual_user_id}",
                "folder_created": True
            }
        
        # Read files from directory
        files = []
        for file in os.listdir(file_dir):
            file_path = os.path.join(file_dir, file)
            if os.path.isfile(file_path):
                ext = os.path.splitext(file)[1].lower()
                if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.csv', '.txt', '.json', '.log']:
                    files.append(file)
        
        # Sort files by number in filename if present
        files.sort(key=lambda x: int(x.split('_')[-1].split('.')[0]) if '_' in x and x.split('_')[-1].split('.')[0].isdigit() else 0)
        
        
        return {
            "success": True,
            "files": files,
            "message": f"Found {len(files)} files in {actual_folder} folder"
        }
        
    except Exception as e:
        logging.error(f"Error listing files: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "files": [],
            "message": f"Failed to list files in {folder} folder"
        }

@router.get("/preview-api", dependencies=[Depends(verify_api_key)])
async def get_preview(filename: str, userId: str = "default", folder: str = "captures") -> PreviewResponse:
    """Get preview of a file from specified folder"""
    try:
        # Get the base directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.abspath(os.path.join(current_dir, '../../resource_security/public'))
        
        # Define folder mapping
        folder_mapping = {
            'captures': 'captures',
            'enhance': 'enhance',
            'complete': 'complete'
        }
        
        # Get the actual folder name
        actual_folder = folder_mapping.get(folder, folder)
        
        # If userId is 'default', try to find the first available user folder
        actual_user_id = userId
        if userId == 'default':
            captures_base_path = os.path.join(base_dir, 'captures')
            if os.path.exists(captures_base_path):
                user_folders = [item for item in os.listdir(captures_base_path) 
                              if os.path.isdir(os.path.join(captures_base_path, item)) 
                              and item not in ['enhance', 'complete', 'eye_tracking_captures']]
                if user_folders:
                    actual_user_id = user_folders[0]  # Use the first available user folder
        
        # Handle different folder structures - all folders are user-specific
        if folder in ['enhance', 'complete']:
            # For enhance and complete, they are in /public/{folder}/{userId}/
            file_dir = os.path.join(base_dir, actual_folder, actual_user_id)
        else:
            # For captures, use /public/captures/{userId}
            file_dir = os.path.join(base_dir, 'captures', actual_user_id)
        
        # Create folders if they don't exist
        if not os.path.exists(file_dir):
            try:
                os.makedirs(file_dir, exist_ok=True)
                logging.info(f"Created folder: {file_dir}")
            except Exception as create_error:
                logging.error(f"Error creating folder: {create_error}")
                raise HTTPException(status_code=500, detail=f"Failed to create folder: {create_error}")
            
        file_path = os.path.join(file_dir, filename)
        
        
        if not os.path.exists(file_path):
            logging.error(f"File not found at path: {file_path}")
            raise HTTPException(status_code=404, detail=f"File not found in {folder} folder")
            
        # Check if file is an image
        file_ext = os.path.splitext(filename)[1].lower()
        
        if file_ext in ['.jpg', '.jpeg', '.png', '.gif']:
            # Read and encode the image file
            with open(file_path, 'rb') as f:
                image_data = base64.b64encode(f.read()).decode('utf-8')
                
            return PreviewResponse(
                data=image_data,
                success=True,
                type="image",
                message=f"Image loaded from {folder} folder"
            )
        else:
            # For non-image files, read as text
            with open(file_path, 'r') as f:
                text_data = f.read()
                
            return PreviewResponse(
                data=text_data,
                success=True,
                type="text",
                message=f"Text file loaded from {folder} folder"
            )
    except Exception as e:
        logging.error(f"Error getting preview: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": str(e),
                "message": "Failed to get preview"
            }
        ) 