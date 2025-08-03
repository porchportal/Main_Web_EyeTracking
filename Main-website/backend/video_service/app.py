# video_service/app.py - Main entry point for video service
import multiprocessing
import sys
import os
import warnings
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

# Suppress PyTorch image extension warning
warnings.filterwarnings("ignore", message="Failed to load image Python extension")

# Fix multiprocessing for Docker containers
if __name__ == "__main__":
    multiprocessing.set_start_method('spawn', force=True)

# Load environment variables
load_dotenv('.env.backend')

# Add parent directory to path to import the main app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from process_video import process_video_handler

# Create FastAPI app for video service
app = FastAPI(
    title="Video Processing Service",
    version="1.0.0",
    description="API for video processing and analysis"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "video_service"}

@app.post("/process-video")
async def process_video(
    file: UploadFile = File(...),
    showHeadPose: Optional[str] = Form(default="false"),
    showBoundingBox: Optional[str] = Form(default="false"),
    showMask: Optional[str] = Form(default="false"),
    showParameters: Optional[str] = Form(default="false")
):
    """Process an uploaded video file"""
    try:
        result = await process_video_handler(
            file=file,
            showHeadPose=showHeadPose,
            showBoundingBox=showBoundingBox,
            showMask=showMask,
            showParameters=showParameters
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011) 