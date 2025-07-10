# imageProcess.py - Handle image processing for face tracking
import cv2
import numpy as np
import base64
from fastapi import UploadFile
import time

# Import the face tracking class
# from Main_model02.showframeVisualization import FrameShow_head_face



import importlib
import os
import sys
from huggingface_hub import snapshot_download

# === CONFIG ===
REPO_ID = "porch/Detected_UpScaleImage"
TOKEN = "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" 
LOCAL_BASE = "Main-AI"              # Local base folder
FOLDER_IN_REPO = "Main_model"            # Folder from HF
FIRST_IMPORT = f"{LOCAL_BASE}.{FOLDER_IN_REPO}.showframeVisualization"
SECOND_IMPORT = f"{LOCAL_BASE}.{FOLDER_IN_REPO}.showframeVisualization"

def try_import_function(module_path: str, function_name: str):
    try:
        module = importlib.import_module(module_path)
        func = getattr(module, function_name)
        print(f"✅ Successfully imported `{function_name}` from `{module_path}`")
        return func
    except (ImportError, AttributeError) as e:
        print(f"❌ Failed to import `{function_name}` from `{module_path}`: {e}")
        return None
#Try to import directly
FrameShow_head_face = try_import_function(FIRST_IMPORT, "FrameShow_head_face")
#If not found, download then try again
if FrameShow_head_face is None:
    print("🔽 Downloading model folder from Hugging Face...")

    snapshot_download(
        repo_id=REPO_ID,
        repo_type="model",
        allow_patterns=f"{FOLDER_IN_REPO}/**",
        local_dir=LOCAL_BASE,                 # Downloads to ./Main_model02/
        local_dir_use_symlinks=False,
        token=TOKEN
    )

    # Make sure Python can find ./Main_model02/
    sys.path.append(os.path.abspath("."))

    # Try the nested import path
    FrameShow_head_face = try_import_function(SECOND_IMPORT, "FrameShow_head_face")




# Initialize face tracker once for image processing
face_tracker = FrameShow_head_face(
    model_path='Main_model02/face_landmarker.task',
    isVideo=False,  # Set to False for single image processing
    isHeadposeOn=True,
    isFaceOn=True
)

async def process_image_handler(
    file: UploadFile,
    show_head_pose: bool = False,
    show_bounding_box: bool = False,
    show_mask: bool = False,
    show_parameters: bool = False
):
    """
    Process a single image or video frame for face tracking
    
    Args:
        file: The uploaded image file
        show_head_pose: Whether to visualize head pose
        show_bounding_box: Whether to show face bounding box
        show_mask: Whether to show face mask visualization
        show_parameters: Whether to show detection parameters
        
    Returns:
        Dict with processing results including metrics and processed image
    """
    # Read the uploaded image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if frame is None:
        return {"success": False, "error": "Could not read image"}
    
    # Configure the face tracker based on parameters
    face_tracker.set_IsShowHeadpose(show_head_pose)
    face_tracker.set_IsShowBox(show_bounding_box)
    face_tracker.set_IsMaskOn(show_mask)
    face_tracker.set_labet_face_element(show_parameters)
    
    # Process the image with face tracker
    timestamp_ms = int(1000 * time.time())
    metrics, processed_frame = face_tracker.process_frame(
        frame,
        timestamp_ms,
        isVideo=False,  # Single frame processing
        isEnhanceFace=True
    )
    
    # Prepare response data
    response = {"success": False}
    
    if metrics is not None:
        # Face was detected
        pitch, yaw, roll = metrics.head_pose_angles
        
        # Convert processed image to base64 for sending to frontend
        _, buffer = cv2.imencode('.jpg', processed_frame)
        img_str = base64.b64encode(buffer).decode('utf-8')
        
        # Prepare response with metrics and image
        response = {
            "success": True,
            "metrics": {
                "face_detected": True,
                "head_pose": {
                    "pitch": round(pitch, 2),
                    "yaw": round(yaw, 2),
                    "roll": round(roll, 2)
                },
                "eye_centers": {
                    "left": metrics.eye_centers[0].tolist() if hasattr(metrics, 'eye_centers') and metrics.eye_centers is not None else None,
                    "right": metrics.eye_centers[1].tolist() if hasattr(metrics, 'eye_centers') and metrics.eye_centers is not None else None
                }
            },
            "image": img_str
        }
    else:
        # Face was not detected
        # Still return the original frame with potential UI elements
        # Convert frame to base64 for sending to frontend
        _, buffer = cv2.imencode('.jpg', processed_frame)
        img_str = base64.b64encode(buffer).decode('utf-8')
        
        response = {
            "success": True,
            "metrics": {
                "face_detected": False
            },
            "image": img_str
        }
    
    return response