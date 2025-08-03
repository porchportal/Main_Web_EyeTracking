from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
import os
from datetime import datetime, timedelta
from auth import verify_api_key
import logging
import re
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / '.env.backend'
load_dotenv(dotenv_path=env_path)

# Set up router with /api prefix
router = APIRouter(
    prefix="/api",
    tags=["files"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)

class FileInfo(BaseModel):
    filename: str
    size: int
    file_type: str
    last_modified: str
    path: str
    number: int  # Add number field for sorting

# Cache for file listings
file_cache = {
    'capture': {'data': None, 'timestamp': None},
    'enhance': {'data': None, 'timestamp': None}
}
CACHE_DURATION = timedelta(seconds=30)  # Cache for 30 seconds

def get_cached_files(directory: str) -> Optional[List[FileInfo]]:
    """Get cached file list if available and not expired"""
    cache_key = 'capture' if 'eye_tracking_captures' in directory else 'enhance'
    cache = file_cache[cache_key]
    
    if cache['data'] is not None and cache['timestamp'] is not None:
        if datetime.now() - cache['timestamp'] < CACHE_DURATION:
            return cache['data']
    
    return None

def update_cache(directory: str, files: List[FileInfo]):
    """Update the cache with new file list"""
    cache_key = 'capture' if 'eye_tracking_captures' in directory else 'enhance'
    file_cache[cache_key] = {
        'data': files,
        'timestamp': datetime.now()
    }

def extract_number(filename):
    """Extract the number from filename (e.g., screen_001.jpg -> 1)"""
    match = re.search(r'_(\d+)\.', filename)
    if match:
        return int(match.group(1))
    return 0  # Default to 0 if no number found

@router.get("/file-api", dependencies=[Depends(verify_api_key)])
async def list_files(operation: str = "list"):
    """List files from both capture and enhance directories"""
    if operation == "list":
        try:
            # Get the script directory
            current_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Define the capture and enhance directories
            capture_dir = os.path.abspath(os.path.join(current_dir, '../../frontend/public/captures/eye_tracking_captures'))
            enhance_dir = os.path.abspath(os.path.join(current_dir, '../../frontend/public/captures/enhance'))
            
            # Create directories if they don't exist
            os.makedirs(capture_dir, exist_ok=True)
            os.makedirs(enhance_dir, exist_ok=True)
            
            logging.info(f"Capture directory: {capture_dir}")
            logging.info(f"Enhance directory: {enhance_dir}")
            
            # Check cache first
            cached_capture = get_cached_files(capture_dir)
            cached_enhance = get_cached_files(enhance_dir)
            
            if cached_capture is not None and cached_enhance is not None:
                logging.info("Using cached files")
                return {
                    "success": True,
                    "files": cached_capture + cached_enhance,
                    "message": "Files retrieved successfully (cached)"
                }
            
            # If cache is expired or missing, scan directories
            logging.info(f"Scanning capture directory: {capture_dir}")
            capture_files = []
            if os.path.exists(capture_dir):
                files = os.listdir(capture_dir)
                logging.info(f"Found {len(files)} files in capture directory")
                for filename in files:
                    if filename.endswith(('.jpg', '.jpeg', '.png', '.gif', '.csv')):
                        file_path = os.path.join(capture_dir, filename)
                        stat = os.stat(file_path)
                        file_info = FileInfo(
                            filename=filename,
                            size=stat.st_size,
                            file_type=os.path.splitext(filename)[1][1:].lower(),
                            last_modified=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                            path=f"/captures/eye_tracking_captures/{filename}",
                            number=extract_number(filename)
                        )
                        capture_files.append(file_info)
                        logging.info(f"Added capture file: {filename}")
            
            logging.info(f"Scanning enhance directory: {enhance_dir}")
            enhance_files = []
            if os.path.exists(enhance_dir):
                files = os.listdir(enhance_dir)
                logging.info(f"Found {len(files)} files in enhance directory")
                for filename in files:
                    if filename.endswith(('.jpg', '.jpeg', '.png', '.gif', '.csv')):
                        file_path = os.path.join(enhance_dir, filename)
                        stat = os.stat(file_path)
                        file_info = FileInfo(
                            filename=filename,
                            size=stat.st_size,
                            file_type=os.path.splitext(filename)[1][1:].lower(),
                            last_modified=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                            path=f"/captures/enhance/{filename}",
                            number=extract_number(filename)
                        )
                        enhance_files.append(file_info)
                        logging.info(f"Added enhance file: {filename}")
            
            # Update cache
            update_cache(capture_dir, capture_files)
            update_cache(enhance_dir, enhance_files)
            
            # Sort files by their number
            capture_files.sort(key=lambda x: x.number)
            enhance_files.sort(key=lambda x: x.number)
            
            all_files = capture_files + enhance_files
            logging.info(f"Returning {len(all_files)} total files")
            
            return {
                "success": True,
                "files": all_files,
                "message": f"Files retrieved successfully ({len(capture_files)} capture, {len(enhance_files)} enhance)"
            }
            
        except Exception as e:
            logging.error(f"Error listing files: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail={
                    "success": False,
                    "error": str(e),
                    "message": "Failed to list files"
                }
            )
    elif operation == "check-completeness":
        try:
            # Get the script directory
            current_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Define the capture and enhance directories
            capture_dir = os.path.abspath(os.path.join(current_dir, '../../frontend/public/captures/eye_tracking_captures'))
            enhance_dir = os.path.abspath(os.path.join(current_dir, '../../frontend/public/captures/enhanced_captures'))
            
            # Get all capture files
            capture_files = []
            if os.path.exists(capture_dir):
                for filename in os.listdir(capture_dir):
                    if filename.endswith(('.jpg', '.jpeg', '.png', '.gif')):
                        capture_files.append(filename)
            
            # Get all enhance files
            enhance_files = []
            if os.path.exists(enhance_dir):
                for filename in os.listdir(enhance_dir):
                    if filename.endswith(('.jpg', '.jpeg', '.png', '.gif')):
                        enhance_files.append(filename)
            
            # Check for missing enhanced versions
            missing_files = []
            for capture_file in capture_files:
                set_number = extract_number(capture_file)
                has_enhanced = any(f'enhance_{set_number:03d}' in f for f in enhance_files)
                if not has_enhanced:
                    missing_files.append(capture_file)
            
            return {
                "success": True,
                "isComplete": len(missing_files) == 0,
                "missingFiles": missing_files,
                "message": "File completeness check completed"
            }
            
        except Exception as e:
            logging.error(f"Error checking file completeness: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail={
                    "success": False,
                    "error": str(e),
                    "message": "Failed to check file completeness"
                }
            )
    elif operation == "compare":
        try:
            # Get the script directory
            current_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Define the capture and enhance directories
            capture_dir = os.path.abspath(os.path.join(current_dir, '../../frontend/public/captures/eye_tracking_captures'))
            enhance_dir = os.path.abspath(os.path.join(current_dir, '../../frontend/public/captures/enhanced_captures'))
            
            # Count files in each directory
            capture_count = 0
            enhance_count = 0
            
            if os.path.exists(capture_dir):
                for filename in os.listdir(capture_dir):
                    if filename.endswith(('.jpg', '.jpeg', '.png', '.gif')):
                        capture_count += 1
            
            if os.path.exists(enhance_dir):
                for filename in os.listdir(enhance_dir):
                    if filename.endswith(('.jpg', '.jpeg', '.png', '.gif')):
                        enhance_count += 1
            
            return {
                "success": True,
                "captureCount": capture_count,
                "enhanceCount": enhance_count,
                "needsProcessing": capture_count > enhance_count,
                "message": "File count comparison completed"
            }
            
        except Exception as e:
            logging.error(f"Error comparing file counts: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail={
                    "success": False,
                    "error": str(e),
                    "message": "Failed to compare file counts"
                }
            )
    else:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": "Invalid operation",
                "message": "Operation must be either 'list', 'check-completeness', or 'compare'"
            }
        )

@router.delete("/file-api/{filename}", dependencies=[Depends(verify_api_key)])
async def delete_file(filename: str):
    """Delete a file from the upload directory"""
    try:
        file_path = os.path.join(os.getenv('UPLOAD_DIR'), filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        os.remove(file_path)
        return {"message": f"File {filename} deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 