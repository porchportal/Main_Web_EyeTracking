# process_image.py - Handle image processing for face tracking
import cv2
import numpy as np
import base64
from fastapi import UploadFile
import tempfile
import os
import traceback
from typing import Dict, Any, List, Tuple, Generator, AsyncGenerator
import logging
import requests
from datetime import datetime

# Import the face tracking class
# from Main_model02.showframeVisualization import FrameShow_head_face


import importlib
import os
import sys
from huggingface_hub import snapshot_download

# === CONFIG ===
# REPO_ID = "porch/Detected_UpScaleImage"
# TOKEN = "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" 
# LOCAL_BASE = "Main_AI"              # Local base folder
# FOLDER_IN_REPO = "Main_model"            # Folder from HF
# FIRST_IMPORT = f"{LOCAL_BASE}.{FOLDER_IN_REPO}.showframeVisualization"
# SECOND_IMPORT = f"{LOCAL_BASE}.{FOLDER_IN_REPO}.showframeVisualization"

# def try_import_function(module_path: str, function_name: str):
#     try:
#         module = importlib.import_module(module_path)
#         func = getattr(module, function_name)
#         print(f"✅ Successfully imported `{function_name}` from `{module_path}`")
#         return func
#     except (ImportError, AttributeError) as e:
#         print(f"❌ Failed to import `{function_name}` from `{module_path}`: {e}")
#         return None
# #Try to import directly
# FrameShow_head_face = try_import_function(FIRST_IMPORT, "FrameShow_head_face")
# #If not found, download then try again
# if FrameShow_head_face is None:
#     print("🔽 Downloading model folder from Hugging Face...")

#     snapshot_download(
#         repo_id=REPO_ID,
#         repo_type="model",
#         allow_patterns=f"{FOLDER_IN_REPO}/**",
#         local_dir=LOCAL_BASE,                 # Downloads to ./Main_model02/
#         local_dir_use_symlinks=False,
#         token=TOKEN
#     )

#     # Make sure Python can find ./Main_model02/
#     sys.path.append(os.path.abspath("."))

#     # Try the nested import path
#     FrameShow_head_face = try_import_function(SECOND_IMPORT, "FrameShow_head_face")
from Main_AI.Main_model.showframeVisualization import FrameShow_head_face


# Initialize face tracker for image processing
image_face_tracker = None  # Will be initialized on first use

def get_face_tracker():
    """
    Initialize the face tracker if not already initialized
    """
    global image_face_tracker
    if image_face_tracker is None:
        try:
            # Try different possible locations for the model
            # model_paths = [
            #     'Main_model02/face_landmarker.task',
            #     '../Main_model02/face_landmarker.task',
            #     './backend/Main_model02/face_landmarker.task'
            # ]
            
            # model_path = None
            # for path in model_paths:
            #     if os.path.exists(path):
            #         model_path = path
            #         break
                    
            # if model_path is None:
            #     raise FileNotFoundError("Face landmarker model not found in any of the expected locations")
                
            # print(f"Initializing face tracker with model: {model_path}")
            image_face_tracker = FrameShow_head_face(
                # model_path=model_path,
                isVideo=False,  # Set to False for image processing
                isHeadposeOn=True,
                isFaceOn=True
            )
        except Exception as e:
            print(f"Error initializing face tracker: {str(e)}")
            raise
        
    return image_face_tracker

async def process_images(
    set_numbers: list = None,
    file: UploadFile = None,
    show_head_pose: bool = False,
    show_bounding_box: bool = False,
    show_mask: bool = False,
    show_parameters: bool = False
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Process one or multiple images for face tracking and analysis.
    
    Args:
        set_numbers: List of set numbers to process (for batch processing)
        file: Single uploaded file to process (for single image processing)
        show_head_pose: Whether to visualize head pose
        show_bounding_box: Whether to show face bounding box
        show_mask: Whether to show face mask visualization
        show_parameters: Whether to show detection parameters
        
    Returns:
        Generator yielding progress updates and results
    """
    try:
        # Get the face tracker
        face_tracker = get_face_tracker()
        
        # Configure the face tracker based on parameters
        face_tracker.set_IsShowHeadpose(show_head_pose)
        face_tracker.set_IsShowBox(show_bounding_box)
        face_tracker.set_IsMaskOn(show_mask)
        face_tracker.set_labet_face_element(show_parameters)
        
        # Single image processing
        if file is not None:
            tmp_path = None
            try:
                # Create a temporary file to save the uploaded image
                with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
                    content = await file.read()
                    if not content or len(content) == 0:
                        yield {"success": False, "error": "Uploaded file is empty"}
                        return
                    
                    tmp_file.write(content)
                    tmp_path = tmp_file.name
                
                # Process the single image
                image = cv2.imread(tmp_path)
                if image is None:
                    yield {"success": False, "error": "Could not read image file"}
                    return
                
                # Process the image
                timestamp_ms = int(1000)
                metrics, processed_image = face_tracker.process_frame(
                    image,
                    timestamp_ms,
                    isVideo=False,
                    isEnhanceFace=True
                )
                
                # Convert processed image to base64
                _, buffer = cv2.imencode('.jpg', processed_image)
                img_str = base64.b64encode(buffer).decode('utf-8')
                
                # Prepare result
                result = {
                    "success": True,
                    "image": {
                        "width": image.shape[1],
                        "height": image.shape[0],
                        "data": img_str
                    },
                    "face_detected": metrics is not None,
                    "metrics": {}
                }
                
                # Extract metrics if face was detected
                if metrics is not None:
                    # Add all available metrics (same as before)
                    if hasattr(metrics, 'head_pose_angles') and metrics.head_pose_angles is not None:
                        pitch, yaw, roll = metrics.head_pose_angles
                        result["metrics"]["head_pose"] = {
                            "pitch": round(pitch, 3),
                            "yaw": round(yaw, 3),
                            "roll": round(roll, 3)
                        }
                    
                    # 2. Add face_box (face bounding box)
                    if hasattr(metrics, 'face_box') and metrics.face_box is not None:
                        try:
                            min_pos, max_pos = metrics.face_box
                            result["metrics"]["face_box"] = {
                                "min": np.array(min_pos).tolist() if hasattr(min_pos, 'tolist') else list(min_pos),
                                "max": np.array(max_pos).tolist() if hasattr(max_pos, 'tolist') else list(max_pos)
                            }
                            # Add individual components for CSV format
                            min_x, min_y = min_pos
                            max_x, max_y = max_pos
                            result["metrics"]["face_min_position_x"] = int(min_x)
                            result["metrics"]["face_min_position_y"] = int(min_y)
                            result["metrics"]["face_max_position_x"] = int(max_x)
                            result["metrics"]["face_max_position_y"] = int(max_y)
                        except Exception as e:
                            print(f"Error extracting face box: {e}")
                    
                    # 3. Add left_eye_box
                    if hasattr(metrics, 'left_eye_box') and metrics.left_eye_box is not None:
                        try:
                            min_left, max_left = metrics.left_eye_box
                            result["metrics"]["left_eye_box"] = {
                                "min": np.array(min_left).tolist() if hasattr(min_left, 'tolist') else list(min_left),
                                "max": np.array(max_left).tolist() if hasattr(max_left, 'tolist') else list(max_left)
                            }
                            # Add individual components for CSV format
                            min_x, min_y = min_left
                            max_x, max_y = max_left
                            result["metrics"]["left_eye_box_min_x"] = int(min_x)
                            result["metrics"]["left_eye_box_min_y"] = int(min_y)
                            result["metrics"]["left_eye_box_max_x"] = int(max_x)
                            result["metrics"]["left_eye_box_max_y"] = int(max_y)
                        except Exception as e:
                            print(f"Error extracting left eye box: {e}")
                    
                    # 4. Add right_eye_box
                    if hasattr(metrics, 'right_eye_box') and metrics.right_eye_box is not None:
                        try:
                            min_right, max_right = metrics.right_eye_box
                            result["metrics"]["right_eye_box"] = {
                                "min": np.array(min_right).tolist() if hasattr(min_right, 'tolist') else list(min_right),
                                "max": np.array(max_right).tolist() if hasattr(max_right, 'tolist') else list(max_right)
                            }
                            # Add individual components for CSV format
                            min_x, min_y = min_right
                            max_x, max_y = max_right
                            result["metrics"]["right_eye_box_min_x"] = int(min_x)
                            result["metrics"]["right_eye_box_min_y"] = int(min_y)
                            result["metrics"]["right_eye_box_max_x"] = int(max_x)
                            result["metrics"]["right_eye_box_max_y"] = int(max_y)
                        except Exception as e:
                            print(f"Error extracting right eye box: {e}")
                    
                    # 5. Add eye_iris_center
                    if hasattr(metrics, 'eye_iris_center') and metrics.eye_iris_center is not None:
                        try:
                            left_iris, right_iris = metrics.eye_iris_center
                            result["metrics"]["eye_iris_center"] = {
                                "left": np.array(left_iris).tolist() if hasattr(left_iris, 'tolist') else list(left_iris),
                                "right": np.array(right_iris).tolist() if hasattr(right_iris, 'tolist') else list(right_iris)
                            }
                        except Exception as e:
                            print(f"Error extracting iris centers: {e}")
                    
                    # 6. Add eye_iris boxes
                    if hasattr(metrics, 'eye_iris_left_box') and metrics.eye_iris_left_box is not None:
                        try:
                            min_left, max_left = metrics.eye_iris_left_box
                            result["metrics"]["eye_iris_left_box"] = {
                                "min": np.array(min_left).tolist() if hasattr(min_left, 'tolist') else list(min_left),
                                "max": np.array(max_left).tolist() if hasattr(max_left, 'tolist') else list(max_left)
                            }
                        except Exception as e:
                            print(f"Error extracting left iris box: {e}")
                    
                    if hasattr(metrics, 'eye_iris_right_box') and metrics.eye_iris_right_box is not None:
                        try:
                            min_right, max_right = metrics.eye_iris_right_box
                            result["metrics"]["eye_iris_right_box"] = {
                                "min": np.array(min_right).tolist() if hasattr(min_right, 'tolist') else list(min_right),
                                "max": np.array(max_right).tolist() if hasattr(max_right, 'tolist') else list(max_right)
                            }
                        except Exception as e:
                            print(f"Error extracting right iris box: {e}")
                    
                    # 7. Add eye_centers
                    if hasattr(metrics, 'eye_centers') and metrics.eye_centers is not None:
                        try:
                            eye_centers = metrics.eye_centers
                            if len(eye_centers) > 0:
                                left_eye = eye_centers[0]
                                result["metrics"]["left_eye_position_x"] = int(left_eye[0])
                                result["metrics"]["left_eye_position_y"] = int(left_eye[1])
                            
                            if len(eye_centers) > 1:
                                right_eye = eye_centers[1]
                                result["metrics"]["right_eye_position_x"] = int(right_eye[0])
                                result["metrics"]["right_eye_position_y"] = int(right_eye[1])
                            
                            if len(eye_centers) > 2:
                                mid_eye = eye_centers[2]
                                result["metrics"]["center_between_eyes_x"] = int(mid_eye[0])
                                result["metrics"]["center_between_eyes_y"] = int(mid_eye[1])
                        except Exception as e:
                            print(f"Error extracting eye centers: {e}")
                    
                    # 8. Add landmark positions
                    if hasattr(metrics, 'landmark_positions') and metrics.landmark_positions is not None:
                        try:
                            landmarks = metrics.landmark_positions
                            result["metrics"]["landmarks"] = {}
                            
                            # Map specific landmark positions to our named parameters
                            landmark_mapping = {
                                'nose': ['nose_position_x', 'nose_position_y'],
                                'chin': ['chin_position_x', 'chin_position_y'],
                                'face_center': ['face_center_position_x', 'face_center_position_y'],
                                'left_cheek': ['cheek_left_position_x', 'cheek_left_position_y'],
                                'right_cheek': ['cheek_right_position_x', 'cheek_right_position_y'],
                                'left_mouth': ['mouth_left_position_x', 'mouth_left_position_y'],
                                'right_mouth': ['mouth_right_position_x', 'mouth_right_position_y'],
                                'left_eye_socket': ['eye_socket_left_center_x', 'eye_socket_left_center_y'],
                                'right_eye_socket': ['eye_socket_right_center_x', 'eye_socket_right_center_y']
                            }
                            
                            # Add all landmarks to result
                            for landmark_name, landmark_position in landmarks.items():
                                pos_array = np.array(landmark_position).tolist() if hasattr(landmark_position, 'tolist') else list(landmark_position)
                                result["metrics"]["landmarks"][landmark_name] = pos_array
                                
                                # Also add the specific named parameters if this landmark is in our mapping
                                if landmark_name in landmark_mapping:
                                    x_key, y_key = landmark_mapping[landmark_name]
                                    result["metrics"][x_key] = int(landmark_position[0])
                                    result["metrics"][y_key] = int(landmark_position[1])
                        except Exception as e:
                            print(f"Error extracting landmarks: {e}")
                    
                    # 9. Add eye states
                    if hasattr(metrics, 'left_eye_state') and metrics.left_eye_state is not None:
                        try:
                            state, ear = metrics.left_eye_state
                            result["metrics"]["left_eye_state"] = state
                            result["metrics"]["left_eye_ear"] = round(ear, 3)
                        except Exception as e:
                            print(f"Error extracting left eye state: {e}")
                    
                    if hasattr(metrics, 'right_eye_state') and metrics.right_eye_state is not None:
                        try:
                            state, ear = metrics.right_eye_state
                            result["metrics"]["right_eye_state"] = state
                            result["metrics"]["right_eye_ear"] = round(ear, 3)
                        except Exception as e:
                            print(f"Error extracting right eye state: {e}")
                    
                    # 10. Add depth information
                    if hasattr(metrics, 'depths') and metrics.depths is not None:
                        try:
                            face_depth, left_eye_depth, right_eye_depth, chin_depth = metrics.depths
                            result["metrics"]["distance_cm_from_face"] = round(face_depth, 3)
                            result["metrics"]["distance_cm_from_eye"] = round(float((left_eye_depth + right_eye_depth) / 2), 3)
                            result["metrics"]["chin_depth"] = round(chin_depth, 3)
                        except Exception as e:
                            print(f"Error extracting depth information: {e}")
                    
                    # 11. Add derived parameters like posture and gaze direction
                    # These would normally be calculated based on head pose and eye positions
                    if hasattr(metrics, 'head_pose_angles') and metrics.head_pose_angles is not None:
                        pitch, yaw, roll = metrics.head_pose_angles
                        
                        # Determine posture based on pitch
                        posture = "Looking Straight"
                        if pitch > 10:
                            posture = "Looking Down"
                        elif pitch < -10:
                            posture = "Looking Up"
                            
                        result["metrics"]["posture"] = posture
                        
                        # Determine gaze direction based on yaw
                        gaze_direction = "Looking Straight"
                        if yaw > 10:
                            gaze_direction = "Looking Right"
                        elif yaw < -10:
                            gaze_direction = "Looking Left"
                            
                        result["metrics"]["gaze_direction"] = gaze_direction
                    
                yield result
                
            finally:
                # Clean up temporary file
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.unlink(tmp_path)
                    except:
                        pass
        
        # Batch processing
        elif set_numbers is not None:
            # Get the script directory
            current_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Get the directories
            capture_dir = os.path.abspath(os.path.join(current_dir, '../frontend/public/captures/eye_tracking_captures'))
            enhance_dir = os.path.abspath(os.path.join(current_dir, '../frontend/public/captures/enhance'))
            
            # Ensure enhance directory exists
            if not os.path.exists(enhance_dir):
                logging.info(f"Creating enhance directory: {enhance_dir}")
                os.makedirs(enhance_dir, exist_ok=True)
            
            # Process each set number
            total_sets = len(set_numbers)
            for i, set_num in enumerate(set_numbers):
                try:
                    # Update progress
                    progress = int(((i + 1) / total_sets) * 100)
                    yield {
                        "status": "processing",
                        "message": f"Processing set {set_num} ({i + 1}/{total_sets})",
                        "progress": progress,
                        "currentSet": set_num,
                        "currentFile": f"webcam_{set_num:03d}.jpg"
                    }
                    
                    # Process webcam image
                    webcam_src = os.path.join(capture_dir, f'webcam_{set_num:03d}.jpg')
                    webcam_dst = os.path.join(enhance_dir, f'webcam_enhance_{set_num:03d}.jpg')
                    
                    if not os.path.exists(webcam_src):
                        yield {
                            "status": "warning",
                            "message": f"Skipping set {set_num}: Webcam image not found",
                            "progress": progress,
                            "currentSet": set_num,
                            "currentFile": f"webcam_{set_num:03d}.jpg"
                        }
                        continue
                    
                    # Read and process the image
                    image = cv2.imread(webcam_src)
                    
                    # Validate the image
                    if is_empty_image(image):
                        yield {
                            "status": "warning",
                            "message": f"Skipping set {set_num}: Could not read image",
                            "progress": progress,
                            "currentSet": set_num,
                            "currentFile": f"webcam_{set_num:03d}.jpg"
                        }
                        continue
                        
                    if is_black_image(image):
                        yield {
                            "status": "warning",
                            "message": f"Skipping set {set_num}: Black image detected",
                            "progress": progress,
                            "currentSet": set_num,
                            "currentFile": f"webcam_{set_num:03d}.jpg"
                        }
                        continue
                    
                    # Process the image
                    timestamp_ms = int(1000)
                    metrics, processed_image = face_tracker.process_frame(
                        image,
                        timestamp_ms,
                        isVideo=False,
                        isEnhanceFace=True
                    )
                    
                    # Save the processed image
                    cv2.imwrite(webcam_dst, processed_image)
                    
                    # Copy screen image
                    screen_src = os.path.join(capture_dir, f'screen_{set_num:03d}.jpg')
                    screen_dst = os.path.join(enhance_dir, f'screen_enhance_{set_num:03d}.jpg')
                    
                    if os.path.exists(screen_src):
                        with open(screen_src, 'rb') as src, open(screen_dst, 'wb') as dst:
                            dst.write(src.read())
                    
                    # Update parameter file with new metrics
                    param_src = os.path.join(capture_dir, f'parameter_{set_num:03d}.csv')
                    param_dst = os.path.join(enhance_dir, f'parameter_enhance_{set_num:03d}.csv')
                    
                    # Read original parameters if they exist
                    original_params = {}
                    if os.path.exists(param_src):
                        with open(param_src, 'r') as src:
                            lines = src.readlines()
                            for line in lines[1:]:  # Skip header
                                parts = line.strip().split(',')
                                if len(parts) >= 2:
                                    original_params[parts[0]] = parts[1]
                    
                    # Create new parameter file with updated metrics
                    with open(param_dst, 'w') as dst:
                        # Write header
                        dst.write("Parameter,Value\n")
                        
                        # Write original parameters first
                        for param, value in original_params.items():
                            dst.write(f"{param},{value}\n")
                        
                        # Add new face tracking metrics if available
                        if metrics is not None:
                            # Add face detection status
                            dst.write(f"face_detected,{True}\n")
                            
                            # Add all other metrics (same as before)
                            if hasattr(metrics, 'head_pose_angles'):
                                pitch, yaw, roll = metrics.head_pose_angles
                                dst.write(f"pitch,{pitch}\n")
                                dst.write(f"yaw,{yaw}\n")
                                dst.write(f"roll,{roll}\n")
                            
                            # ... (rest of the metrics writing code remains the same)
                            
                            # Add processing timestamp
                            dst.write(f"processing_time,{datetime.now().isoformat()}\n")
                    
                except Exception as e:
                    logging.error(f"Error processing set {set_num}: {str(e)}")
                    yield {
                        "status": "error",
                        "message": f"Error processing set {set_num}: {str(e)}",
                        "progress": progress,
                        "currentSet": set_num,
                        "currentFile": f"webcam_{set_num:03d}.jpg"
                    }
                    continue
            
            # Final success message
            yield {
                "status": "completed",
                "message": "All images processed successfully",
                "progress": 100,
                "currentSet": set_numbers[-1],
                "currentFile": f"webcam_{set_numbers[-1]:03d}.jpg"
            }
        
        else:
            yield {"success": False, "error": "No input provided (neither file nor set_numbers)"}
    
    except Exception as e:
        error_msg = f"Error processing images: {str(e)}"
        logging.error(error_msg)
        yield {
            "status": "error",
            "message": error_msg,
            "progress": 0,
            "currentSet": 0,
            "currentFile": ""
        }

def is_black_image(image: np.ndarray, threshold: float = 0.1) -> bool:
    """
    Check if an image is mostly black (below threshold)
    
    Args:
        image: The image to check
        threshold: The threshold for considering an image black (0-1)
        
    Returns:
        bool: True if the image is considered black
    """
    if image is None:
        return True
        
    # Convert to grayscale if it's a color image
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image
        
    # Calculate the mean pixel value
    mean_value = np.mean(gray)
    max_value = 255.0  # For 8-bit images
    
    # If mean value is below threshold, consider it black
    return (mean_value / max_value) < threshold

def is_empty_image(image: np.ndarray) -> bool:
    """
    Check if an image is empty or invalid
    
    Args:
        image: The image to check
        
    Returns:
        bool: True if the image is empty or invalid
    """
    return image is None or image.size == 0