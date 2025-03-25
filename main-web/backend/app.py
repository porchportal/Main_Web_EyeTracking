# app.py - Main FastAPI entry point
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
import os
from typing import Optional

# Import the processing modules
from imageProcess import process_image_handler
from videoProcess import process_video_handler

app = FastAPI()

# Configure CORS to allow requests from Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# API Key authentication
API_KEY = os.getenv("API_KEY", "A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV")
api_key_header = APIKeyHeader(name="X-API-Key")  # This should match the header name used by frontend

async def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key"
        )
    return api_key

@app.post("/process-image", dependencies=[Depends(verify_api_key)])
async def process_image(
    file: UploadFile = File(...),
    showHeadPose: Optional[str] = Form(default="false"),
    showBoundingBox: Optional[str] = Form(default="false"),
    showMask: Optional[str] = Form(default="false"),
    showParameters: Optional[str] = Form(default="false")
):
    """
    Process a single image for face tracking and analysis
    """
    return await process_image_handler(
        file, 
        show_head_pose=showHeadPose.lower() == "true",
        show_bounding_box=showBoundingBox.lower() == "true",
        show_mask=showMask.lower() == "true",
        show_parameters=showParameters.lower() == "true"
    )

@app.post("/process-video", dependencies=[Depends(verify_api_key)])
async def process_video(
    file: UploadFile = File(...),
    showHeadPose: Optional[str] = Form(default="false"),
    showBoundingBox: Optional[str] = Form(default="false"),
    showMask: Optional[str] = Form(default="false"),
    showParameters: Optional[str] = Form(default="false")
):
    """
    Process video frames for face tracking and analysis
    """
    return await process_video_handler(
        file, 
        show_head_pose=showHeadPose.lower() == "true",
        show_bounding_box=showBoundingBox.lower() == "true",
        show_mask=showMask.lower() == "true",
        show_parameters=showParameters.lower() == "true"
    )

@app.post("/process-frame", dependencies=[Depends(verify_api_key)])
async def process_frame(
    file: UploadFile = File(...),
    showHeadPose: Optional[str] = Form(default="false"),
    showBoundingBox: Optional[str] = Form(default="false"),
    showMask: Optional[str] = Form(default="false"),
    showParameters: Optional[str] = Form(default="false")
):
    """
    Process a single frame from a video stream
    This endpoint uses the same handler as process-image
    """
    return await process_image_handler(
        file, 
        show_head_pose=showHeadPose.lower() == "true",
        show_bounding_box=showBoundingBox.lower() == "true",
        show_mask=showMask.lower() == "true",
        show_parameters=showParameters.lower() == "true"
    )

# Add a health check endpoint that doesn't require authentication
@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/check-backend-connection")
async def check_backend_connection():
    """
    Endpoint for frontend to check if backend is available
    """
    return {"connected": True}

@app.get("/test-auth", dependencies=[Depends(verify_api_key)])
async def test_auth():
    """Test endpoint to verify API key authentication"""
    return {"message": "Authentication successful!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)