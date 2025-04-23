# app.py - Main FastAPI entry point with added consent routes
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
import logging
from typing import Optional
import asyncio
import json

# Import configuration
from config.settings import settings

# Import database connection
from db.mongodb import db

# Import routers
from routes import preferences
from routes import processing
from routes import files
from routes import preview
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

# Include the consent router with API key authentication
# app.include_router(
#     consent.router,
#     dependencies=[Depends(verify_api_key)]
# )

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

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint to verify the service is running correctly
    """
    # Check MongoDB connection status
    db_status = db.connection_status()
    
    # If database is not connected, try a quick reconnection attempt
    if not db_status["connected"]:
        try:
            await db.ensure_connected()
            # Get updated status after reconnection attempt
            db_status = db.connection_status()
        except Exception as e:
            logger.error(f"Error during database reconnection attempt: {e}")
    
    return HealthResponse(
        success=True,
        status="ok",
        version=settings.APP_VERSION,
        database_connected=db_status["connected"],
        components={
            "api": "ok",
            "database": "ok" if db_status["connected"] else f"disconnected: {db_status['error']}"
        }
    )
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)