# process_image.py - Handle image processing for face tracking
import cv2
import numpy as np
import base64
from fastapi import UploadFile
import tempfile
import os
import traceback
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
            # '../Main_model02/face_landmarker.task',
            # './backend/Main_model02/face_landmarker.task'
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
    tmp_path = None
    try:
        # Log the incoming request details
        print(f"Processing image: {file.filename}")
        print(f"Parameters: head_pose={show_head_pose}, bounding_box={show_bounding_box}, mask={show_mask}, params={show_parameters}")
        
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
            
            # Check if the content is valid
            if not content or len(content) == 0:
                return {"success": False, "error": "Uploaded file is empty"}
                
            print(f"Read {len(content)} bytes from uploaded file")
            tmp_file.write(content)
            tmp_path = tmp_file.name
            print(f"Saved to temporary file: {tmp_path}")
        
        try:
            # Read the image with OpenCV
            original_image = cv2.imread(tmp_path)
            if original_image is None:
                print(f"Error: Could not read image file from {tmp_path}")
                return {"success": False, "error": "Could not read image file"}
            
            # Store the original image dimensions
            original_height, original_width = original_image.shape[:2]
            print(f"Original image dimensions: {original_width}x{original_height}")
            
            # Make a copy of the image for processing to ensure we don't modify the original
            image = original_image.copy()
            
            # Process the image with face tracker
            timestamp_ms = int(1000)  # Placeholder timestamp
            metrics, processed_image = face_tracker.process_frame(
                image,
                timestamp_ms,
                isVideo=False,
                isEnhanceFace=True  # Enable face enhancement
            )
            
            # Check the dimensions of the processed image
            processed_height, processed_width = processed_image.shape[:2]
            print(f"Processed image dimensions: {processed_width}x{processed_height}")
            
            # Log if dimensions changed but don't resize them back
            if processed_width != original_width or processed_height != original_height:
                print(f"Note: Image dimensions changed during processing: Original ({original_width}x{original_height}) → Processed ({processed_width}x{processed_height})")
                # We're intentionally NOT resizing the image back to preserve the model's output dimensions
            
            # Convert processed image to base64 for return
            _, buffer = cv2.imencode('.jpg', processed_image)
            img_str = base64.b64encode(buffer).decode('utf-8')
            
            # Check if face was detected
            if metrics is not None:
                print("Face detection successful")
                # Extract metrics
                pitch, yaw, roll = metrics.head_pose_angles
                
                result = {
                    "success": True,
                    "image": {
                        "width": original_width,  # Always use original dimensions
                        "height": original_height,
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
                    print("Adding eye centers to response")
                    # FIX: Convert tuple to list if needed
                    try:
                        result["metrics"]["eye_centers"] = {
                            "left": np.array(metrics.eye_centers[0]).tolist() if len(metrics.eye_centers) > 0 else None,
                            "right": np.array(metrics.eye_centers[1]).tolist() if len(metrics.eye_centers) > 1 else None
                        }
                    except AttributeError:
                        # If eye_centers are tuples without tolist() method
                        print("Converting eye center tuples to lists")
                        result["metrics"]["eye_centers"] = {
                            "left": list(metrics.eye_centers[0]) if len(metrics.eye_centers) > 0 else None,
                            "right": list(metrics.eye_centers[1]) if len(metrics.eye_centers) > 1 else None
                        }
                
                # Add face box information if available
                if hasattr(metrics, 'face_box') and metrics.face_box is not None:
                    print("Adding face box to response")
                    # FIX: Convert tuple to list if needed
                    try:
                        result["metrics"]["face_box"] = {
                            "min": np.array(metrics.face_box[0]).tolist(),
                            "max": np.array(metrics.face_box[1]).tolist()
                        }
                    except AttributeError:
                        # If face_box contains tuples without tolist() method
                        print("Converting face box tuples to lists")
                        result["metrics"]["face_box"] = {
                            "min": list(metrics.face_box[0]),
                            "max": list(metrics.face_box[1])
                        }
                
                return result
            else:
                print("No face detected in the image")
                # No face detected, but we'll return whatever the model outputs (may be modified)
                # This allows any visualization or modifications from the model to be preserved
                _, buffer = cv2.imencode('.jpg', processed_image)
                img_str = base64.b64encode(buffer).decode('utf-8')
                
                # Get the actual dimensions of the processed image
                processed_height, processed_width = processed_image.shape[:2]
                
                return {
                    "success": True,
                    "image": {
                        "width": processed_width,
                        "height": processed_height,
                        "data": img_str  # Return processed image even if no face detected
                    },
                    "face_detected": False,
                    "message": "No face detected in the image"
                }
        
        finally:
            # Clean up the temporary file
            if os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                    print(f"Temporary file removed: {tmp_path}")
                except Exception as e:
                    print(f"Warning: Failed to remove temporary file: {e}")
    
    except Exception as e:
        # Log the full exception with traceback
        print(f"Error processing image: {str(e)}")
        print(traceback.format_exc())
        
        # Clean up the temporary file in case of error
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except:
                pass
                
        return {"success": False, "error": f"Error processing image: {str(e)}"}