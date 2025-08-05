# backend/routes/backup.py
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
import logging
from datetime import datetime
from db.backup_manager import backup_manager
from auth import verify_api_key

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/backup",
    tags=["backup"]
)

@router.post("/perform", dependencies=[Depends(verify_api_key)])
async def perform_backup():
    """Manually trigger a backup"""
    try:
        await backup_manager.perform_backup()
        return {
            "success": True,
            "message": "Backup completed successfully",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Manual backup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")

@router.get("/files", dependencies=[Depends(verify_api_key)])
async def get_backup_files():
    """Get list of available backup files"""
    try:
        files = backup_manager.get_backup_files()
        return {
            "success": True,
            "files": files,
            "total_files": len(files)
        }
    except Exception as e:
        logger.error(f"Failed to get backup files: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get backup files: {str(e)}")

@router.post("/restore", dependencies=[Depends(verify_api_key)])
async def restore_from_backup(backup_file: str, collection_name: str = None):
    """Restore data from a backup file"""
    try:
        success = await backup_manager.restore_from_backup(backup_file, collection_name)
        if success:
            return {
                "success": True,
                "message": f"Restored data from {backup_file}",
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=400, detail="Restore failed")
    except Exception as e:
        logger.error(f"Restore failed: {e}")
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")

@router.post("/enable-auto", dependencies=[Depends(verify_api_key)])
async def enable_auto_backup():
    """Enable automatic backup on operations"""
    try:
        backup_manager.enable_auto_backup()
        return {
            "success": True,
            "message": "Auto-backup enabled",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to enable auto-backup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to enable auto-backup: {str(e)}")

@router.post("/disable-auto", dependencies=[Depends(verify_api_key)])
async def disable_auto_backup():
    """Disable automatic backup on operations"""
    try:
        backup_manager.disable_auto_backup()
        return {
            "success": True,
            "message": "Auto-backup disabled",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to disable auto-backup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to disable auto-backup: {str(e)}")

@router.post("/cleanup", dependencies=[Depends(verify_api_key)])
async def cleanup_old_backups(keep_days: int = 30):
    """Clean up old backup files"""
    try:
        backup_manager.cleanup_old_backups(keep_days)
        return {
            "success": True,
            "message": f"Cleaned up backups older than {keep_days} days",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to cleanup old backups: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cleanup old backups: {str(e)}")

@router.get("/status", dependencies=[Depends(verify_api_key)])
async def get_backup_status():
    """Get backup manager status"""
    try:
        return {
            "success": True,
            "auto_backup_enabled": backup_manager._auto_backup_enabled,
            "backup_directory": str(backup_manager._backup_dir),
            "running": backup_manager._running,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get backup status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get backup status: {str(e)}") 