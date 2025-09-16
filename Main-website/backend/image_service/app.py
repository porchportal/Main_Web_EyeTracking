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

from routes.process_images import process_images
from routes.individualProcess import process_single_image

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
    setNumbers: list
    userId: Optional[str] = None
    enhanceFace: bool

@app.post("/process-images")
async def process_images_batch(request: ProcessImagesRequest):
    """Process multiple images in batch"""
    try:
        # Debug logging to see what parameters we're receiving
        print(f"🚀 Image service received request: setNumbers={request.setNumbers}, userId={request.userId}, enhanceFace={request.enhanceFace}")
        
        results = []
        async for result in process_images(
            set_numbers=request.setNumbers,
            userId=request.userId,
            enhanceFace=request.enhanceFace
        ):
            print(f"📊 Processing result: {result}")
            results.append(result)
        
        print(f"✅ Processing completed. Total results: {len(results)}")
        return {
            "success": True,
            "message": "Images processed successfully",
            "results": results,
            "totalSets": len(request.setNumbers),
            "processedCount": len([r for r in results if r.get("status") == "completed"])
        }
    except Exception as e:
        print(f"❌ Error in process_images_batch: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/process-single-image")
async def process_single_image_endpoint(
    file: UploadFile = File(...),
    show_head_pose: Optional[str] = Form(default="false"),
    show_bounding_box: Optional[str] = Form(default="false"),
    show_mask: Optional[str] = Form(default="false"),
    show_parameters: Optional[str] = Form(default="false"),
    enhance_face: Optional[str] = Form(default="true")
):
    """Process a single uploaded image with AI face analysis"""
    try:
        # Convert string parameters to boolean
        show_head_pose_bool = show_head_pose.lower() == "true"
        show_bounding_box_bool = show_bounding_box.lower() == "true"
        show_mask_bool = show_mask.lower() == "true"
        show_parameters_bool = show_parameters.lower() == "true"
        enhance_face_bool = enhance_face.lower() == "true"
        
        # Process the image using the individualProcess module
        result = await process_single_image(
            file=file,
            show_head_pose=show_head_pose_bool,
            show_bounding_box=show_bounding_box_bool,
            show_mask=show_mask_bool,
            show_parameters=show_parameters_bool,
            enhanceFace=enhance_face_bool
        )
        
        return result
        
    except Exception as e:
        print(f"Error in process_single_image_endpoint: {str(e)}")
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