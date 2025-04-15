# process_image.py - Handle image processing for face tracking
import cv2
import numpy as np
import base64
from fastapi import UploadFile
import tempfile
import os
from typing import Dict, Any, List

# Import the face tracking class
from Main_model02.showframeVisualization import FrameShow_head_face

# Initialize face tracker for image processing
image_face_tracker = None  # Will be initialized on first use

def get_face_tracker():
    """
    Initialize the face tracker if not already initialized
    """
    global image_face_tracker
    if image_face_tracker is None:
        # Try different possible locations for the model
        model_paths = [
            'Main_model02/face_landmarker.task',
            '../Main_model02/face_landmarker.task',
            './backend/Main_model02/face_landmarker.task'
        ]
        
        model_path = None
        for path in model_paths:
            if os.path.exists(path):
                model_path = path
                break
                
        if model_path is None:
            raise FileNotFoundError("Face landmarker model not found in any of the expected locations")
            
        print(f"Initializing face tracker with model: {model_path}")
        image_face_tracker = FrameShow_head_face(
            model_path=model_path,
            isVideo=False,  # Set to False for image processing
            isHeadposeOn=True,
            isFaceOn=True
        )
        
    return image_face_tracker

async def process_image_handler(
    file: UploadFile,
    show_head_pose: bool = False,
    show_bounding_box: bool = False,
    show_mask: bool = False,
    show_parameters: bool = False
) -> Dict[str, Any]:
    """
    Process a single image for face tracking and analysis
    
    Args:
        file: The uploaded image file
        show_head_pose: Whether to visualize head pose
        show_bounding_box: Whether to show face bounding box
        show_mask: Whether to show face mask visualization
        show_parameters: Whether to show detection parameters
        
    Returns:
        Dict with processing results including metrics and processed image data
    """
    try:
        # Get the face tracker
        face_tracker = get_face_tracker()
        
        # Configure the face tracker based on parameters
        face_tracker.set_IsShowHeadpose(show_head_pose)
        face_tracker.set_IsShowBox(show_bounding_box)
        face_tracker.set_IsMaskOn(show_mask)
        face_tracker.set_labet_face_element(show_parameters)
        
        # Create a temporary file to save the uploaded image
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
            # Write the uploaded file to the temporary file
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            # Read the image with OpenCV
            image = cv2.imread(tmp_path)
            if image is None:
                return {"success": False, "error": "Could not read image file"}
            
            # Get image dimensions
            height, width = image.shape[:2]
            
            # Process the image with face tracker
            timestamp_ms = int(1000)  # Placeholder timestamp
            metrics, processed_image = face_tracker.process_frame(
                image,
                timestamp_ms,
                isVideo=False,
                isEnhanceFace=True  # Enable face enhancement
            )
            
            # Convert processed image to base64 for return
            _, buffer = cv2.imencode('.jpg', processed_image)
            img_str = base64.b64encode(buffer).decode('utf-8')
            
            # Check if face was detected
            if metrics is not None:
                # Extract metrics
                pitch, yaw, roll = metrics.head_pose_angles
                
                result = {
                    "success": True,
                    "image": {
                        "width": width,
                        "height": height,
                        "data": img_str
                    },
                    "face_detected": True,
                    "metrics": {
                        "head_pose": {
                            "pitch": round(pitch, 2),
                            "yaw": round(yaw, 2),
                            "roll": round(roll, 2)
                        }
                    }
                }
                
                # Add eye centers if available
                if hasattr(metrics, 'eye_centers') and metrics.eye_centers is not None:
                    result["metrics"]["eye_centers"] = {
                        "left": metrics.eye_centers[0].tolist() if len(metrics.eye_centers) > 0 else None,
                        "right": metrics.eye_centers[1].tolist() if len(metrics.eye_centers) > 1 else None
                    }
                
                # Add face box information if available
                if hasattr(metrics, 'face_box') and metrics.face_box is not None:
                    result["metrics"]["face_box"] = {
                        "min": metrics.face_box[0].tolist(),
                        "max": metrics.face_box[1].tolist()
                    }
                
                return result
            else:
                # No face detected
                return {
                    "success": True,
                    "image": {
                        "width": width,
                        "height": height,
                        "data": img_str
                    },
                    "face_detected": False,
                    "message": "No face detected in the image"
                }
        
        finally:
            # Clean up the temporary file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    except Exception as e:
        return {"success": False, "error": f"Error processing image: {str(e)}"}