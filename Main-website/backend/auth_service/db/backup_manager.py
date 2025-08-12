# backend/db/backup_manager.py
import os
import json
import asyncio
import logging
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from bson import ObjectId, json_util
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / '.env.backend'
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

class BackupManager:
    _instance = None
    _client = None
    _db = None
    _backup_dir = None
    _auto_backup_enabled = True
    _backup_thread = None
    _running = False
    
    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, '_initialized'):
            self._initialized = True
            self._setup_backup_directory()
            self._start_backup_thread()
    
    def _setup_backup_directory(self):
        """Setup backup directory"""
        try:
            # Create backup directory in the project root
            project_root = Path(__file__).parent.parent.parent.parent
            self._backup_dir = project_root / 'backup_data'
            self._backup_dir.mkdir(exist_ok=True)
            
            # Create subdirectories for different data types
            (self._backup_dir / 'user_preferences').mkdir(exist_ok=True)
            (self._backup_dir / 'data_center').mkdir(exist_ok=True)
            (self._backup_dir / 'consent_data').mkdir(exist_ok=True)
            (self._backup_dir / 'admin_data').mkdir(exist_ok=True)
            
            logger.info(f"Backup directory setup: {self._backup_dir}")
        except Exception as e:
            logger.error(f"Failed to setup backup directory: {e}")
    
    def _start_backup_thread(self):
        """Start background backup thread"""
        if not self._running:
            self._running = True
            self._backup_thread = threading.Thread(target=self._backup_loop, daemon=True)
            self._backup_thread.start()
            logger.info("Backup thread started")
    
    def _backup_loop(self):
        """Background thread for periodic backups"""
        while self._running:
            try:
                # Perform backup every 5 minutes
                time.sleep(300)
                asyncio.run(self.perform_backup())
            except Exception as e:
                logger.error(f"Error in backup loop: {e}")
                time.sleep(60)  # Wait 1 minute before retrying
    
    async def initialize(self, client: AsyncIOMotorClient, db_name: str):
        """Initialize backup manager with MongoDB connection"""
        try:
            self._client = client
            self._db = self._client[db_name]
            logger.info("Backup manager initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize backup manager: {e}")
            return False
    
    async def perform_backup(self):
        """Perform complete database backup"""
        try:
            if self._client is None or self._db is None:
                logger.warning("Backup manager not initialized, skipping backup")
                return
            
            logger.info("Starting database backup...")
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            
            # Backup all collections
            collections = await self._db.list_collection_names()
            
            for collection_name in collections:
                await self._backup_collection(collection_name, timestamp)
            
            # Create backup summary
            await self._create_backup_summary(timestamp)
            
            logger.info(f"Backup completed successfully at {timestamp}")
            
        except Exception as e:
            logger.error(f"Backup failed: {e}")
    
    async def _backup_collection(self, collection_name: str, timestamp: str):
        """Backup a specific collection"""
        try:
            collection = self._db[collection_name]
            documents = []
            
            # Fetch all documents from collection
            async for doc in collection.find({}):
                # Convert ObjectId to string for JSON serialization
                doc['_id'] = str(doc['_id'])
                documents.append(doc)
            
            # Determine backup directory based on collection name
            if 'user_preferences' in collection_name:
                backup_subdir = 'user_preferences'
            elif 'data_center' in collection_name:
                backup_subdir = 'data_center'
            elif 'consent' in collection_name:
                backup_subdir = 'consent_data'
            elif 'admin' in collection_name:
                backup_subdir = 'admin_data'
            else:
                backup_subdir = 'other'
                (self._backup_dir / backup_subdir).mkdir(exist_ok=True)
            
            # Create backup file
            backup_file = self._backup_dir / backup_subdir / f"{collection_name}_{timestamp}.json"
            
            # Save to JSON file
            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'collection_name': collection_name,
                    'backup_timestamp': timestamp,
                    'document_count': len(documents),
                    'documents': documents
                }, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Backed up {collection_name}: {len(documents)} documents")
            
        except Exception as e:
            logger.error(f"Failed to backup collection {collection_name}: {e}")
    
    async def _create_backup_summary(self, timestamp: str):
        """Create a backup summary file"""
        try:
            summary = {
                'backup_timestamp': timestamp,
                'backup_date': datetime.now().isoformat(),
                'collections_backed_up': [],
                'total_documents': 0,
                'backup_directory': str(self._backup_dir)
            }
            
            # Count documents in each collection
            collections = await self._db.list_collection_names()
            for collection_name in collections:
                collection = self._db[collection_name]
                doc_count = await collection.count_documents({})
                summary['collections_backed_up'].append({
                    'name': collection_name,
                    'document_count': doc_count
                })
                summary['total_documents'] += doc_count
            
            # Save summary
            summary_file = self._backup_dir / f"backup_summary_{timestamp}.json"
            with open(summary_file, 'w', encoding='utf-8') as f:
                json.dump(summary, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Backup summary created: {summary['total_documents']} total documents")
            
        except Exception as e:
            logger.error(f"Failed to create backup summary: {e}")
    
    async def backup_on_operation(self, operation_type: str, collection_name: str, data: Dict = None):
        """Trigger backup after database operations"""
        if not self._auto_backup_enabled:
            return
        
        try:
            logger.info(f"Auto-backup triggered by {operation_type} operation on {collection_name}")
            await self.perform_backup()
        except Exception as e:
            logger.error(f"Auto-backup failed: {e}")
    
    def enable_auto_backup(self):
        """Enable automatic backup on operations"""
        self._auto_backup_enabled = True
        logger.info("Auto-backup enabled")
    
    def disable_auto_backup(self):
        """Disable automatic backup on operations"""
        self._auto_backup_enabled = False
        logger.info("Auto-backup disabled")
    
    async def restore_from_backup(self, backup_file: str, collection_name: str = None):
        """Restore data from a backup file"""
        try:
            with open(backup_file, 'r', encoding='utf-8') as f:
                backup_data = json.load(f)
            
            if self._db is None:
                logger.error("Database not connected for restore")
                return False
            
            # Determine collection name
            target_collection = collection_name or backup_data.get('collection_name')
            if not target_collection:
                logger.error("No collection name specified for restore")
                return False
            
            collection = self._db[target_collection]
            
            # Clear existing data
            await collection.delete_many({})
            
            # Restore documents
            documents = backup_data.get('documents', [])
            if documents:
                # Convert string IDs back to ObjectId
                for doc in documents:
                    if '_id' in doc and isinstance(doc['_id'], str):
                        try:
                            doc['_id'] = ObjectId(doc['_id'])
                        except:
                            pass
                
                await collection.insert_many(documents)
            
            logger.info(f"Restored {len(documents)} documents to {target_collection}")
            return True
            
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return False
    
    def get_backup_files(self):
        """Get list of available backup files"""
        try:
            backup_files = []
            for subdir in self._backup_dir.iterdir():
                if subdir.is_dir():
                    for file in subdir.glob("*.json"):
                        backup_files.append({
                            'path': str(file),
                            'name': file.name,
                            'size': file.stat().st_size,
                            'modified': datetime.fromtimestamp(file.stat().st_mtime).isoformat()
                        })
            return backup_files
        except Exception as e:
            logger.error(f"Failed to get backup files: {e}")
            return []
    
    def cleanup_old_backups(self, keep_days: int = 30):
        """Clean up old backup files (optional)"""
        try:
            cutoff_date = datetime.now().timestamp() - (keep_days * 24 * 60 * 60)
            deleted_count = 0
            
            for subdir in self._backup_dir.iterdir():
                if subdir.is_dir():
                    for file in subdir.glob("*.json"):
                        if file.stat().st_mtime < cutoff_date:
                            file.unlink()
                            deleted_count += 1
            
            logger.info(f"Cleaned up {deleted_count} old backup files")
            
        except Exception as e:
            logger.error(f"Failed to cleanup old backups: {e}")
    
    def stop(self):
        """Stop the backup manager"""
        self._running = False
        if self._backup_thread:
            self._backup_thread.join(timeout=5)
        logger.info("Backup manager stopped")

# Global backup manager instance
backup_manager = BackupManager() 