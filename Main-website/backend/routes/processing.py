# backend/routes/processing.py
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, BackgroundTasks
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
import os
import subprocess
import logging
from auth import verify_api_key

# Import the processing modules
from process_images import process_images
from process_video import process_video_handler

# Set up router with /api prefix
router = APIRouter(
    prefix="/api",
    tags=["processing"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)

class ProcessStatusResponse(BaseModel):
    isProcessing: bool
    currentTask: Optional[str] = None
    progress: Optional[float] = None
    error: Optional[str] = None

class ProcessingRequest(BaseModel):
    set_numbers: List[int]

class ProcessingResponse(BaseModel):
    success: bool
    message: str
    error: str = None

# Global variable to track processing status
processing_status = {
    "isProcessing": False,
    "currentTask": None,
    "progress": 0,
    "currentSet": None,
    "totalSets": 0,
    "processedSets": []
}

@router.get("/process-status-api")
async def get_process_status():
    """Get the current processing status"""
    return processing_status

@router.post("/process-status-api")
async def update_process_status(status: Dict[str, Any]):
    """Update the processing status"""
    global processing_status
    processing_status.update(status)
    return {"message": "Status updated successfully"}

@router.post("/process-image")
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
    async for result in process_images(
        file=file,
        show_head_pose=showHeadPose.lower() == "true",
        show_bounding_box=showBoundingBox.lower() == "true",
        show_mask=showMask.lower() == "true",
        show_parameters=showParameters.lower() == "true"
    ):
        return result

@router.post("/process-video")
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

@router.post("/process-frame")
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
    async for result in process_images(
        file=file,
        show_head_pose=showHeadPose.lower() == "true",
        show_bounding_box=showBoundingBox.lower() == "true",
        show_mask=showMask.lower() == "true",
        show_parameters=showParameters.lower() == "true"
    ):
        return result

def process_images(set_numbers: List[int]):
    """Process images using process_images.py"""
    try:
        # Update initial status
        global processing_status
        processing_status = {
            "isProcessing": True,
            "currentTask": "Starting processing",
            "progress": 0,
            "currentSet": None,
            "totalSets": len(set_numbers),
            "processedSets": []
        }
        
        # Get the script directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        script_path = os.path.abspath(os.path.join(current_dir, '../process_images.py'))
        
        # Get the directories - fixed paths to use correct directory structure
        capture_dir = os.path.abspath(os.path.join(current_dir, '../../frontend/public/captures/eye_tracking_captures'))
        enhance_dir = os.path.abspath(os.path.join(current_dir, '../../frontend/public/captures/enhance'))
        
        # Ensure enhance directory exists
        if not os.path.exists(enhance_dir):
            logging.info(f"Creating enhance directory: {enhance_dir}")
            os.makedirs(enhance_dir, exist_ok=True)
        
        # Debug logging for paths
        logging.info(f"Capture directory: {capture_dir}")
        logging.info(f"Enhance directory: {enhance_dir}")
        
        # Get the last processed number from enhance directory
        last_processed = 0
        if os.path.exists(enhance_dir):
            for file in os.listdir(enhance_dir):
                if file.startswith('webcam_enhance_') and file.endswith('.jpg'):
                    try:
                        num = int(file.split('_')[2].split('.')[0])
                        last_processed = max(last_processed, num)
                    except (ValueError, IndexError):
                        continue
        
        logging.info(f"Last processed number: {last_processed}")
        
        # Process each set number individually
        for i, set_num in enumerate(set_numbers):
            if set_num <= last_processed:
                logging.info(f"Skipping set {set_num} as it's already processed")
                continue
                
            # Update status for current set
            processing_status["currentSet"] = set_num
            processing_status["currentTask"] = f"Processing set {set_num} ({i + 1}/{len(set_numbers)})"
            processing_status["progress"] = int((i / len(set_numbers)) * 100)
            
            # Check if source files exist
            webcam_src = os.path.join(capture_dir, f'webcam_{set_num:03d}.jpg')
            screen_src = os.path.join(capture_dir, f'screen_{set_num:03d}.jpg')
            param_src = os.path.join(capture_dir, f'parameter_{set_num:03d}.csv')
            
            # Debug logging for source files
            logging.info(f"Checking source files for set {set_num}:")
            logging.info(f"Webcam source: {webcam_src} - Exists: {os.path.exists(webcam_src)}")
            logging.info(f"Screen source: {screen_src} - Exists: {os.path.exists(screen_src)}")
            logging.info(f"Parameter source: {param_src} - Exists: {os.path.exists(param_src)}")
            
            if not all(os.path.exists(f) for f in [webcam_src, screen_src, param_src]):
                logging.error(f"Missing source files for set {set_num}")
                continue
            
            # Process webcam image
            cmd = ['python', script_path, str(set_num)]
            logging.info(f"Executing command: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                logging.error(f"Processing error for set {set_num}: {result.stderr}")
                processing_status["isProcessing"] = False
                processing_status["currentTask"] = f"Error processing set {set_num}"
                return False, result.stderr
            
            # Copy screen image
            screen_dst = os.path.join(enhance_dir, f'screen_enhance_{set_num:03d}.jpg')
            try:
                logging.info(f"Copying screen image from {screen_src} to {screen_dst}")
                with open(screen_src, 'rb') as src, open(screen_dst, 'wb') as dst:
                    dst.write(src.read())
                logging.info(f"Successfully copied screen image for set {set_num}")
            except Exception as e:
                logging.error(f"Error copying screen image for set {set_num}: {str(e)}")
                continue
            
            # Copy parameter file
            param_dst = os.path.join(enhance_dir, f'parameter_enhance_{set_num:03d}.csv')
            try:
                logging.info(f"Copying parameter file from {param_src} to {param_dst}")
                with open(param_src, 'r') as src, open(param_dst, 'w') as dst:
                    dst.write(src.read())
                logging.info(f"Successfully copied parameter file for set {set_num}")
            except Exception as e:
                logging.error(f"Error copying parameter file for set {set_num}: {str(e)}")
                continue
            
            # Update processed sets
            processing_status["processedSets"].append(set_num)
            processing_status["progress"] = int(((i + 1) / len(set_numbers)) * 100)
            logging.info(f"Successfully processed set {set_num}")
        
        # Update final status
        processing_status["isProcessing"] = False
        processing_status["currentTask"] = "Processing completed"
        processing_status["progress"] = 100
        
        return True, "Processing completed successfully"
        
    except Exception as e:
        logging.error(f"Error processing images: {str(e)}")
        processing_status["isProcessing"] = False
        processing_status["currentTask"] = f"Error: {str(e)}"
        return False, str(e)

@router.post("/process-images", dependencies=[Depends(verify_api_key)])
async def start_processing(request: ProcessingRequest, background_tasks: BackgroundTasks):
    """Start processing images in the background"""
    try:
        # Add the processing task to background tasks
        background_tasks.add_task(process_images, request.set_numbers)
        
        return ProcessingResponse(
            success=True,
            message="Processing started successfully"
        )
    except Exception as e:
        logging.error(f"Error starting processing: {str(e)}")
        return ProcessingResponse(
            success=False,
            message="Failed to start processing",
            error=str(e)
        )