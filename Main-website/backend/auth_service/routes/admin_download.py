# routes/admin_download.py - Admin download functionality
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import FileResponse, JSONResponse
import os
import zipfile
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional
import logging

# Import auth
from auth import verify_api_key

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin-download"])

# Base path for captures
BASE_CAPTURES_PATH = Path(__file__).parent.parent / "resource_security" / "public" / "captures"
# Path for complete data
BASE_COMPLETE_PATH = Path(__file__).parent.parent / "resource_security" / "public" / "complete"
# Path for enhanced data
BASE_ENHANCE_PATH = Path(__file__).parent.parent / "resource_security" / "public" / "enhance"
# Path for zip downloads
ZIP_DOWNLOADS_PATH = Path(__file__).parent.parent / "resource_security" / "public" / "admin" / "zip-download"

def ensure_zip_downloads_dir():
    """Ensure the zip downloads directory exists"""
    try:
        ZIP_DOWNLOADS_PATH.mkdir(parents=True, exist_ok=True)
        return True
    except Exception as e:
        logger.error(f"Error creating zip downloads directory: {e}")
        return False

def create_user_zip(user_id: str) -> Optional[str]:
    """Create a zip file for a user's capture data"""
    try:
        # Ensure zip downloads directory exists
        if not ensure_zip_downloads_dir():
            return None
        
        user_dir = BASE_CAPTURES_PATH / user_id
        
        if not user_dir.exists():
            return None
        
        # Create zip filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"{user_id}_captures_{timestamp}.zip"
        zip_path = ZIP_DOWNLOADS_PATH / zip_filename
        
        # Create zip file
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Add all files from user directory to zip
            for root, dirs, files in os.walk(user_dir):
                for file in files:
                    file_path = Path(root) / file
                    # Calculate relative path from user directory
                    arcname = file_path.relative_to(user_dir)
                    zipf.write(file_path, arcname)
        
        logger.info(f"Created zip file for user {user_id}: {zip_path}")
        return str(zip_path)
        
    except Exception as e:
        logger.error(f"Error creating zip for user {user_id}: {e}")
        return None

def create_complete_zip(user_id: str) -> Optional[str]:
    """Create a zip file for a user's complete data"""
    try:
        # Ensure zip downloads directory exists
        if not ensure_zip_downloads_dir():
            return None
        
        user_dir = BASE_COMPLETE_PATH / user_id
        
        if not user_dir.exists():
            return None
        
        # Create zip filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"{user_id}_complete_{timestamp}.zip"
        zip_path = ZIP_DOWNLOADS_PATH / zip_filename
        
        # Create zip file
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Add all files from user directory to zip
            for root, dirs, files in os.walk(user_dir):
                for file in files:
                    file_path = Path(root) / file
                    # Calculate relative path from user directory
                    arcname = file_path.relative_to(user_dir)
                    zipf.write(file_path, arcname)
        
        logger.info(f"Created complete zip file for user {user_id}: {zip_path}")
        return str(zip_path)
        
    except Exception as e:
        logger.error(f"Error creating complete zip for user {user_id}: {e}")
        return None

def create_enhance_zip(user_id: str) -> Optional[str]:
    """Create a zip file for a user's enhanced data"""
    try:
        # Ensure zip downloads directory exists
        if not ensure_zip_downloads_dir():
            return None
        
        user_dir = BASE_ENHANCE_PATH / user_id
        
        if not user_dir.exists():
            return None
        
        # Create zip filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"{user_id}_enhance_{timestamp}.zip"
        zip_path = ZIP_DOWNLOADS_PATH / zip_filename
        
        # Create zip file
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Add all files from user directory to zip
            for root, dirs, files in os.walk(user_dir):
                for file in files:
                    file_path = Path(root) / file
                    # Calculate relative path from user directory
                    arcname = file_path.relative_to(user_dir)
                    zipf.write(file_path, arcname)
        
        logger.info(f"Created enhance zip file for user {user_id}: {zip_path}")
        return str(zip_path)
        
    except Exception as e:
        logger.error(f"Error creating enhance zip for user {user_id}: {e}")
        return None

@router.get("/download/check-user-data/{user_id}")
async def check_user_data(user_id: str):
    """Check if user has capture data"""
    logger.info(f"Check user data endpoint called for user: {user_id}")
    try:
        user_dir = BASE_CAPTURES_PATH / user_id
        logger.info(f"Checking user directory: {user_dir}")
        
        if not user_dir.exists():
            return JSONResponse(content={
                "has_data": False,
                "message": "That User Didn't collect any Data",
                "user_id": user_id
            })
        
        # Count files in user directory
        file_count = 0
        for root, dirs, files in os.walk(user_dir):
            file_count += len(files)
        
        return JSONResponse(content={
            "has_data": True,
            "message": f"User has {file_count} files",
            "user_id": user_id,
            "file_count": file_count
        })
        
    except Exception as e:
        logger.error(f"Error checking user data for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/download/download-user-data/{user_id}")
async def download_user_data(user_id: str):
    """Download user's capture data as zip file"""
    try:
        # First check if user has data
        user_dir = BASE_CAPTURES_PATH / user_id
        
        if not user_dir.exists():
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "That User Didn't collect any Data",
                    "user_id": user_id
                }
            )
        
        # Create zip file
        zip_path = create_user_zip(user_id)
        
        if not zip_path or not os.path.exists(zip_path):
            raise HTTPException(status_code=500, detail="Failed to create zip file")
        
        # Return the zip file for download
        zip_filename = os.path.basename(zip_path)
        
        return FileResponse(
            path=zip_path,
            filename=zip_filename,
            media_type='application/zip',
            headers={
                "Content-Disposition": f"attachment; filename={zip_filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading user data for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/download/cleanup-zip/{user_id}")
async def cleanup_user_zip(user_id: str):
    """Clean up old zip files for a user"""
    try:
        if not ZIP_DOWNLOADS_PATH.exists():
            return JSONResponse(content={
                "success": True,
                "message": "No zip files to clean up",
                "cleaned_files": 0
            })
        
        cleaned_count = 0
        # Find and delete zip files for this user (all types)
        for zip_file in ZIP_DOWNLOADS_PATH.glob(f"{user_id}_*.zip"):
            try:
                zip_file.unlink()
                cleaned_count += 1
            except Exception as e:
                logger.warning(f"Could not delete zip file {zip_file}: {e}")
        
        return JSONResponse(content={
            "success": True,
            "message": f"Cleaned up {cleaned_count} zip files for user {user_id}",
            "cleaned_files": cleaned_count
        })
        
    except Exception as e:
        logger.error(f"Error cleaning up zip files for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Complete Data Endpoints
@router.get("/download/check-complete-data/{user_id}")
async def check_complete_data(user_id: str):
    """Check if user has complete data"""
    logger.info(f"Check complete data endpoint called for user: {user_id}")
    try:
        user_dir = BASE_COMPLETE_PATH / user_id
        logger.info(f"Checking complete data directory: {user_dir}")
        
        if not user_dir.exists():
            return JSONResponse(content={
                "has_data": False,
                "message": "No complete data available for this user",
                "user_id": user_id
            })
        
        # Count files in user directory
        file_count = 0
        for root, dirs, files in os.walk(user_dir):
            file_count += len(files)
        
        return JSONResponse(content={
            "has_data": True,
            "message": f"User has {file_count} complete data files",
            "user_id": user_id,
            "file_count": file_count
        })
        
    except Exception as e:
        logger.error(f"Error checking complete data for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/download/download-complete-data/{user_id}")
async def download_complete_data(user_id: str):
    """Download user's complete data as zip file"""
    try:
        # First check if user has complete data
        user_dir = BASE_COMPLETE_PATH / user_id
        
        if not user_dir.exists():
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "No complete data available for this user",
                    "user_id": user_id
                }
            )
        
        # Create zip file
        zip_path = create_complete_zip(user_id)
        
        if not zip_path or not os.path.exists(zip_path):
            raise HTTPException(status_code=500, detail="Failed to create complete data zip file")
        
        # Return the zip file for download
        zip_filename = os.path.basename(zip_path)
        
        return FileResponse(
            path=zip_path,
            filename=zip_filename,
            media_type='application/zip',
            headers={
                "Content-Disposition": f"attachment; filename={zip_filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading complete data for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Enhanced Data Endpoints
@router.get("/download/check-enhance-data/{user_id}")
async def check_enhance_data(user_id: str):
    """Check if user has enhanced data"""
    logger.info(f"Check enhance data endpoint called for user: {user_id}")
    try:
        user_dir = BASE_ENHANCE_PATH / user_id
        logger.info(f"Checking enhance data directory: {user_dir}")
        
        if not user_dir.exists():
            return JSONResponse(content={
                "has_data": False,
                "message": "No enhanced data available for this user",
                "user_id": user_id
            })
        
        # Count files in user directory
        file_count = 0
        for root, dirs, files in os.walk(user_dir):
            file_count += len(files)
        
        return JSONResponse(content={
            "has_data": True,
            "message": f"User has {file_count} enhanced data files",
            "user_id": user_id,
            "file_count": file_count
        })
        
    except Exception as e:
        logger.error(f"Error checking enhance data for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/download/download-enhance-data/{user_id}")
async def download_enhance_data(user_id: str):
    """Download user's enhanced data as zip file"""
    try:
        # First check if user has enhanced data
        user_dir = BASE_ENHANCE_PATH / user_id
        
        if not user_dir.exists():
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "No enhanced data available for this user",
                    "user_id": user_id
                }
            )
        
        # Create zip file
        zip_path = create_enhance_zip(user_id)
        
        if not zip_path or not os.path.exists(zip_path):
            raise HTTPException(status_code=500, detail="Failed to create enhanced data zip file")
        
        # Return the zip file for download
        zip_filename = os.path.basename(zip_path)
        
        return FileResponse(
            path=zip_path,
            filename=zip_filename,
            media_type='application/zip',
            headers={
                "Content-Disposition": f"attachment; filename={zip_filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading enhanced data for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
