# 🔄 MongoDB Auto-Backup System

## 📋 Overview

This backup system automatically creates JSON backups of your MongoDB data without expiration, storing them in organized directories. The system integrates seamlessly with your existing database operations and provides both automatic and manual backup capabilities.

## 🏗️ Architecture

```
MongoDB Database → Backup Manager → JSON Files
     ↓                ↓              ↓
  Collections    Auto-Trigger    Organized Folders
```

## 📁 Directory Structure

```
backup_data/
├── user_preferences/     # User preference backups
├── data_center/         # Data center backups  
├── consent_data/        # Consent data backups
├── admin_data/          # Admin data backups
├── other/              # Other collections
└── backup_summary_*.json # Backup summaries
```

## ⚡ Features

### ✅ **Automatic Backup**
- **No Expiration**: Backups never expire automatically
- **Auto-Trigger**: Backups on every database operation
- **Background Thread**: Periodic backups every 5 minutes
- **Real-time**: Immediate backup after data changes

### ✅ **Manual Control**
- **Manual Backup**: Trigger backups on demand
- **Restore**: Restore data from backup files
- **Status Check**: Monitor backup system status
- **File Management**: List and manage backup files

### ✅ **Organized Storage**
- **Categorized**: Different data types in separate folders
- **Timestamped**: Each backup has unique timestamp
- **JSON Format**: Human-readable backup files
- **Summary Files**: Overview of all backups

## 🔧 Implementation

### **1. Backup Manager** (`backend/auth_service/db/backup_manager.py`)
```python
# Singleton pattern for global backup management
backup_manager = BackupManager()

# Automatic backup on operations
await backup_manager.backup_on_operation('update', 'data_center', data)

# Manual backup
await backup_manager.perform_backup()
```

### **2. Database Integration** (`backend/auth_service/db/mongodb.py`)
```python
# Initialize backup manager on connection
await backup_manager.initialize(cls._client, os.getenv("MONGODB_DB_NAME"))
```

### **3. DataCenter Integration** (`backend/auth_service/db/data_center.py`)
```python
# Trigger backup after operations
await backup_manager.backup_on_operation('update', 'data_center', {'key': key, 'value': value})
```

### **4. API Endpoints** (`backend/auth_service/routes/backup.py`)
```python
# Manual backup
POST /api/backup/perform

# List backup files
GET /api/backup/files

# Restore from backup
POST /api/backup/restore

# Enable/disable auto-backup
POST /api/backup/enable-auto
POST /api/backup/disable-auto
```

## 🚀 Usage

### **Automatic Backup (Default)**
The system automatically backs up data when:
- ✅ Database operations occur (insert, update, delete)
- ✅ Every 5 minutes (background thread)
- ✅ Application starts up

### **Manual Backup**
```bash
# Trigger manual backup
curl -X POST "http://localhost:8108/api/backup/perform" \
  -H "X-API-Key: YOUR_API_KEY"

# List backup files
curl -X GET "http://localhost:8108/api/backup/files" \
  -H "X-API-Key: YOUR_API_KEY"

# Get backup status
curl -X GET "http://localhost:8108/api/backup/status" \
  -H "X-API-Key: YOUR_API_KEY"
```

### **Testing**
```bash
# Run backup test
cd Main-website/backend
python test_backup.py
```

## 📊 Backup File Format

### **Collection Backup** (`collection_name_timestamp.json`)
```json
{
  "collection_name": "user_preferences",
  "backup_timestamp": "20241201_143022",
  "document_count": 5,
  "documents": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "user_id": "user123",
      "preferences": {...}
    }
  ]
}
```

### **Backup Summary** (`backup_summary_timestamp.json`)
```json
{
  "backup_timestamp": "20241201_143022",
  "backup_date": "2024-12-01T14:30:22.123456",
  "collections_backed_up": [
    {
      "name": "user_preferences",
      "document_count": 5
    }
  ],
  "total_documents": 25,
  "backup_directory": "/path/to/backup_data"
}
```

## 🔄 Integration Points

### **With MongoDB Configuration** (`mongod.conf`)
- ✅ **No Changes Required**: Works with existing MongoDB setup
- ✅ **Automatic Detection**: Detects all collections automatically
- ✅ **Connection Management**: Integrates with existing connection pool

### **With Database Operations**
- ✅ **Transparent**: No changes to existing code required
- ✅ **Non-blocking**: Backup operations don't slow down main operations
- ✅ **Error Handling**: Backup failures don't affect main operations

### **With API Endpoints**
- ✅ **Secure**: Requires API key authentication
- ✅ **RESTful**: Standard HTTP methods
- ✅ **Documented**: Available in FastAPI docs

## 🛡️ Security & Reliability

### **Security**
- ✅ **API Key Required**: All backup endpoints require authentication
- ✅ **File Permissions**: Backup files use secure permissions
- ✅ **No Sensitive Data**: Backup files don't contain credentials

### **Reliability**
- ✅ **Error Handling**: Graceful handling of backup failures
- ✅ **Retry Logic**: Automatic retry on connection issues
- ✅ **Logging**: Comprehensive logging for debugging
- ✅ **Non-blocking**: Backup operations don't block main operations

## 📈 Performance

### **Impact on Main Operations**
- ✅ **Minimal Overhead**: Backup operations are asynchronous
- ✅ **Background Processing**: No impact on user-facing operations
- ✅ **Efficient Storage**: JSON format is space-efficient
- ✅ **Incremental**: Only backs up changed collections

### **Storage Requirements**
- ✅ **Compressed**: JSON format is naturally compressed
- ✅ **Organized**: Files are organized by data type
- ✅ **Cleanup Available**: Optional cleanup of old backups

## 🔧 Configuration

### **Environment Variables**
```bash
# MongoDB connection (existing)
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=eye_tracking_db

# API key for backup endpoints
API_KEY=your_api_key_here
```

### **Backup Settings**
```python
# Auto-backup interval (5 minutes)
time.sleep(300)

# Backup directory structure
backup_data/
├── user_preferences/
├── data_center/
├── consent_data/
└── admin_data/
```

## 🚨 Troubleshooting

### **Common Issues**

1. **Backup Directory Not Created**
   ```bash
   # Check permissions
   ls -la backup_data/
   
   # Create manually if needed
   mkdir -p backup_data/{user_preferences,data_center,consent_data,admin_data}
   ```

2. **MongoDB Connection Issues**
   ```bash
   # Test MongoDB connection
   mongo --eval "db.runCommand('ping')"
   
   # Check environment variables
   echo $MONGODB_URL
   echo $MONGODB_DB_NAME
   ```

3. **API Key Issues**
   ```bash
   # Test API endpoint
   curl -X GET "http://localhost:8108/api/backup/status" \
     -H "X-API-Key: YOUR_API_KEY"
   ```

### **Logs**
```bash
# Check application logs
tail -f logs/app.log

# Check backup-specific logs
grep "backup" logs/app.log
```

## 📝 API Reference

### **Backup Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/backup/perform` | POST | Trigger manual backup |
| `/api/backup/files` | GET | List backup files |
| `/api/backup/restore` | POST | Restore from backup |
| `/api/backup/enable-auto` | POST | Enable auto-backup |
| `/api/backup/disable-auto` | POST | Disable auto-backup |
| `/api/backup/cleanup` | POST | Clean old backups |
| `/api/backup/status` | GET | Get backup status |

### **Response Format**
```json
{
  "success": true,
  "message": "Operation completed",
  "timestamp": "2024-12-01T14:30:22.123456",
  "data": {...}
}
```

## 🎯 Benefits

### **For Development**
- ✅ **Data Safety**: Never lose development data
- ✅ **Easy Testing**: Restore data for testing scenarios
- ✅ **Debugging**: Access to historical data states

### **For Production**
- ✅ **Disaster Recovery**: Quick data restoration
- ✅ **Compliance**: Data retention for regulatory requirements
- ✅ **Monitoring**: Track data changes over time

### **For Maintenance**
- ✅ **Zero Downtime**: Backup operations don't affect users
- ✅ **Easy Management**: Simple file-based backup system
- ✅ **Flexible**: Manual and automatic backup options

## 🔮 Future Enhancements

- 🔄 **Incremental Backups**: Only backup changed data
- 🔄 **Compression**: Compress backup files for storage efficiency
- 🔄 **Cloud Storage**: Upload backups to cloud storage
- 🔄 **Encryption**: Encrypt backup files for security
- 🔄 **Scheduling**: Configurable backup schedules
- 🔄 **Monitoring**: Backup health monitoring and alerts

---

**🎉 Your MongoDB data is now automatically backed up with no expiration!** 