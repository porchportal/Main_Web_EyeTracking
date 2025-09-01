# routes/adminDatasetViewer&Edit.py - Admin dataset viewing and editing
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from fastapi.responses import JSONResponse, FileResponse
import os
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
import logging
import shutil

# Import auth
from auth import verify_api_key

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/dataset", tags=["admin-dataset"])

# Base path for captures
BASE_CAPTURES_PATH = Path(__file__).parent.parent / "resource_security" / "public" / "captures"

def get_user_datasets(user_id: str) -> Dict[str, Any]:
    """Get all datasets for a specific user"""
    try:
        user_dir = BASE_CAPTURES_PATH / user_id
        
        if not user_dir.exists():
            return {
                "status": "no_data",
                "message": "Not Collect Yet",
                "datasets": []
            }
        
        datasets = []
        files = list(user_dir.iterdir())
        
        # Group files by capture number
        capture_groups = {}
        
        for file in files:
            if file.is_file():
                # Extract capture number from filename (e.g., webcam_001.jpg -> 001)
                parts = file.stem.split('_')
                if len(parts) >= 2:
                    try:
                        capture_num = int(parts[-1])
                        if capture_num not in capture_groups:
                            capture_groups[capture_num] = []
                        capture_groups[capture_num].append(file)
                    except ValueError:
                        continue
        
        # Convert groups to dataset format
        for capture_num, files in capture_groups.items():
            dataset = {
                "id": capture_num,
                "userId": user_id,
                "name": f"Capture Session {capture_num:03d}",
                "type": "eye_tracking",
                "timestamp": datetime.fromtimestamp(files[0].stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                "files": [],
                "status": "completed",
                "duration": "Unknown"
            }
            
            for file in files:
                file_size = file.stat().st_size
                
                if file_size < 1024:
                    size_str = f"{file_size} B"
                elif file_size < 1024 * 1024:
                    size_str = f"{file_size / 1024:.1f} KB"
                else:
                    size_str = f"{file_size / (1024 * 1024):.1f} MB"
                
                file_info = {
                    "name": file.name,
                    "type": file.suffix[1:],  # Remove the dot
                    "size": size_str,
                    "path": str(file.relative_to(BASE_CAPTURES_PATH))
                }
                dataset["files"].append(file_info)
            
            datasets.append(dataset)
        
        # Sort datasets by capture number
        datasets.sort(key=lambda x: x["id"])
        
        return {
            "status": "success",
            "message": f"Found {len(datasets)} datasets",
            "datasets": datasets
        }
        
    except Exception as error:
        logger.error(f"Error getting datasets for user {user_id}: {error}")
        raise HTTPException(status_code=500, detail=f"Error retrieving datasets: {str(error)}")

def get_all_users_datasets() -> Dict[str, Any]:
    """Get datasets for all users"""
    try:
        all_datasets = {}
        
        if not BASE_CAPTURES_PATH.exists():
            return {
                "status": "no_data",
                "message": "No capture directory found",
                "users": {}
            }
        
        # Get all user directories
        user_dirs = [d for d in BASE_CAPTURES_PATH.iterdir() if d.is_dir() and not d.name.startswith('.')]
        
        for user_dir in user_dirs:
            user_id = user_dir.name
            user_datasets = get_user_datasets(user_id)
            all_datasets[user_id] = user_datasets
        
        return {
            "status": "success",
            "message": f"Retrieved datasets for {len(all_datasets)} users",
            "users": all_datasets
        }
        
    except Exception as error:
        logger.error(f"Error getting all users datasets: {error}")
        raise HTTPException(status_code=500, detail=f"Error retrieving all datasets: {str(error)}")

@router.get("/user/{user_id}")
async def get_user_dataset_list(
    user_id: str,
    api_key: str = Depends(verify_api_key)
):
    """Get all datasets for a specific user"""
    try:
        result = get_user_datasets(user_id)
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Unexpected error in get_user_dataset_list: {error}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/all")
async def get_all_datasets(
    api_key: str = Depends(verify_api_key)
):
    """Get datasets for all users"""
    try:
        result = get_all_users_datasets()
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Unexpected error in get_all_datasets: {error}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/file/{user_id}/{filename:path}")
async def get_dataset_file(
    user_id: str,
    filename: str,
    api_key: str = Depends(verify_api_key)
):
    """Get a specific file from a user's dataset"""
    try:
        file_path = BASE_CAPTURES_PATH / user_id / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {filename}")
        
        if not file_path.is_file():
            raise HTTPException(status_code=400, detail="Not a file")
        
        # Security check: ensure the file is within the user's directory
        try:
            file_path.resolve().relative_to(BASE_CAPTURES_PATH / user_id)
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Determine content type based on file extension
        content_type = 'application/octet-stream'
        if filename.lower().endswith(('.jpg', '.jpeg')):
            content_type = 'image/jpeg'
        elif filename.lower().endswith('.png'):
            content_type = 'image/png'
        elif filename.lower().endswith('.csv'):
            content_type = 'text/csv'
        elif filename.lower().endswith('.json'):
            content_type = 'application/json'
        
        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type=content_type
        )
        
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error serving file {filename} for user {user_id}: {error}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/edit-file/{user_id}/{filename:path}")
async def update_dataset_file(
    user_id: str,
    filename: str,
    file_content: str = Body(...),
    api_key: str = Depends(verify_api_key)
):
    """Update a specific file in a user's dataset (for CSV editing)"""
    logger.info(f"PUT request received for file: {filename} for user: {user_id}")
    try:
        file_path = BASE_CAPTURES_PATH / user_id / filename
        logger.info(f"File path: {file_path}")
        logger.info(f"File exists: {file_path.exists()}")
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {filename}")
        
        if not file_path.is_file():
            raise HTTPException(status_code=400, detail="Not a file")
        
        # Security check: ensure the file is within the user's directory
        try:
            file_path.resolve().relative_to(BASE_CAPTURES_PATH / user_id)
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Only allow CSV files to be updated
        if not filename.lower().endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only CSV files can be updated")
        
        # Write the new content to the file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(file_content)
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Updated file {filename}",
            "updated_file": filename
        })
        
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error updating file {filename} for user {user_id}: {error}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/file/{user_id}/{filename:path}")
async def delete_dataset_file(
    user_id: str,
    filename: str,
    api_key: str = Depends(verify_api_key)
):
    """Delete a specific file from a user's dataset"""
    try:
        file_path = BASE_CAPTURES_PATH / user_id / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {filename}")
        
        if not file_path.is_file():
            raise HTTPException(status_code=400, detail="Not a file")
        
        # Security check: ensure the file is within the user's directory
        try:
            file_path.resolve().relative_to(BASE_CAPTURES_PATH / user_id)
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Delete the file
        file_path.unlink()
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Deleted file {filename}",
            "deleted_file": filename
        })
        
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error deleting file {filename} for user {user_id}: {error}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/user/{user_id}/dataset/{dataset_id}")
async def delete_dataset(
    user_id: str,
    dataset_id: int,
    api_key: str = Depends(verify_api_key)
):
    """Delete a specific dataset for a user"""
    try:
        user_dir = BASE_CAPTURES_PATH / user_id
        
        if not user_dir.exists():
            raise HTTPException(status_code=404, detail="User directory not found")
        
        # Find all files for this dataset
        files_to_delete = []
        for file in user_dir.iterdir():
            if file.is_file():
                parts = file.stem.split('_')
                if len(parts) >= 2:
                    try:
                        capture_num = int(parts[-1])
                        if capture_num == dataset_id:
                            files_to_delete.append(file)
                    except ValueError:
                        continue
        
        if not files_to_delete:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Delete all files in the dataset
        deleted_files = []
        for file in files_to_delete:
            try:
                file.unlink()
                deleted_files.append(file.name)
            except Exception as error:
                logger.error(f"Error deleting file {file}: {error}")
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Deleted dataset {dataset_id}",
            "deleted_files": deleted_files
        })
        
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error deleting dataset {dataset_id} for user {user_id}: {error}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/user/{user_id}")
async def delete_user_all_datasets(
    user_id: str,
    api_key: str = Depends(verify_api_key)
):
    """Delete all datasets for a user"""
    try:
        user_dir = BASE_CAPTURES_PATH / user_id
        
        if not user_dir.exists():
            raise HTTPException(status_code=404, detail="User directory not found")
        
        # Count files before deletion
        file_count = len([f for f in user_dir.iterdir() if f.is_file()])
        
        # Delete the entire user directory
        shutil.rmtree(user_dir)
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Deleted all datasets for user {user_id}",
            "deleted_files_count": file_count
        })
        
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error deleting all datasets for user {user_id}: {error}")
        raise HTTPException(status_code=500, detail="Internal server error")
