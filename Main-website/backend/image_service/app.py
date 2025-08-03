# image_service/app.py - Main entry point for image service
import multiprocessing
import sys
import os
import warnings
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from pydantic import BaseModel

# Suppress PyTorch image extension warning
warnings.filterwarnings("ignore", message="Failed to load image Python extension")

# Fix multiprocessing for Docker containers
if __name__ == "__main__":
    multiprocessing.set_start_method('spawn', force=True)

# Load environment variables
load_dotenv('.env.backend')

# Add parent directory to path to import the main app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from process_images import process_images

# Create FastAPI app for image service
app = FastAPI(
    title="Image Processing Service",
    version="1.0.0",
    description="API for image processing and analysis"
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
    return {"status": "healthy", "service": "image_service"}

@app.post("/process-image")
async def process_image(
    file: UploadFile = File(...),
    showHeadPose: Optional[str] = Form(default="false"),
    showBoundingBox: Optional[str] = Form(default="false"),
    showMask: Optional[str] = Form(default="false"),
    showParameters: Optional[str] = Form(default="false")
):
    """Process a single uploaded image"""
    try:
        # Import the process_images function and handle the image
        # This is a simplified version - you may need to adapt based on your needs
        return {"message": "Image processing endpoint", "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ProcessImagesRequest(BaseModel):
    set_numbers: list

@app.post("/process-images")
async def process_images_batch(request: ProcessImagesRequest):
    """Process multiple images in batch"""
    try:
        results = []
        async for result in process_images(request.set_numbers):
            results.append(result)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/process-frame")
async def process_frame(
    file: UploadFile = File(...),
    showHeadPose: Optional[str] = Form(default="false"),
    showBoundingBox: Optional[str] = Form(default="false"),
    showMask: Optional[str] = Form(default="false"),
    showParameters: Optional[str] = Form(default="false")
):
    """Process a single frame from a video stream"""
    try:
        # Import the process_images function and handle the frame
        # This is a simplified version - you may need to adapt based on your needs
        return {"message": "Frame processing endpoint", "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010) 