from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from typing import Dict, Any, List, Optional
import logging
import os
import json
import shutil
from datetime import datetime
from pathlib import Path
from auth import verify_api_key

# Set up router
router = APIRouter(
    prefix="/api/canvas-admin",
    tags=["canvas-admin"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)

logger = logging.getLogger(__name__)

# Constants
CANVAS_DIR = Path(__file__).parent.parent / "resource_security" / "canvas"
CONFIG_FILE = CANVAS_DIR / "config.json"
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

def ensure_canvas_directory():
    """Ensure canvas directory and config file exist"""
    logger.info(f"Ensuring canvas directory exists: {CANVAS_DIR}")
    CANVAS_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Canvas directory ready: {CANVAS_DIR}")
    
    if not CONFIG_FILE.exists():
        logger.info(f"Creating new config file: {CONFIG_FILE}")
        with open(CONFIG_FILE, 'w') as f:
            json.dump({}, f, indent=2)
        logger.info("Config file created successfully")
    else:
        logger.info(f"Config file already exists: {CONFIG_FILE}")

def load_config():
    """Load configuration from config.json"""
    ensure_canvas_directory()
    try:
        logger.info(f"Loading config from: {CONFIG_FILE}")
        if not CONFIG_FILE.exists():
            logger.info("Config file does not exist, returning empty config")
            return {}
        
        with open(CONFIG_FILE, 'r') as f:
            content = f.read()
            logger.info(f"Raw config file content: {content}")
            if not content.strip():
                logger.info("Config file is empty, returning empty config")
                return {}
            
            config = json.loads(content)
            logger.info(f"Config loaded successfully: {json.dumps(config, indent=2)}")
            return config
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error in config file: {e}")
        logger.info("Returning empty config due to JSON error")
        return {}
    except Exception as e:
        logger.error(f"Error loading config: {e}")
        logger.info("Returning default config")
        return {}

def save_config(config):
    """Save configuration to config.json"""
    ensure_canvas_directory()
    try:
        logger.info(f"Saving config to: {CONFIG_FILE}")
        logger.info(f"Config content: {json.dumps(config, indent=2)}")
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        logger.info("Config saved successfully")
        return True
    except Exception as e:
        logger.error(f"Error saving config: {e}")
        return False

def validate_file(file: UploadFile) -> bool:
    """Validate uploaded file"""
    if not file.filename:
        return False
    
    # Check file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        return False
    
    # Check file size (we'll check this after reading)
    return True

def save_file_to_canvas(file: UploadFile, user_id: str) -> str:
    """Save uploaded file to canvas directory"""
    try:
        # Keep original filename without timestamp
        original_name = file.filename
        
        # Save file directly in canvas directory (no user subdirectory)
        file_path = CANVAS_DIR / original_name
        logger.info(f"Saving file to: {file_path}")
        
        # If file already exists, add a number suffix
        counter = 1
        while file_path.exists():
            name_without_ext = Path(original_name).stem
            ext = Path(original_name).suffix
            file_path = CANVAS_DIR / f"{name_without_ext}_{counter}{ext}"
            counter += 1
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Verify file was saved
        if file_path.exists():
            file_size = file_path.stat().st_size
            logger.info(f"File saved successfully: {file_path} (size: {file_size} bytes)")
        else:
            logger.error(f"File was not saved: {file_path}")
            raise Exception("File was not saved to disk")
        
        # Return relative path for frontend
        return f"/canvas/{file_path.name}"
    except Exception as e:
        logger.error(f"Error saving file {file.filename}: {e}")
        raise e

@router.post("/upload-images")
async def upload_canvas_images(
    user_id: str = Form(...),
    files: List[UploadFile] = File(...),
    api_key: str = Depends(verify_api_key)
):
    """Upload multiple images for a user's canvas"""
    try:
        logger.info(f"Received upload request for user: {user_id}")
        logger.info(f"Number of files received: {len(files)}")
        
        if not user_id:
            logger.error("No user ID provided in request")
            raise HTTPException(status_code=400, detail="User ID is required")
        logger.info(f"Processing upload for user: {user_id}")
        
        if not files:
            logger.error("No files provided in request")
            raise HTTPException(status_code=400, detail="No files provided")
        logger.info(f"Received {len(files)} files for processing")
        
        # Load current config
        config = load_config()
        logger.info(f"Loaded config: {json.dumps(config, indent=2)}")
        
        # Initialize user entry if not exists
        try:
            logger.info(f"Step 1: Checking if user_id {user_id} in config")
            logger.info(f"Config type: {type(config)}")
            logger.info(f"Config keys: {list(config.keys()) if isinstance(config, dict) else 'Not a dict'}")
            
            if user_id not in config:
                logger.info(f"Step 2: Creating new user entry for: {user_id}")
                config[user_id] = []
                logger.info(f"Step 3: Created user entry successfully")
            else:
                logger.info(f"Step 2: User {user_id} already exists with {len(config[user_id])} images")
            
            logger.info(f"Step 4: Initializing variables")
            uploaded_images = []
            image_paths = {}
            
            logger.info(f"Step 5: Getting existing image count")
            # Get existing image count for this user to continue numbering
            existing_image_count = len(config[user_id])
            logger.info(f"Step 6: Existing image count for user {user_id}: {existing_image_count}")
        except Exception as e:
            logger.error(f"Error at step during user initialization: {e}")
            logger.error(f"Error type: {type(e)}")
            logger.error(f"Error args: {e.args}")
            logger.error(f"Config structure: {config}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=str(e))
        
        for i, file in enumerate(files):
            logger.info(f"Processing file {i+1}/{len(files)}: {file.filename}")
            logger.info(f"File type: {file.content_type}")
            logger.info(f"File size: {file.size if hasattr(file, 'size') else 'unknown'}")
            logger.info(f"File object: {type(file)}")
            logger.info(f"File attributes: {dir(file)}")
            
            # Validate file
            logger.info(f"Validating file: {file.filename}")
            if not validate_file(file):
                logger.warning(f"Skipping invalid file: {file.filename}")
                continue
            logger.info(f"File validation passed: {file.filename}")
            
            # Check file size
            file.file.seek(0, 2)  # Seek to end
            file_size = file.file.tell()
            file.file.seek(0)  # Reset to beginning
            logger.info(f"Actual file size: {file_size} bytes")
            
            if file_size > MAX_FILE_SIZE:
                logger.warning(f"File too large: {file.filename} ({file_size} bytes)")
                continue
            logger.info(f"File size check passed: {file.filename} ({file_size} bytes)")
            
            try:
                # Save file
                logger.info(f"Attempting to save file: {file.filename}")
                logger.info(f"File object before saving: {file}")
                logger.info(f"File file attribute: {file.file}")
                image_path = save_file_to_canvas(file, user_id)
                logger.info(f"File saved successfully, path: {image_path}")
                
                # Calculate the next image number (continue from existing count)
                next_image_number = existing_image_count + len(uploaded_images) + 1
                
                # Update config - simple format: user_id -> [image_paths]
                logger.info(f"Adding image path to config for user {user_id}")
                logger.info(f"User config before update: {config[user_id]}")
                
                # Add image path to user's list
                config[user_id].append(image_path)
                logger.info(f"Updated user config: {config[user_id]}")
                logger.info(f"User {user_id} now has {len(config[user_id])} images")
                
                uploaded_images.append({
                    "filename": file.filename,
                    "path": image_path,
                    "size": file_size
                })
                image_paths[f"image_{next_image_number}"] = image_path
                logger.info(f"Added to uploaded_images list: {len(uploaded_images)} total")
                logger.info(f"Added to image_paths: image_{next_image_number} = {image_path}")
                logger.info(f"Image paths so far: {image_paths}")
                
                logger.info(f"Successfully uploaded: {file.filename} for user {user_id}")
                logger.info(f"Image paths so far: {image_paths}")
                
            except Exception as e:
                logger.error(f"Error saving file {file.filename}: {e}")
                logger.error(f"Continuing with next file...")
                continue
        
        logger.info(f"File processing loop completed. {len(uploaded_images)} images processed successfully")
        
        # Check if any images were uploaded
        if len(uploaded_images) == 0:
            logger.warning("No images were uploaded successfully")
            raise HTTPException(status_code=400, detail="No images were uploaded successfully")
        
        # Save updated config
        logger.info(f"File processing complete. {len(uploaded_images)} images uploaded successfully")
        logger.info(f"Uploaded images: {[img['filename'] for img in uploaded_images]}")
        logger.info(f"Image paths: {image_paths}")
        logger.info(f"User {user_id} now has {len(config[user_id])} total images")
        logger.info(f"Saving config with {len(uploaded_images)} uploaded images")
        logger.info(f"Final config before saving: {json.dumps(config, indent=2)}")
        if not save_config(config):
            logger.error("Failed to save configuration to local file")
            raise HTTPException(status_code=500, detail="Failed to save configuration")
        else:
            logger.info("Configuration saved successfully to local file")
        
        # Create the response in the requested format
        response_data = {
            "user_id": user_id
        }
        
        # Add image paths in the format image_1, image_2, etc.
        for key, path in image_paths.items():
            response_data[key] = path
            logger.info(f"Added to response: {key} = {path}")
        
        logger.info(f"Response data: {response_data}")
        logger.info(f"Response data keys: {list(response_data.keys())}")
        logger.info(f"Response data values: {list(response_data.values())}")
        
        response = {
            "success": True,
            "message": f"Successfully uploaded {len(uploaded_images)} images",
            "data": response_data,
            "uploaded_images": uploaded_images,
            "image_paths": image_paths,
            "total_images": len(config[user_id])
        }
        logger.info(f"Sending response: {json.dumps(response, indent=2)}")
        logger.info(f"Response status: success, message: {len(uploaded_images)} images uploaded")
        logger.info(f"Response data field: {response['data']}")
        logger.info(f"Response uploaded_images field: {response['uploaded_images']}")
        logger.info(f"Response image_paths field: {response['image_paths']}")
        return JSONResponse(response)
        
    except Exception as e:
        logger.error(f"Error in upload_canvas_images: {e}")
        logger.error(f"Error traceback: {e.__traceback__}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user-images/{user_id}")
async def get_user_images(
    user_id: str,
    api_key: str = Depends(verify_api_key)
):
    """Get all images for a specific user"""
    try:
        config = load_config()
        
        if user_id not in config:
            return JSONResponse({
                "success": True,
                "user_id": user_id,
                "images": [],
                "image_count": 0
            })
        
        user_images = config[user_id]
        
        return JSONResponse({
            "success": True,
            "user_id": user_id,
            "images": user_images,
            "image_count": len(user_images)
        })
        
    except Exception as e:
        logger.error(f"Error getting user images: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/config")
async def get_canvas_config(api_key: str = Depends(verify_api_key)):
    """Get the complete canvas configuration"""
    try:
        config = load_config()
        return JSONResponse({
            "success": True,
            "config": config
        })
    except Exception as e:
        logger.error(f"Error getting canvas config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/user-images/{user_id}")
async def delete_user_images(
    user_id: str,
    api_key: str = Depends(verify_api_key)
):
    """Delete all images for a specific user"""
    try:
        config = load_config()
        
        if user_id not in config:
            return JSONResponse({
                "success": True,
                "message": "User not found or no images to delete"
            })
        
        # Get user images
        user_images = config[user_id]
        
        # Delete physical files
        for image_path in user_images:
            # Extract filename from path (remove /canvas/ prefix)
            filename = image_path.replace('/canvas/', '')
            file_path = CANVAS_DIR / filename
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Deleted file: {file_path}")
        
        # Remove user from config
        del config[user_id]
        
        # Save updated config
        if not save_config(config):
            raise HTTPException(status_code=500, detail="Failed to save configuration")
        
        return JSONResponse({
            "success": True,
            "message": f"Deleted {len(user_images)} images for user {user_id}",
            "deleted_count": len(user_images)
        })
        
    except Exception as e:
        logger.error(f"Error deleting user images: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/image/{user_id}/{image_key}")
async def delete_single_image(
    user_id: str,
    image_key: str,
    api_key: str = Depends(verify_api_key)
):
    """Delete a specific image for a user"""
    try:
        config = load_config()
        
        if user_id not in config:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Find the image by key (e.g., image_1, image_2)
        user_images = config[user_id]
        image_index = int(image_key.replace('image_', '')) - 1
        
        if image_index < 0 or image_index >= len(user_images):
            raise HTTPException(status_code=404, detail="Image not found")
        
        image_path = user_images[image_index]
        
        # Delete physical file
        filename = image_path.replace('/canvas/', '')
        file_path = CANVAS_DIR / filename
        if file_path.exists():
            file_path.unlink()
            logger.info(f"Deleted file: {file_path}")
        
        # Remove from user's images list
        config[user_id].pop(image_index)
        
        # Save updated config
        if not save_config(config):
            raise HTTPException(status_code=500, detail="Failed to save configuration")
        
        return JSONResponse({
            "success": True,
            "message": f"Deleted image {filename}",
            "deleted_image": image_path
        })
        
    except Exception as e:
        logger.error(f"Error deleting single image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/canvas/{filename}")
async def serve_canvas_image(
    filename: str,
    api_key: str = Depends(verify_api_key)
):
    """Serve canvas images"""
    try:
        image_path = CANVAS_DIR / filename
        
        if not image_path.exists():
            raise HTTPException(status_code=404, detail="Image not found")
        
        return FileResponse(image_path)
        
    except Exception as e:
        logger.error(f"Error serving canvas image: {e}")
        raise HTTPException(status_code=500, detail=str(e))
