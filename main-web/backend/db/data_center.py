from pymongo import MongoClient
from datetime import datetime
from config.settings import settings

class DataCenter:
    def __init__(self):
        self.client = MongoClient(settings.MONGODB_URL)
        self.db = self.client[settings.MONGODB_DB_NAME]
        self.collection = self.db['data_center']

    def update_value(self, key, value, data_type):
        """Update a value in the data center"""
        self.collection.update_one(
            {'key': key},
            {
                '$set': {
                    'value': value,
                    'data_type': data_type,
                    'updated_at': datetime.utcnow()
                }
            },
            upsert=True
        )

    def get_value(self, key):
        """Get a value from the data center"""
        result = self.collection.find_one({'key': key})
        return result['value'] if result else None

    def get_all_values(self):
        """Get all values from the data center"""
        return list(self.collection.find({}, {'_id': 0}))

    def delete_value(self, key):
        """Delete a value from the data center"""
        self.collection.delete_one({'key': key}) 