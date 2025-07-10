from db.data_center import DataCenter
import threading
import time
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class DataCenterService:
    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def initialize(self):
        """Initialize the data center service"""
        if not self._initialized:
            await DataCenter.initialize()
            self._initialized = True
            logger.info("DataCenterService initialized successfully")

    def start_update_thread(self):
        """Start the background thread for periodic updates"""
        if not self._initialized:
            self._initialized = True
            self.update_thread = threading.Thread(target=self._update_loop)
            self.update_thread.daemon = True
            self.update_thread.start()

    def stop_update_thread(self):
        """Stop the background thread"""
        self._initialized = False
        if self.update_thread:
            self.update_thread.join()

    def _update_loop(self):
        """Background thread that updates subscribers every 5 seconds"""
        while self._initialized:
            data = self.data_center.get_all_values()
            for subscriber in self.subscribers:
                try:
                    subscriber(data)
                except Exception as e:
                    print(f"Error updating subscriber: {e}")
            time.sleep(5)

    def subscribe(self, callback):
        """Subscribe to data updates"""
        self.subscribers.add(callback)
        if not self._initialized:
            self._initialized = True
            self.start_update_thread()

    def unsubscribe(self, callback):
        """Unsubscribe from data updates"""
        self.subscribers.discard(callback)
        if not self.subscribers and self._initialized:
            self.stop_update_thread()

    async def get_value(self, key: str) -> Any:
        """Get a value from the data center"""
        try:
            if not self._initialized:
                await self.initialize()
            return await DataCenter.get_value(key)
        except Exception as e:
            logger.error(f"Error getting value for key {key}: {str(e)}")
            raise

    async def update_value(self, key: str, value: Any, data_type: str = "json"):
        """Update a value in the data center"""
        try:
            if not self._initialized:
                await self.initialize()
            return await DataCenter.update_value(key, value, data_type)
        except Exception as e:
            logger.error(f"Error updating value for key {key}: {str(e)}")
            raise

    async def get_all_values(self) -> List[Dict[str, Any]]:
        """Get all values from the data center"""
        try:
            if not self._initialized:
                await self.initialize()
            return await DataCenter.get_all_values()
        except Exception as e:
            logger.error(f"Error getting all values: {str(e)}")
            raise

    async def delete_value(self, key: str):
        """Delete a value from the data center"""
        try:
            if not self._initialized:
                await self.initialize()
            return await DataCenter.delete_value(key)
        except Exception as e:
            logger.error(f"Error deleting value for key {key}: {str(e)}")
            raise

# Create a singleton instance
data_center_service = DataCenterService() 