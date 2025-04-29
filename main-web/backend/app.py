# app.py - Main FastAPI entry point with added consent routes
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
import logging
from typing import Optional, Dict, Any
import asyncio
import json
from datetime import datetime
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path

# Import configuration
from config.settings import settings

# Import database connection
from db.mongodb import db, MongoDB

# Import routers
from routes import preferences
from routes import processing
from routes import files
from routes import preview
from routes.data_center_routes import router as data_center_router
from routes.admin_updates import router as admin_updates_router
from routes.consent import router as consent_router
# from routes import consent 

# Import response models
from model_preference.response import HealthResponse

# Import auth
from auth import verify_api_key

# Set up logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Load environment variables
env_path = Path(__file__).parent.parent / '.env.backend'
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
    description="API for face tracking and user preferences management",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods including OPTIONS
    allow_headers=["*"],  # Allows all headers including X-API-Key
    expose_headers=["*"]
)

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
# Update the startup_event function in app.py

@app.on_event("startup")
async def startup_event():
    """Initialize MongoDB connection on startup."""
    if not await MongoDB.connect():
        logger.error("Failed to connect to MongoDB on startup")

@app.on_event("shutdown")
async def shutdown_event():
    """Close MongoDB connection on shutdown."""
    await MongoDB.close()

# Include the preferences router with API key authentication
app.include_router(
    preferences.router,
    dependencies=[Depends(verify_api_key)]
)
# Include the processing router with API key authentication
app.include_router(
    processing.router,
    dependencies=[Depends(verify_api_key)]
)

# Include the files router with API key authentication
app.include_router(
    files.router,
    dependencies=[Depends(verify_api_key)]
)

# Include the preview router with API key authentication
app.include_router(
    preview.router,
    dependencies=[Depends(verify_api_key)]
)

# Include the consent router with API key authentication
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
                # Receive video frame data
                data = await websocket.receive_bytes()
                
                # Process the frame (you can add your processing logic here)
                # For now, we'll just send back a dummy response
                response = {
                    "status": "processed",
                    "message": "Frame received and processed"
                }
                
                # Send the response back to the client
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
    """
    Endpoint for frontend to check if backend is available
    """
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
        user_data = await db.users.find_one({"user_id": user_id})
        
        if not user_data:
            # Return empty preferences instead of 404
            return {
                "user_id": user_id,
                "username": None,
                "sex": None,
                "age": None,
                "preferences": {}
            }
        
        # Remove MongoDB _id field from response
        user_data.pop("_id", None)
        return user_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user preferences: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/user-preferences/{user_id}")
@app.put("/api/user-preferences/{user_id}")
async def update_user_preferences(user_id: str, preferences: UserPreferences):
    """Update user preferences in MongoDB."""
    try:
        if not await MongoDB.ensure_connected():
            raise HTTPException(status_code=503, detail="Database connection unavailable")
        
        db = MongoDB.get_db()
        
        # Convert Pydantic model to dict and include user_id
        update_data = preferences.dict(exclude_unset=True)
        update_data["user_id"] = user_id
        
        # Ensure preferences field exists
        if "preferences" not in update_data:
            update_data["preferences"] = {}
        
        result = await db.users.update_one(
            {"user_id": user_id},
            {"$set": update_data},
            upsert=True
        )
        
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
        
        # Get expected credentials from environment
        expected_username = os.getenv("ADMIN_USERNAME")
        expected_password = os.getenv("ADMIN_PASSWORD")
        
        logger.info(f"Expected credentials - Username: {expected_username}")
        logger.info(f"Received credentials - Username: {login.username}, Password: {login.password}")
        
        # Check if environment variables are set
        if not expected_username or not expected_password:
            logger.error("Admin credentials not found in environment variables")
            raise HTTPException(
                status_code=500,
                detail="Server configuration error"
            )
        
        # Check credentials
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)