"""
Canvas Image Serving Route
Serves canvas background images from the resource_security/canvas directory
"""

import os
import mimetypes
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pathlib import Path
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Base directory for canvas images
CANVAS_BASE_DIR = Path(__file__).parent.parent / "resource_security" / "canvas"

@router.get("/api/canvas-image/{filename}")
async def serve_canvas_image(filename: str, request: Request):
    """
    Serve canvas background images from the resource_security/canvas directory
    
    Args:
        filename: The filename of the image to serve
        request: FastAPI request object
    
    Returns:
        FileResponse: The image file or 404 if not found
    """
    try:
        # Security check: prevent directory traversal
        if ".." in filename or "/" in filename or "\\" in filename:
            logger.warning(f"Attempted directory traversal with filename: {filename}")
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        # Construct the full file path
        file_path = CANVAS_BASE_DIR / filename
        
        # Check if file exists
        if not file_path.exists():
            logger.warning(f"Canvas image not found: {filename} at path: {file_path}")
            raise HTTPException(status_code=404, detail=f"Image not found: {filename}")
        
        # Check if it's actually a file (not a directory)
        if not file_path.is_file():
            logger.warning(f"Path is not a file: {file_path}")
            raise HTTPException(status_code=400, detail="Invalid file path")
        
        # Get MIME type
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if not mime_type:
            mime_type = "application/octet-stream"
        
        # Log successful request
        logger.info(f"Serving canvas image: {filename} (MIME: {mime_type})")
        
        # Return the file
        return FileResponse(
            path=str(file_path),
            media_type=mime_type,
            filename=filename,
            headers={
                "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error serving canvas image {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/api/canvas-image/")
async def list_canvas_images():
    """
    List all available canvas images
    
    Returns:
        dict: List of available canvas images
    """
    try:
        if not CANVAS_BASE_DIR.exists():
            logger.warning(f"Canvas directory does not exist: {CANVAS_BASE_DIR}")
            return {"images": [], "message": "Canvas directory not found"}
        
        # Get all image files
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
        images = []
        
        for file_path in CANVAS_BASE_DIR.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in image_extensions:
                images.append({
                    "filename": file_path.name,
                    "size": file_path.stat().st_size,
                    "modified": file_path.stat().st_mtime
                })
        
        logger.info(f"Found {len(images)} canvas images")
        return {
            "images": images,
            "count": len(images),
            "directory": str(CANVAS_BASE_DIR)
        }
        
    except Exception as e:
        logger.error(f"Error listing canvas images: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.options("/api/canvas-image/{filename}")
async def canvas_image_options(filename: str):
    """
    Handle OPTIONS requests for CORS preflight
    
    Args:
        filename: The filename (not used but required for route matching)
    
    Returns:
        dict: CORS headers
    """
    return {
        "message": "CORS preflight",
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
    }

@router.options("/api/canvas-image/")
async def canvas_image_list_options():
    """
    Handle OPTIONS requests for CORS preflight (list endpoint)
    
    Returns:
        dict: CORS headers
    """
    return {
        "message": "CORS preflight",
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
    }
