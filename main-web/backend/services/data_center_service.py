from db.data_center import DataCenter
import threading
import time
from typing import List, Dict, Any

class DataCenterService:
    def __init__(self):
        self.data_center = DataCenter()
        self.subscribers = set()
        self.update_thread = None
        self.running = False

    def start_update_thread(self):
        """Start the background thread for periodic updates"""
        if not self.running:
            self.running = True
            self.update_thread = threading.Thread(target=self._update_loop)
            self.update_thread.daemon = True
            self.update_thread.start()

    def stop_update_thread(self):
        """Stop the background thread"""
        self.running = False
        if self.update_thread:
            self.update_thread.join()

    def _update_loop(self):
        """Background thread that updates subscribers every 5 seconds"""
        while self.running:
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
        if not self.running:
            self.start_update_thread()

    def unsubscribe(self, callback):
        """Unsubscribe from data updates"""
        self.subscribers.discard(callback)
        if not self.subscribers and self.running:
            self.stop_update_thread()

    def update_value(self, key: str, value: Any, data_type: str):
        """Update a value and notify subscribers"""
        self.data_center.update_value(key, value, data_type)
        data = self.data_center.get_all_values()
        for subscriber in self.subscribers:
            try:
                subscriber(data)
            except Exception as e:
                print(f"Error updating subscriber: {e}")

    def get_all_values(self) -> List[Dict[str, Any]]:
        """Get all current values"""
        return self.data_center.get_all_values()

    def get_value(self, key: str) -> Any:
        """Get a value from the data center"""
        return self.data_center.get_value(key)

# Create a singleton instance
data_center_service = DataCenterService() 