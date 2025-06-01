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

@router.get("/preview-api", dependencies=[Depends(verify_api_key)])
async def get_preview(filename: str) -> PreviewResponse:
    """Get preview of a file"""
    try:
        # Get the base directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.abspath(os.path.join(current_dir, '../../frontend/public/captures'))
        
        # Determine which directory the file is in
        if 'enhance' in filename:
            file_dir = os.path.join(base_dir, 'enhance')
        else:
            file_dir = os.path.join(base_dir, 'eye_tracking_captures')
            
        file_path = os.path.join(file_dir, filename)
        
        logging.info(f"Current directory: {current_dir}")
        logging.info(f"Base directory: {base_dir}")
        logging.info(f"File directory: {file_dir}")
        logging.info(f"Looking for preview file: {file_path}")
        
        if not os.path.exists(file_path):
            logging.error(f"File not found at path: {file_path}")
            raise HTTPException(status_code=404, detail="File not found")
            
        # Check if file is an image
        file_ext = os.path.splitext(filename)[1].lower()
        logging.info(f"File extension: {file_ext}")
        
        if file_ext in ['.jpg', '.jpeg', '.png', '.gif']:
            # Read and encode the image file
            with open(file_path, 'rb') as f:
                image_data = base64.b64encode(f.read()).decode('utf-8')
                logging.info(f"Successfully encoded image data, length: {len(image_data)}")
                
            return PreviewResponse(
                data=image_data,
                success=True,
                type="image"
            )
        else:
            # For non-image files, read as text
            with open(file_path, 'r') as f:
                text_data = f.read()
                logging.info(f"Successfully read text data, length: {len(text_data)}")
                
            return PreviewResponse(
                data=text_data,
                success=True,
                type="text"
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