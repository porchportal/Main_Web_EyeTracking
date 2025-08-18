# User-Specific Capture System

This document describes the user-specific capture system that saves eye tracking data to individual user folders in the backend.

## Overview

The system has been modified to save capture files (screen images, webcam images, and parameter data) to user-specific folders in the backend, organized by user ID. This ensures data privacy and proper organization of capture files.

## Architecture

### Frontend Components

1. **user_savefile.js** - User-specific capture functions
   - `captureImagesAtUserPoint()` - Main capture function
   - `saveImageToUserServer()` - Save images to user folder
   - `saveCSVToUserServer()` - Save CSV data to user folder
   - `getUserCaptureStatus()` - Get user capture status
   - `clearUserCaptures()` - Clear all user captures

2. **countSave.jsx** - Updated to use user-specific capture
   - `captureImages()` - Uses user-specific capture
   - `calibrationCapture()` - Uses user-specific capture
   - `captureAndPreviewProcess()` - Uses user-specific capture

3. **cameraAccess.js** - Enhanced camera handling
   - Exposes video element globally for capture functions
   - Proper video stream management
   - WebSocket connection for real-time processing

### Backend API

1. **user_captures.py** - User capture management
   - `/api/user-captures/save/{user_id}` - Save capture files
   - `/api/user-captures/status/{user_id}` - Get capture status
   - `/api/user-captures/clear/{user_id}` - Clear user captures

2. **Frontend API Proxies**
   - `/api/user-captures/save/[userId].js` - Proxy to backend
   - `/api/user-captures/status/[userId].js` - Proxy to backend
   - `/api/user-captures/clear/[userId].js` - Proxy to backend

## File Structure

```
backend/auth_service/resource_security/public/captures/
├── user_1234567890/
│   ├── screen_001.jpg
│   ├── webcam_001.jpg
│   ├── parameter_001.csv
│   ├── screen_002.jpg
│   ├── webcam_002.jpg
│   └── parameter_002.csv
├── user_9876543210/
│   ├── screen_001.jpg
│   ├── webcam_001.jpg
│   └── parameter_001.csv
└── ...
```

## How It Works

### 1. User ID Generation
- Uses `getOrCreateUserId()` from consentManager
- Generates unique user ID if none exists
- Ensures consistent user identification

### 2. Capture Process
1. User initiates capture (random dot or calibration)
2. System generates unique capture group ID
3. Captures screen image from canvas
4. Captures webcam image with proper orientation
5. Creates parameter CSV with metadata
6. Saves all files with same group ID for consistent numbering

### 3. File Saving
- Files are saved to user-specific folders
- Consistent numbering within each capture group
- Proper file naming: `{type}_{number}.{extension}`
- Backend handles file organization and numbering

### 4. Camera Integration
- `cameraAccess.js` exposes video element globally
- `countSave.jsx` uses existing video stream
- Proper image orientation handling (removes mirroring)
- High-resolution capture with preview generation

## Configuration

### Environment Variables

**Frontend (.env.local or next.config.mjs):**
```bash
BACKEND_URL=http://localhost:8108
NEXT_PUBLIC_API_KEY=A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV
NEXT_PUBLIC_WS_URL=ws://localhost:8108
```

**Backend (.env.backend):**
```bash
API_KEY=A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV
```

### Port Configuration

- **Auth Service**: Port 8108 (main backend)
- **Image Service**: Port 8010 (image processing)
- **Video Service**: Port 8011 (video processing)
- **Frontend**: Port 3010 (Next.js app)

## Usage

### Starting the System

1. **Start Backend Services:**
```bash
cd Main-website
docker-compose up -d
```

2. **Start Frontend (Development):**
```bash
cd Main-website/frontend
npm run dev
```

### Using the Capture System

1. **Open the application** at `http://localhost:3010`
2. **Navigate to** the customized dataset collection page
3. **Start camera** using the camera access component
4. **Begin capture** - files will be saved to user-specific folders
5. **Check captures** in the backend folder structure

### API Endpoints

**Save Capture:**
```bash
POST /api/user-captures/save/{user_id}
Content-Type: application/json
X-API-Key: A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV

{
  "imageData": "data:image/jpeg;base64,...",
  "filename": "screen_001.jpg",
  "type": "screen",
  "captureGroup": "capture-1234567890-user123"
}
```

**Get Status:**
```bash
GET /api/user-captures/status/{user_id}
X-API-Key: A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV
```

**Clear Captures:**
```bash
DELETE /api/user-captures/clear/{user_id}
X-API-Key: A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV
```

## Features

### ✅ Implemented
- User-specific folder organization
- Consistent file numbering within capture groups
- Proper camera image capture with orientation correction
- High-resolution image capture
- Preview generation for captured images
- API key authentication
- Error handling and logging
- WebSocket integration for real-time processing

### 🔄 Enhanced
- Camera access component with global video element exposure
- Countdown and capture process integration
- Calibration and random dot capture support
- File grouping for consistent numbering
- Backend API integration

## Troubleshooting

### Common Issues

1. **Camera not working:**
   - Check if camera permissions are granted
   - Ensure HTTPS or localhost for camera access
   - Verify camera is not in use by other applications

2. **Files not saving:**
   - Check backend service is running on port 8108
   - Verify API key is correct
   - Check user ID generation

3. **WebSocket connection issues:**
   - Ensure backend is running
   - Check WebSocket URL configuration
   - Verify CORS settings

### Debug Information

The system includes comprehensive logging:
- Console logs for capture process
- Backend logs for file operations
- Error handling with detailed messages
- API response logging

## Security

- API key authentication for all endpoints
- User-specific data isolation
- Secure file storage in backend
- CORS configuration for cross-origin requests
- Input validation and sanitization

## Performance

- Efficient image capture and processing
- Optimized file saving with grouping
- Minimal memory usage with proper cleanup
- Fast API responses with proper error handling
