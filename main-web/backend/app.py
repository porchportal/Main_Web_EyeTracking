# app.py - Main FastAPI entry point with added consent routes
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
import logging
from typing import Optional
import asyncio
import json
from datetime import datetime

# Import configuration
from config.settings import settings

# Import database connection
from db.mongodb import db

# Import routers
from routes import preferences
from routes import processing
from routes import files
from routes import preview
from routes.data_center_routes import router as data_center_router
from routes.admin_updates import router as admin_updates_router
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

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API for face tracking and user preferences management",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS to allow requests from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
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
    """Initialize connections and resources on startup"""
    try:
        # Try to connect to MongoDB, but continue even if it fails
        mongodb_connected = await db.connect()
        
        if mongodb_connected:
            # Initialize collections and indexes only if MongoDB is connected
            try:
                from services.preferences import PreferencesService
                await PreferencesService.initialize_collection()
                logger.info("MongoDB collections initialized successfully")
            except Exception as e:
                logger.error(f"Error initializing MongoDB collections: {e}")
        else:
            logger.warning("Skipping MongoDB collection initialization due to connection failure")
        
        logger.info("Application startup completed")
    except Exception as e:
        logger.error(f"Error during application startup: {e}")
        # Don't raise the error - allow the application to start anyway
        logger.info("Application will continue startup despite errors")
@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    try:
        # Close MongoDB connection
        await db.close()
        
        logger.info("Application shutdown completed successfully")
    except Exception as e:
        logger.error(f"Error during application shutdown: {e}")

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
    """
    Health check endpoint that verifies the service is running correctly
    and checks critical dependencies.
    """
    try:
        # Check if data center service is initialized
        data_center_status = "ok"
        try:
            # Try to get a value to verify data center is working
            test_value = data_center_service.get_value("test_key")
            if test_value is None:
                data_center_status = "initialized"
        except Exception as e:
            data_center_status = f"error: {str(e)}"

        # Check WebSocket connections
        ws_status = "ok"
        try:
            active_ws_count = len(active_connections)
            ws_status = f"ok ({active_ws_count} active connections)"
        except Exception as e:
            ws_status = f"error: {str(e)}"

        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "components": {
                "api": "ok",
                "data_center": data_center_status,
                "websocket": ws_status
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

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

app.include_router(data_center_router)
app.include_router(admin_updates_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)