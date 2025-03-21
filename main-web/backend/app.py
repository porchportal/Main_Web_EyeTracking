# backend/app.py
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
import cv2
import numpy as np
import io
import base64
import json
import os

# Import the face tracking class
from Main_model02.showframeVisualization import FrameShow_head_face

app = FastAPI()

# Configure CORS to allow requests from Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# API Key authentication
# A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV
# API_KEY = os.getenv("API_KEY", "A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV")  # Get from environment variable or use default
API_KEY = os.getenv("API_KEY", "A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV")
api_key_header = APIKeyHeader(name="X-API-Key")  # This should match the header name used by frontend

async def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key"
        )
    return api_key

# Initialize face tracker once at startup
face_tracker = FrameShow_head_face(
    model_path='Main_model02/face_landmarker.task',
    isVideo=False,
    isHeadposeOn=False,
    isFaceOn=True
)

# Configure visualization
face_tracker.set_labet_face_element(True)
face_tracker.set_IsShowBox(True)
face_tracker.set_IsShowHeadpose(True)

@app.post("/process-image", dependencies=[Depends(verify_api_key)])
async def process_image(file: UploadFile = File(...)):
    # Read the uploaded image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    
    if frame is None:
        return {"error": "Could not read image"}
    
    # Process the image with face tracker
    timestamp_ms = 0
    metrics, processed_frame = face_tracker.process_frame(
        frame,
        timestamp_ms,
        isVideo=False,
        isEnhanceFace=True
    )
    
    # Prepare response data
    response = {"success": False}
    
    if metrics is not None:
        # Extract face metrics
        pitch, yaw, roll = metrics.head_pose_angles
        
        # Convert processed image to base64 for sending to frontend
        _, buffer = cv2.imencode('.jpg', processed_frame)
        img_str = base64.b64encode(buffer).decode('utf-8')
        
        # Prepare response with metrics and image
        response = {
            "success": True,
            "metrics": {
                "head_pose": {
                    "pitch": round(pitch, 2),
                    "yaw": round(yaw, 2),
                    "roll": round(roll, 2)
                }
            },
            "image": img_str
        }
    
    return response

# Add a health check endpoint that doesn't require authentication
@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/test-auth", dependencies=[Depends(verify_api_key)])
async def test_auth():
    """Test endpoint to verify API key authentication"""
    return {"message": "Authentication successful!"}

@app.get("/api-key-status")
async def api_key_status():
    """Check if API key is set (don't expose actual key)"""
    return {
        "api_key_set": bool(API_KEY),
        "api_key_length": len(API_KEY) if API_KEY else 0
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)