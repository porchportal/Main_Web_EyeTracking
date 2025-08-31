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
    CANVAS_DIR.mkdir(parents=True, exist_ok=True)
    
    if not CONFIG_FILE.exists():
        with open(CONFIG_FILE, 'w') as f:
            json.dump({}, f, indent=2)

def load_config():
    """Load configuration from config.json"""
    ensure_canvas_directory()
    try:
        if not CONFIG_FILE.exists():
            return {}
        
        with open(CONFIG_FILE, 'r') as f:
            content = f.read()
            if not content.strip():
                return {}
            
            config = json.loads(content)
            return config
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error in config file: {e}")
        return {}
    except Exception as e:
        logger.error(f"Error loading config: {e}")
        return {}

def save_config(config):
    """Save configuration to config.json"""
    ensure_canvas_directory()
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
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

def get_base_image_name(filename: str) -> str:
    """Extract base image name without numeric suffixes (e.g., _1, _2, _3)"""
    # Remove file extension
    name_without_ext = Path(filename).stem
    
    # Remove numeric suffixes like _1, _2, _3, etc.
    # This regex matches _ followed by one or more digits at the end
    import re
    base_name = re.sub(r'_\d+$', '', name_without_ext)
    
    return base_name

def check_duplicate_image(user_id: str, filename: str, config: dict) -> tuple[bool, str]:
    """Check if an image with the same base name already exists for the user"""
    if user_id not in config:
        return False, ""
    
    # Get the base name of the uploaded file
    uploaded_base_name = get_base_image_name(filename)
    
    # Check if any existing image has the same base name
    for image_path in config[user_id]:
        existing_filename = image_path.split('/')[-1]  # Get filename from path
        existing_base_name = get_base_image_name(existing_filename)
        
        if existing_base_name == uploaded_base_name:
            return True, image_path
    
    return False, ""

def save_file_to_canvas(file: UploadFile, user_id: str) -> str:
    """Save uploaded file to canvas directory"""
    try:
        # Keep original filename without timestamp
        original_name = file.filename
        
        # Save file directly in canvas directory (no user subdirectory)
        file_path = CANVAS_DIR / original_name
        
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
        if not user_id:
            logger.error("No user ID provided in request")
            raise HTTPException(status_code=400, detail="User ID is required")
        
        if not files:
            logger.error("No files provided in request")
            raise HTTPException(status_code=400, detail="No files provided")
        
        # Load current config
        config = load_config()
        
        # Initialize user entry if not exists
        try:
            if user_id not in config:
                config[user_id] = []
            
            uploaded_images = []
            image_paths = {}
            
            # Get existing image count for this user to continue numbering
            existing_image_count = len(config[user_id])
        except Exception as e:
            logger.error(f"Error at step during user initialization: {e}")
            logger.error(f"Error type: {type(e)}")
            logger.error(f"Error args: {e.args}")
            logger.error(f"Config structure: {config}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=str(e))
        
        for i, file in enumerate(files):
            # Validate file
            if not validate_file(file):
                logger.warning(f"Skipping invalid file: {file.filename}")
                continue
            
            # Check file size
            file.file.seek(0, 2)  # Seek to end
            file_size = file.file.tell()
            file.file.seek(0)  # Reset to beginning
            
            if file_size > MAX_FILE_SIZE:
                logger.warning(f"File too large: {file.filename} ({file_size} bytes)")
                continue
            
            # Check for duplicate image name
            is_duplicate, existing_path = check_duplicate_image(user_id, file.filename, config)
            
            if is_duplicate:
                existing_filename = existing_path.split('/')[-1]
                uploaded_base_name = get_base_image_name(file.filename)
                existing_base_name = get_base_image_name(existing_filename)
                
                # Calculate the next image number (continue from existing count)
                next_image_number = existing_image_count + len(uploaded_images) + 1
                
                # Add existing image path to config without saving new file
                config[user_id].append(existing_path)
                
                uploaded_images.append({
                    "filename": file.filename,
                    "path": existing_path,
                    "size": "duplicate - using existing",
                    "is_duplicate": True,
                    "base_name": uploaded_base_name,
                    "duplicate_type": "base_image"
                })
                image_paths[f"image_{next_image_number}"] = existing_path
                
                continue
            
            try:
                # Save file (only if not duplicate)
                image_path = save_file_to_canvas(file, user_id)
                
                # Calculate the next image number (continue from existing count)
                next_image_number = existing_image_count + len(uploaded_images) + 1
                
                # Update config - simple format: user_id -> [image_paths]
                # Add image path to user's list
                config[user_id].append(image_path)
                
                uploaded_images.append({
                    "filename": file.filename,
                    "path": image_path,
                    "size": file_size,
                    "is_duplicate": False
                })
                image_paths[f"image_{next_image_number}"] = image_path
                
            except Exception as e:
                logger.error(f"Error saving file {file.filename}: {e}")
                logger.error(f"Continuing with next file...")
                continue
        
        # Check if any images were processed
        if len(uploaded_images) == 0:
            logger.warning("No images were processed successfully")
            raise HTTPException(status_code=400, detail="No images were processed successfully")
        
        # Count new uploads vs duplicates
        new_uploads = [img for img in uploaded_images if not img.get('is_duplicate', False)]
        duplicates = [img for img in uploaded_images if img.get('is_duplicate', False)]
        
        # Save updated config
        if not save_config(config):
            logger.error("Failed to save configuration to local file")
            raise HTTPException(status_code=500, detail="Failed to save configuration")
        
        # Create the response in the requested format
        response_data = {
            "user_id": user_id
        }
        
        # Add image paths in the format image_1, image_2, etc.
        for key, path in image_paths.items():
            response_data[key] = path
        
        # Create appropriate message based on upload results
        if len(duplicates) > 0 and len(new_uploads) > 0:
            message = f"Successfully processed {len(uploaded_images)} images: {len(new_uploads)} new uploads, {len(duplicates)} base image duplicates (storage optimized)"
        elif len(duplicates) > 0:
            message = f"Successfully processed {len(duplicates)} base image duplicates (no new files saved - storage optimized)"
        else:
            message = f"Successfully uploaded {len(new_uploads)} new images"
        
        response = {
            "success": True,
            "message": message,
            "data": response_data,
            "uploaded_images": uploaded_images,
            "image_paths": image_paths,
            "total_images": len(config[user_id]),
            "new_uploads": len(new_uploads),
            "duplicates": len(duplicates),
            "storage_optimized": len(duplicates) > 0
        }
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

@router.delete("/image/{user_id}/{image_path:path}")
async def delete_single_image(
    user_id: str,
    image_path: str,
    api_key: str = Depends(verify_api_key)
):
    """Delete a specific image for a user by image path"""
    try:
        config = load_config()
        
        if user_id not in config:
            logger.error(f"User {user_id} not found in config")
            raise HTTPException(status_code=404, detail="User not found")
        
        # Find the image by path in user's images list
        user_images = config[user_id]
        image_index = None
        
        for i, img_path in enumerate(user_images):
            if img_path == f"/{image_path}" or img_path == image_path:
                image_index = i
                break
        
        if image_index is None:
            logger.error(f"Image path {image_path} not found for user {user_id}")
            raise HTTPException(status_code=404, detail="Image not found")
        
        # Get the actual image path from config
        actual_image_path = user_images[image_index]
        
        # Delete physical file
        filename = actual_image_path.replace('/canvas/', '')
        file_path = CANVAS_DIR / filename
        
        if file_path.exists():
            file_path.unlink()
        else:
            logger.warning(f"Physical file not found: {file_path}")
        
        # Remove from user's images list
        deleted_image = config[user_id].pop(image_index)
        
        # Save updated config
        if not save_config(config):
            logger.error("Failed to save configuration after deletion")
            raise HTTPException(status_code=500, detail="Failed to save configuration")
        
        return JSONResponse({
            "success": True,
            "message": f"Deleted image {filename}",
            "deleted_image": deleted_image,
            "remaining_images": len(config[user_id])
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
