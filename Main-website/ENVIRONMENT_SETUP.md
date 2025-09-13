# Environment Setup for Process Files Integration

## Required Environment Variables

### Frontend (.env.frontend)
```bash
# Backend API URL
NEXT_PUBLIC_API_URL=https://172.18.1.107
AUTH_SERVICE_URL=http://backend_auth_service:8108

# Image Service URL (runs on auth service)
IMAGE_SERVICE_URL=http://backend_auth_service:8010

# API Key for backend services
NEXT_PUBLIC_API_KEY=A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV
BACKEND_API_KEY=A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV

# WebSocket URL
NEXT_PUBLIC_WS_URL=wss://172.18.1.107/ws
```

### Backend (.env.backend)
```bash
# API Key
API_KEY=A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV

# MongoDB settings
MONGODB_URL=mongodb://mongodb:27017
MONGODB_DB_NAME=eye_tracking

# Admin settings
ADMIN_USERNAME=admin
ADMIN_PASSWORD=1234
```

## Integration Flow

1. **Frontend Process Files Button** → `processFiles()` in `processApi.js` (with enhanceFace toggle)
2. **processApi.js** → `/api/for-process-folder/aprocess-file/[userId]` endpoint
3. **[userId].js API** → `AUTH_SERVICE_URL/api/queue-processing` (auth service)
4. **auth service app.py** → Proxies to image processing with userId and enhanceFace support
5. **process_images.py** → Processes images with user-specific paths
6. **Enhanced files saved to** → `/backend/auth_service/resource_security/public/enhance/{userId}/` when enhanceFace=true
7. **Complete files saved to** → `/backend/auth_service/resource_security/public/complete/{userId}/` when enhanceFace=false

## File Structure Changes

- Created: `aprocess-file/[userId].js` - Dynamic route for user-specific processing
- Created: `routes/process_set/enhance.py` - New enhance functionality routes
- Updated: `processApi.js` - Added `processFiles()` function with enhanceFace toggle
- Updated: `process_set/index.js` - Uses centralized `processFiles()` function
- Updated: `backend/image_service/routes/process_images.py` - Added userId and enhanceFace parameter support
- Updated: `backend/image_service/app.py` - Updated request model and function calls
- Updated: `backend/auth_service/app.py` - Added enhance router and enhanced queue-processing endpoint

## API Endpoints

### New Endpoint
- `POST /api/for-process-folder/aprocess-file/[userId]`
  - Processes files for a specific user
  - Calls the FastAPI image service
  - Returns streaming results

### Updated Backend Endpoints
- `POST /api/queue-processing` (auth service)
  - Accepts `user_id`, `set_numbers`, and `enhanceFace`
  - Proxies to image processing service
  - Returns batch processing results

- `POST /api/enhance/process` (auth service)
  - Accepts `user_id`, `set_numbers`, and `enhanceFace`
  - Handles enhance face toggle functionality
  - Returns processing results with directory information

- `GET /api/enhance/status/{user_id}` (auth service)
  - Returns status of enhance and complete files for a user
  - Shows file counts in both directories
