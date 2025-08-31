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
            json.dump({
                "users": {},
                "images": {},
                "last_updated": datetime.now().isoformat()
            }, f, indent=2)

def load_config():
    """Load configuration from config.json"""
    ensure_canvas_directory()
    try:
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading config: {e}")
        return {"users": {}, "images": {}, "last_updated": datetime.now().isoformat()}

def save_config(config):
    """Save configuration to config.json"""
    ensure_canvas_directory()
    config["last_updated"] = datetime.now().isoformat()
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

def save_file_to_canvas(file: UploadFile, user_id: str) -> str:
    """Save uploaded file to canvas directory"""
    # Generate unique filename
    timestamp = int(datetime.now().timestamp() * 1000)
    original_name = file.filename
    file_ext = Path(original_name).suffix
    filename = f"{timestamp}-{original_name}"
    
    # Create user-specific directory
    user_dir = CANVAS_DIR / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    
    # Save file
    file_path = user_dir / filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Return relative path for frontend
    return f"/canvas/{user_id}/{filename}"

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
            raise HTTPException(status_code=400, detail="User ID is required")
        
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")
        
        # Load current config
        config = load_config()
        
        # Initialize user entry if not exists
        if user_id not in config["users"]:
            config["users"][user_id] = {
                "created_at": datetime.now().isoformat(),
                "image_count": 0,
                "images": []
            }
        
        uploaded_images = []
        image_paths = {}
        
        # Get existing image count for this user to continue numbering
        existing_image_count = len(config["users"][user_id]["images"])
        
        for i, file in enumerate(files):
            logger.info(f"Processing file {i+1}: {file.filename}")
            
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
            
            try:
                # Save file
                image_path = save_file_to_canvas(file, user_id)
                
                # Calculate the next image number (continue from existing count)
                next_image_number = existing_image_count + len(uploaded_images) + 1
                
                # Update config
                image_info = {
                    "filename": file.filename,
                    "path": image_path,
                    "size": file_size,
                    "uploaded_at": datetime.now().isoformat(),
                    "image_key": f"image_{next_image_number}"
                }
                
                config["users"][user_id]["images"].append(image_info)
                config["users"][user_id]["image_count"] = len(config["users"][user_id]["images"])
                
                # Add to global images registry
                timestamp_ms = int(datetime.now().timestamp() * 1000)
                image_id = f"{user_id}_{Path(file.filename).stem}_{timestamp_ms}"
                config["images"][image_id] = {
                    "user_id": user_id,
                    "path": image_path,
                    "filename": file.filename,
                    "uploaded_at": image_info["uploaded_at"]
                }
                
                uploaded_images.append(image_info)
                image_paths[f"image_{next_image_number}"] = image_path
                
                logger.info(f"Successfully uploaded: {file.filename} for user {user_id}")
                
            except Exception as e:
                logger.error(f"Error saving file {file.filename}: {e}")
                continue
        
        # Save updated config
        if not save_config(config):
            raise HTTPException(status_code=500, detail="Failed to save configuration")
        
        # Create the response in the requested format
        response_data = {
            "user_id": user_id
        }
        
        # Add image paths in the format image_1, image_2, etc.
        for key, path in image_paths.items():
            response_data[key] = path
        
        return JSONResponse({
            "success": True,
            "message": f"Successfully uploaded {len(uploaded_images)} images",
            "data": response_data,
            "uploaded_images": uploaded_images,
            "image_paths": image_paths,
            "total_images": config["users"][user_id]["image_count"]
        })
        
    except Exception as e:
        logger.error(f"Error in upload_canvas_images: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user-images/{user_id}")
async def get_user_images(
    user_id: str,
    api_key: str = Depends(verify_api_key)
):
    """Get all images for a specific user"""
    try:
        config = load_config()
        
        if user_id not in config["users"]:
            return JSONResponse({
                "success": True,
                "user_id": user_id,
                "images": [],
                "image_count": 0
            })
        
        user_data = config["users"][user_id]
        
        return JSONResponse({
            "success": True,
            "user_id": user_id,
            "images": user_data["images"],
            "image_count": user_data["image_count"],
            "created_at": user_data["created_at"]
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
        
        if user_id not in config["users"]:
            return JSONResponse({
                "success": True,
                "message": "User not found or no images to delete"
            })
        
        # Get user images
        user_images = config["users"][user_id]["images"]
        
        # Delete physical files
        user_dir = CANVAS_DIR / user_id
        if user_dir.exists():
            shutil.rmtree(user_dir)
        
        # Remove from global images registry
        images_to_remove = []
        for image_id, image_data in config["images"].items():
            if image_data["user_id"] == user_id:
                images_to_remove.append(image_id)
        
        for image_id in images_to_remove:
            del config["images"][image_id]
        
        # Remove user from config
        del config["users"][user_id]
        
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
        
        if user_id not in config["users"]:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Find the image
        user_images = config["users"][user_id]["images"]
        image_to_delete = None
        
        for image in user_images:
            if image["image_key"] == image_key:
                image_to_delete = image
                break
        
        if not image_to_delete:
            raise HTTPException(status_code=404, detail="Image not found")
        
        # Delete physical file
        image_path = CANVAS_DIR / user_id / Path(image_to_delete["path"]).name
        if image_path.exists():
            image_path.unlink()
        
        # Remove from user's images list
        config["users"][user_id]["images"] = [
            img for img in user_images if img["image_key"] != image_key
        ]
        config["users"][user_id]["image_count"] = len(config["users"][user_id]["images"])
        
        # Remove from global images registry
        images_to_remove = []
        for image_id, image_data in config["images"].items():
            if image_data["user_id"] == user_id and image_data["path"] == image_to_delete["path"]:
                images_to_remove.append(image_id)
        
        for image_id in images_to_remove:
            del config["images"][image_id]
        
        # Save updated config
        if not save_config(config):
            raise HTTPException(status_code=500, detail="Failed to save configuration")
        
        return JSONResponse({
            "success": True,
            "message": f"Deleted image {image_to_delete['filename']}",
            "deleted_image": image_to_delete
        })
        
    except Exception as e:
        logger.error(f"Error deleting single image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/canvas/{user_id}/{filename}")
async def serve_canvas_image(
    user_id: str,
    filename: str,
    api_key: str = Depends(verify_api_key)
):
    """Serve canvas images"""
    try:
        image_path = CANVAS_DIR / user_id / filename
        
        if not image_path.exists():
            raise HTTPException(status_code=404, detail="Image not found")
        
        return FileResponse(image_path)
        
    except Exception as e:
        logger.error(f"Error serving canvas image: {e}")
        raise HTTPException(status_code=500, detail=str(e))
