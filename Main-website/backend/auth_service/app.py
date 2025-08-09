# auth_service/app.py - Main entry point for auth service with integrated functionality
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from fastapi.responses import StreamingResponse, JSONResponse
import logging
from typing import Optional, Dict, Any, List
import asyncio
import json
from datetime import datetime, timedelta
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
import threading
import sys

# Add parent directory to path to import the main app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import database connection
from db.mongodb import db, MongoDB
from db.data_centralization import DataCenter

# Import routers
from routes import preferences
from routes import processing
from routes import files
from routes import preview
from routes.data_center_routes import router as data_center_router
from routes.admin_updates import router as admin_updates_router
from routes.consent import router as consent_router
from routes.backup import router as backup_router

# Import response models
from model_preference.response import HealthResponse

# Import auth
from auth import verify_api_key

# Import image processing - will make HTTP calls to image service
import httpx

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Load environment variables
env_path = Path(__file__).parent / '.env.backend'
logger.info(f"Loading environment variables from: {env_path}")
load_dotenv(dotenv_path=env_path)

# Log environment variables (without sensitive data)
logger.info("Environment variables loaded:")
logger.info(f"ADMIN_USERNAME is set: {bool(os.getenv('ADMIN_USERNAME'))}")
logger.info(f"ADMIN_PASSWORD is set: {bool(os.getenv('ADMIN_PASSWORD'))}")

# Create FastAPI app
app = FastAPI(
    title="Eye Tracking API",
    version="1.0.0",
    description="API for eye tracking and user preferences management",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Add specific CORS middleware for user preferences
@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    response = await call_next(request)
    origin = request.headers.get("origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-API-Key"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Max-Age"] = "3600"
    return response

# Event handlers for startup and shutdown
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    # Connect to MongoDB
    if not await MongoDB.connect():
        logger.error("Failed to connect to MongoDB on startup")

@app.on_event("shutdown")
async def shutdown_event():
    """Close connections on shutdown."""
    await MongoDB.close()
    logger.info("Closed all connections")

# Include routers with API key authentication
app.include_router(
    preferences.router,
    dependencies=[Depends(verify_api_key)]
)
app.include_router(
    processing.router,
    dependencies=[Depends(verify_api_key)]
)
app.include_router(
    files.router,
    dependencies=[Depends(verify_api_key)]
)
app.include_router(
    preview.router,
    dependencies=[Depends(verify_api_key)]
)
app.include_router(
    consent_router,
    dependencies=[Depends(verify_api_key)]
)

# Store active WebSocket connections
active_connections = set()

@app.websocket("/ws/video")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    logger.info(f"New WebSocket connection established. Total connections: {len(active_connections)}")
    
    try:
        while True:
            try:
                data = await websocket.receive_bytes()
                response = {
                    "status": "processed",
                    "message": "Frame received and processed"
                }
                await websocket.send_json(response)
            except WebSocketDisconnect:
                logger.info("Client disconnected")
                break
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {str(e)}")
                await websocket.send_json({
                    "status": "error",
                    "message": f"Error processing frame: {str(e)}"
                })
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        active_connections.remove(websocket)
        logger.info(f"WebSocket connection closed. Remaining connections: {len(active_connections)}")
        try:
            await websocket.close()
        except:
            pass

@app.get("/health")
async def health_check():
    """Health check endpoint to verify MongoDB connection."""
    try:
        if await MongoDB.ensure_connected():
            return {"status": "healthy", "mongodb": "connected"}
        return {"status": "degraded", "mongodb": "disconnected"}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {"status": "unhealthy", "mongodb": "error"}

@app.get("/api/check-backend-connection")
async def check_backend_connection():
    """Endpoint for frontend to check if backend is available"""
    return {"connected": True, "status": "ok"}

@app.get("/test-auth", dependencies=[Depends(verify_api_key)])
async def test_auth():
    """Test endpoint to verify API key authentication"""
    return {"message": "Authentication successful!"}

@app.get("/status")
async def check_status():
    return {
        "status": "ok",
        "active_connections": len(active_connections)
    }

class UserPreferences(BaseModel):
    username: Optional[str] = None
    sex: Optional[str] = None
    age: Optional[int] = None
    preferences: Optional[Dict[str, Any]] = None

@app.get("/api/user-preferences/{user_id}")
async def get_user_preferences(user_id: str):
    """Get user preferences from MongoDB."""
    try:
        if not await MongoDB.ensure_connected():
            raise HTTPException(status_code=503, detail="Database connection unavailable")
        
        db = MongoDB.get_db()
        if db is None:
            raise HTTPException(status_code=503, detail="Database connection unavailable")
            
        # Get user preferences from user_preferences collection
        user_data = await db.user_preferences.find_one({"user_id": user_id})
        
        if not user_data:
            return {
                "data": {
                    "user_id": user_id,
                    "username": None,
                    "sex": None,
                    "age": None,
                    "image_background": None,
                    "cookie": None
                }
            }
        
        # Remove MongoDB _id field
        user_data.pop("_id", None)
        
        return {
            "data": user_data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user preferences: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Add OPTIONS handler for user preferences
@app.options("/api/user-preferences/{user_id}")
async def options_user_preferences():
    return {"status": "ok"}

class UserProfileUpdate(BaseModel):
    """Model for updating user profile information"""
    username: Optional[str] = None
    sex: Optional[str] = None
    age: Optional[str] = None
    cookie: Optional[bool] = None

@app.put("/api/user-preferences/{user_id}")
async def update_user_preferences(user_id: str, preferences: UserProfileUpdate):
    """Update user preferences in MongoDB."""
    try:
        if not await MongoDB.ensure_connected():
            raise HTTPException(status_code=503, detail="Database connection unavailable")
        
        db = MongoDB.get_db()
        
        # 1. Save to user_preferences collection
        collection = db['user_preferences']
        update_data = {
            "user_id": user_id,
            "username": preferences.username,
            "sex": preferences.sex,
            "age": preferences.age,
            "cookie": preferences.cookie,
            "updated_at": datetime.utcnow()
        }
        
        result = await collection.update_one(
            {"user_id": user_id},
            {"$set": update_data},
            upsert=True
        )
        
        # 2. Save to data_center collection with default values
        settings_data = {
            "times": 1,
            "delay": 3,
            "image_path": "/asfgrebvxcv",
            "updateImage": "image.jpg",
            "set_timeRandomImage": 1,
            "every_set": 2,
            "zoom_percentage": 100,
            "position_zoom": [3, 4],
            "state_isProcessOn": True,
            "currentlyPage": "str",
            "freeState": 3
        }
        
        try:
            # Initialize DataCenter if needed
            await DataCenter.initialize()
            
            # Save settings to data_center
            data_center_result = await DataCenter.update_value(
                f"settings_{user_id}",
                settings_data,
                "json"
            )
            
            logger.info(f"Updated data_center settings for user {user_id}: {data_center_result}")
        except Exception as e:
            logger.error(f"Failed to update data_center settings for user {user_id}: {str(e)}")
            # Don't raise the error, just log it since the user preferences were saved successfully
        
        if result.modified_count == 0 and not result.upserted_id:
            logger.warning(f"No changes made to user preferences for user_id: {user_id}")
        
        return {"status": "success", "message": "Preferences updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user preferences: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

app.include_router(data_center_router)
app.include_router(admin_updates_router)
app.include_router(backup_router)

# Admin authentication route
class AdminLogin(BaseModel):
    username: str
    password: str

# Admin session storage (in production, use Redis or database)
admin_sessions = {}

@app.post("/api/admin/auth")
async def admin_auth(login: AdminLogin, request: Request):
    try:
        logger.info(f"Received login attempt for username: {login.username}")
        
        expected_username = os.getenv("ADMIN_USERNAME")
        expected_password = os.getenv("ADMIN_PASSWORD")
        
        if not expected_username or not expected_password:
            logger.error("Admin credentials not found in environment variables")
            raise HTTPException(
                status_code=500,
                detail="Server configuration error"
            )
        
        if login.username == expected_username and login.password == expected_password:
            logger.info("Login successful")
            
            # Generate session token
            import secrets
            session_token = secrets.token_urlsafe(32)
            
            # Store session (in production, use Redis or database)
            admin_sessions[session_token] = {
                "username": login.username,
                "created_at": datetime.now().isoformat(),
                "expires_at": (datetime.now() + timedelta(hours=1)).isoformat()
            }
            
            # Create response with session data
            response_data = {
                "message": "Authentication successful",
                "session": session_token
            }
            
            # Create response and set httpOnly cookie
            response = JSONResponse(content=response_data)
            response.set_cookie(
                key="admin_session",
                value=session_token,
                httponly=True,
                secure=request.url.scheme == "https",
                samesite="strict",
                max_age=3600  # 1 hour
            )
            
            return response
        else:
            logger.warning("Invalid credentials")
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during authentication: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/verify-session")
async def verify_admin_session(session_data: dict):
    try:
        session_token = session_data.get("session")
        
        if not session_token:
            raise HTTPException(status_code=401, detail="No session token provided")
        
        session = admin_sessions.get(session_token)
        
        if not session:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        # Check if session is expired
        from datetime import datetime
        expires_at = datetime.fromisoformat(session["expires_at"])
        
        if datetime.now() > expires_at:
            # Remove expired session
            admin_sessions.pop(session_token, None)
            raise HTTPException(status_code=401, detail="Session expired")
        
        return {"message": "Session valid", "username": session["username"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/logout")
async def admin_logout(session_data: dict, request: Request):
    try:
        session_token = session_data.get("session")
        
        if session_token:
            # Remove session
            admin_sessions.pop(session_token, None)
        
        # Create response and clear the cookie
        response = JSONResponse(content={"message": "Logged out successfully"})
        response.delete_cookie(
            key="admin_session",
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="strict"
        )
        
        return response
    except Exception as e:
        logger.error(f"Error during logout: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class ProcessingRequest(BaseModel):
    user_id: str
    set_numbers: List[int]

@app.post("/api/queue-processing")
async def queue_processing(request: ProcessingRequest):
    """Process images for the given user and set numbers"""
    try:
        logger.info(f"Received processing request for user {request.user_id}")
        
        # Make HTTP call to image service
        image_service_url = os.getenv("IMAGE_SERVICE_URL", "http://image_service:8010")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{image_service_url}/process-images",
                json={"set_numbers": request.set_numbers},
                timeout=300.0  # 5 minutes timeout
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Image service error: {response.text}"
                )
            
            # Return the response from image service
            return response.json()
        
    except httpx.RequestError as e:
        logger.error(f"Error connecting to image service: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Image service unavailable"
        )
    except Exception as e:
        logger.error(f"Error in processing: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/api/processing-status")
async def get_processing_status(user_id: str):
    """Get the processing status for a user"""
    try:
        # For now, we'll return a simple status since we're not tracking it
        return {
            "status": "processing",
            "message": "Processing in progress",
            "progress": 0,
            "user_id": user_id
        }
    except Exception as e:
        logger.error(f"Error getting processing status: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

# Update the data center endpoints
@app.get("/api/data-center/settings/{user_id}")
async def get_user_settings(user_id: str):
    """Get user settings from data center"""
    try:
        if not await DataCenter.initialize():
            raise HTTPException(status_code=503, detail="Data center not initialized")
        
        settings = await DataCenter.get_value(f"settings_{user_id}")
        if not settings:
            # Return default settings if none exist
            settings = {
                "times": 1,
                "delay": 3,
                "image_path": "/asfgrebvxcv",
                "updateImage": "image.jpg",
                "set_timeRandomImage": 1,
                "every_set": 2,
                "zoom_percentage": 100,
                "position_zoom": [3, 4],
                "state_isProcessOn": True,
                "currentlyPage": "str",
                "freeState": 3
            }
        
        return {"data": settings}
    except Exception as e:
        logger.error(f"Error getting user settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class SettingsUpdate(BaseModel):
    times: Optional[int] = None
    delay: Optional[int] = None
    image_path: Optional[str] = None
    updateImage: Optional[str] = None
    set_timeRandomImage: Optional[int] = None
    every_set: Optional[int] = None
    zoom_percentage: Optional[int] = None
    position_zoom: Optional[List[int]] = None
    state_isProcessOn: Optional[bool] = None
    currentlyPage: Optional[str] = None
    freeState: Optional[int] = None

@app.post("/api/data-center/settings/{user_id}")
async def update_user_settings(user_id: str, settings: SettingsUpdate):
    """Update user settings in data center"""
    try:
        if not await DataCenter.initialize():
            raise HTTPException(status_code=503, detail="Data center not initialized")
        
        # Get current settings
        current_settings = await DataCenter.get_value(f"settings_{user_id}") or {}
        
        # Update only the provided fields
        updated_settings = {**current_settings, **settings.dict(exclude_unset=True)}
        
        result = await DataCenter.update_value(
            f"settings_{user_id}",
            updated_settings,
            "json"
        )
        
        return {"status": "success", "message": "Settings updated successfully", "data": updated_settings}
    except Exception as e:
        logger.error(f"Error updating user settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class ImageUpdate(BaseModel):
    image: str

@app.post("/api/data-center/image")
async def update_user_image(user_id: str, image_update: ImageUpdate):
    """Update user image in data center"""
    try:
        if not await DataCenter.initialize():
            raise HTTPException(status_code=503, detail="Data center not initialized")
        
        result = await DataCenter.update_value(
            f"image_{user_id}",
            image_update.image,
            "image"
        )
        
        return {"status": "success", "message": "Image updated successfully"}
    except Exception as e:
        logger.error(f"Error updating user image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class ZoomUpdate(BaseModel):
    zoom_level: int

@app.post("/api/data-center/zoom")
async def update_user_zoom(user_id: str, zoom_update: ZoomUpdate):
    """Update user zoom level in data center"""
    try:
        if not await DataCenter.initialize():
            raise HTTPException(status_code=503, detail="Data center not initialized")
        
        result = await DataCenter.update_value(
            f"zoom_{user_id}",
            zoom_update.zoom_level,
            "number"
        )
        
        return {"status": "success", "message": "Zoom level updated successfully"}
    except Exception as e:
        logger.error(f"Error updating user zoom level: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Add this model for admin update requests
class AdminUpdateRequest(BaseModel):
    userId: str
    type: str
    data: Optional[Dict[str, Any]] = None

@app.get("/api/admin/update")
async def get_admin_update(userId: str, type: str):
    """Get admin update data"""
    try:
        if not await DataCenter.initialize():
            raise HTTPException(status_code=503, detail="Data center not initialized")
        
        if type == "settings":
            # Get complete user data including settings and image&pdf_canva
            user_data = await DataCenter.get_user_complete_data(userId)
            
            # If no settings exist, provide default settings
            if not user_data["settings"]:
                user_data["settings"] = {
                    "times_set_calibrate": 1,
                    "run_every_of_random": 1,
                    "buttons_order": "",
                    "image_path": "/asfgrebvxcv",
                    "updateImage": "image.jpg",
                    "set_timeRandomImage": 1,
                    "every_set": 2,
                    "zoom_percentage": 100,
                    "position_zoom": [2],
                    "state_isProcessOn": True,
                    "currentlyPage": "str",
                    "freeState": 3
                }
            
            return {
                "status": "success", 
                "data": user_data["settings"],
                "image&pdf_canva": user_data["image&pdf_canva"]
            }
        else:
            raise HTTPException(status_code=400, detail="Invalid update type")
            
    except Exception as e:
        logger.error(f"Error in admin update: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/update")
async def admin_update(request: AdminUpdateRequest):
    """Handle admin updates"""
    try:
        if not await DataCenter.initialize():
            raise HTTPException(status_code=503, detail="Data center not initialized")
        
        # Ensure userId is a string, not an array
        user_id = request.userId[0] if isinstance(request.userId, list) else request.userId
        
        if request.type == "settings":
            # Get current settings first
            current_settings = await DataCenter.get_value(f"settings_{user_id}")
            
            # Prepare the new settings structure
            if current_settings:
                # Update existing settings with new data
                updated_settings = {**current_settings, **request.data}
            else:
                # Create new settings with default values
                updated_settings = {
                    "times_set_calibrate": 1,
                    "run_every_of_random": 1,
                    "buttons_order": "",
                    "image_path": request.data.get("image_path", "/asfgrebvxcv"),
                    "updateImage": request.data.get("updateImage", "image.jpg"),
                    "set_timeRandomImage": 1,
                    "every_set": 2,
                    "zoom_percentage": 100,
                    "position_zoom": [2],
                    "state_isProcessOn": True,
                    "currentlyPage": "str",
                    "freeState": 3,
                    **request.data  # Override with any provided data
                }
            
            # Extract image_pdf_canva data if present
            image_canva_data = None
            if "image_pdf_canva" in request.data:
                image_canva_data = request.data["image_pdf_canva"]
                # Remove from settings to avoid duplication
                updated_settings.pop("image_pdf_canva", None)
            
            # Use the new method to update both settings and image&pdf_canva
            result = await DataCenter.update_user_settings_with_images(
                user_id,
                updated_settings,
                image_canva_data
            )
            
            return {"status": "success", "message": "Settings updated successfully", "result": result}
        else:
            raise HTTPException(status_code=400, detail="Invalid update type")
            
    except Exception as e:
        logger.error(f"Error in admin update: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/data-center/delete/{user_id}")
async def delete_user_data_center(user_id: str):
    """Delete all user data from data center"""
    try:
        if not await DataCenter.initialize():
            raise HTTPException(status_code=503, detail="Data center not initialized")
        
        # Delete all keys related to this user
        keys_to_delete = [
            f"settings_{user_id}",
            f"image_{user_id}",
            f"zoom_{user_id}"
        ]
        
        for key in keys_to_delete:
            await DataCenter.delete_value(key)
        
        return {"status": "success", "message": "User data deleted from data center"}
    except Exception as e:
        logger.error(f"Error deleting user data from data center: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/user-preferences/{user_id}")
async def delete_user_preferences(user_id: str):
    """Delete user preferences from MongoDB"""
    try:
        if not await MongoDB.ensure_connected():
            raise HTTPException(status_code=503, detail="Database connection unavailable")
        
        db = MongoDB.get_db()
        if db is None:
            raise HTTPException(status_code=503, detail="Database connection unavailable")
        
        # Delete from user_preferences collection
        result = await db.user_preferences.delete_one({"user_id": user_id})
        
        if result.deleted_count == 0:
            logger.warning(f"No user preferences found for user_id: {user_id}")
        
        return {"status": "success", "message": "User preferences deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting user preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/consent/{user_id}")
async def delete_user_consent(user_id: str):
    """Delete user consent data and related data from all collections"""
    try:
        if not await MongoDB.ensure_connected():
            raise HTTPException(status_code=503, detail="Database connection unavailable")
        
        db = MongoDB.get_db()
        if db is None:
            raise HTTPException(status_code=503, detail="Database connection unavailable")
        
        # Delete from user_preferences collection
        await db.user_preferences.delete_one({"user_id": user_id})
        
        # Delete from consent collection if it exists
        if 'consent' in await db.list_collection_names():
            await db.consent.delete_one({"user_id": user_id})
        
        # Delete from data_center collection
        if await DataCenter.initialize():
            # Delete all keys related to this user
            keys_to_delete = [
                f"settings_{user_id}",
                f"image_{user_id}",
                f"zoom_{user_id}"
            ]
            
            for key in keys_to_delete:
                await DataCenter.delete_value(key)
        
        return {
            "success": True,
            "message": "User data deleted successfully",
            "data": {
                "user_id": user_id,
                "deleted_at": datetime.utcnow().isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Error deleting user data: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete user data: {str(e)}"
        )

@app.get("/consent/{user_id}")
async def get_user_consent(user_id: str):
    """Get user consent status by user ID"""
    try:
        if not await MongoDB.ensure_connected():
            raise HTTPException(status_code=503, detail="Database connection unavailable")
        
        db = MongoDB.get_db()
        if db is None:
            raise HTTPException(status_code=503, detail="Database connection unavailable")
        
        # Check if user exists in user_preferences
        user_data = await db.user_preferences.find_one({"user_id": user_id})
        
        if not user_data:
            # Return empty data with null consent status if user not found
            return {
                "success": True,
                "message": "No consent status found for user",
                "data": {
                    "user_id": user_id,
                    "consent_status": None,
                    "consent_updated_at": None
                }
            }
        
        # Return just the consent-related data
        return {
            "success": True,
            "data": {
                "user_id": user_id,
                "consent_status": user_data.get("consent_status"),
                "consent_updated_at": user_data.get("updated_at")
            }
        }
    except Exception as e:
        logger.error(f"Error retrieving consent for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve user consent: {str(e)}"
        )

@app.put("/consent/{user_id}")
async def update_user_consent(user_id: str, consent_data: dict):
    """Update user consent status"""
    try:
        if not await MongoDB.ensure_connected():
            raise HTTPException(status_code=503, detail="Database connection unavailable")
        
        db = MongoDB.get_db()
        if db is None:
            raise HTTPException(status_code=503, detail="Database connection unavailable")
        
        # Update user preferences with consent status
        update_data = {
            "user_id": user_id,
            "consent_status": consent_data.get("consent_status"),
            "updated_at": datetime.utcnow()
        }
        
        result = await db.user_preferences.update_one(
            {"user_id": user_id},
            {"$set": update_data},
            upsert=True
        )
        
        if result.modified_count == 0 and not result.upserted_id:
            logger.warning(f"No changes made to user consent for user_id: {user_id}")
        
        return {
            "success": True,
            "message": "Consent status updated successfully",
            "data": update_data
        }
    except Exception as e:
        logger.error(f"Error updating consent for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update user consent: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8108) 