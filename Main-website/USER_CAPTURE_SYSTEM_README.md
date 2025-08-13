# User-Specific Capture System

## Overview
This system has been modified to save capture files in user-specific folders within the `resource_security/public/captures/` directory. Each user gets their own folder named with their user ID, ensuring data isolation and organization.

## File Structure

### New Path Structure
```
Main-website/backend/auth_service/resource_security/public/captures/
├── user_1234567890_abc123def/          # User-specific folder
│   ├── screen_001.jpg
│   ├── webcam_001.jpg
│   ├── parameter_001.csv
│   ├── screen_002.jpg
│   ├── webcam_002.jpg
│   └── parameter_002.csv
├── user_9876543210_xyz789ghi/          # Another user's folder
│   ├── screen_001.jpg
│   ├── webcam_001.jpg
│   └── parameter_001.csv
└── eye_tracking_captures/              # Legacy folder (still exists)
    └── ... (old captures)
```

## Components

### 1. Backend Route (`routes/user_captures.py`)
- **POST** `/api/user-captures/save/{user_id}` - Save capture files for a specific user
- **GET** `/api/user-captures/status/{user_id}` - Get capture status for a user
- **DELETE** `/api/user-captures/clear/{user_id}` - Clear all captures for a user

### 2. Frontend Helper (`Helper/user_savefile.js`)
- `captureImagesAtUserPoint()` - Main capture function with user-specific storage
- `saveImageToUserServer()` - Save images to user folder
- `saveCSVToUserServer()` - Save CSV data to user folder
- `getUserCaptureStatus()` - Get user's capture status
- `clearUserCaptures()` - Clear user's captures
- Uses `getOrCreateUserId()` from `consentManager.js` for user ID management

### 3. Next.js API Routes
- `/api/user-captures/save/[userId].js` - Proxy to backend save endpoint
- `/api/user-captures/status/[userId].js` - Proxy to backend status endpoint
- `/api/user-captures/clear/[userId].js` - Proxy to backend clear endpoint

### 4. Updated Components
- `countSave.jsx` - Now uses user-specific capture functions

## User ID Generation

The system automatically generates user IDs if none exist:

1. **First Priority**: Uses existing user ID from state manager
2. **Fallback**: Generates a unique ID using timestamp and random string
   - Format: `user_{timestamp}_{randomString}`
   - Example: `user_1691947200000_abc123def`

## API Usage

### Save Capture
```javascript
const result = await captureImagesAtUserPoint({
  point: { x: 100, y: 200 },
  captureCount: 1,
  canvasRef: canvasRef,
  setCaptureCount: setCounter,
  showCapturePreview: showPreview
});
```

### Get Status
```javascript
const status = await getUserCaptureStatus();
// Returns: { user_id, total_captures, last_capture, directory_exists }
```

### Clear Captures
```javascript
const result = await clearUserCaptures();
// Removes all files and folder for the current user
```

## File Naming Convention

Files are automatically numbered within each user's folder:
- `screen_001.jpg`, `screen_002.jpg`, etc.
- `webcam_001.jpg`, `webcam_002.jpg`, etc.
- `parameter_001.csv`, `parameter_002.csv`, etc.

## Environment Variables

### Backend
- `BACKEND_API_KEY` - API key for authentication

### Frontend
- `NEXT_PUBLIC_API_KEY` - API key for frontend requests
- `BACKEND_URL` - Backend service URL (default: http://localhost:8108)

## Migration from Old System

The old system still exists in `eye_tracking_captures/` folder. New captures will be saved in user-specific folders, while old captures remain accessible.

## Security Features

1. **User Isolation**: Each user's data is stored in separate folders
2. **API Key Authentication**: All endpoints require valid API keys
3. **Input Validation**: All inputs are validated before processing
4. **Error Handling**: Comprehensive error handling and logging

## Benefits

1. **Data Organization**: Each user's captures are clearly separated
2. **Scalability**: Easy to manage and backup individual user data
3. **Privacy**: User data is isolated from other users
4. **Maintenance**: Easy to clear or manage individual user data
5. **Backup**: Can backup individual user folders independently

## Troubleshooting

### Common Issues

1. **User ID Not Found**: System will generate a new user ID automatically
2. **Permission Errors**: Ensure the captures directory has write permissions
3. **API Key Issues**: Verify environment variables are set correctly
4. **Backend Connection**: Check if backend service is running on correct port

### Logs

Check the following logs for debugging:
- Backend: `auth_service` logs
- Frontend: Browser console logs
- API: Next.js API route logs
