# app.py - Main FastAPI entry point with added consent routes
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from fastapi.responses import StreamingResponse
import logging
from typing import Optional, Dict, Any, List
import asyncio
import json
from datetime import datetime
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
import threading

# Import configuration
from config.settings import settings

# Import database connection
from db.mongodb import db, MongoDB
from db.data_center import DataCenter

# Import routers
from routes import preferences
from routes import processing
from routes import files
from routes import preview
from routes.data_center_routes import router as data_center_router
from routes.admin_updates import router as admin_updates_router
from routes.consent import router as consent_router

# Import response models
from model_preference.response import HealthResponse

# Import auth
from auth import verify_api_key

# Import image processing
from process_images import process_images

# Set up logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
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
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
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

# API Key authentication
API_KEY = settings.API_KEY
api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key"
        )
    return api_key

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
                    "image_background": None
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

# Admin authentication route
class AdminLogin(BaseModel):
    username: str
    password: str

@app.post("/api/admin/auth")
async def admin_auth(login: AdminLogin):
    try:
        logger.info(f"Received login attempt for username: {login.username}")
        
        expected_username = settings.ADMIN_USERNAME
        expected_password = settings.ADMIN_PASSWORD
        
        if not expected_username or not expected_password:
            logger.error("Admin credentials not found in environment variables")
            raise HTTPException(
                status_code=500,
                detail="Server configuration error"
            )
        
        if login.username == expected_username and login.password == expected_password:
            logger.info("Login successful")
            return {"message": "Authentication successful"}
        else:
            logger.warning("Invalid credentials")
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during authentication: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class ProcessingRequest(BaseModel):
    user_id: str
    set_numbers: List[int]

@app.post("/api/queue-processing")
async def queue_processing(request: ProcessingRequest):
    """Process images for the given user and set numbers"""
    try:
        logger.info(f"Received processing request for user {request.user_id}")
        
        # Start processing the images
        async def process_generator():
            async for update in process_images(request.set_numbers):
                yield json.dumps(update) + "\n"
        
        return StreamingResponse(
            process_generator(),
            media_type="application/x-ndjson"
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)