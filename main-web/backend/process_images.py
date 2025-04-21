# process_image.py - Handle image processing for face tracking
import cv2
import numpy as np
import base64
from fastapi import UploadFile
import tempfile
import os
import traceback
from typing import Dict, Any, List, Tuple
import logging

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

# Initialize face tracker for image processing
image_face_tracker = None  # Will be initialized on first use

def get_face_tracker():
    """
    Initialize the face tracker if not already initialized
    """
    global image_face_tracker
    if image_face_tracker is None:
        # Try different possible locations for the model
        # model_paths = [
        #     'Main_model02/face_landmarker.task',
        #     # '../Main_model02/face_landmarker.task',
        #     # './backend/Main_model02/face_landmarker.task'
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
                # Extract all available metrics
                result = {
                    "success": True,
                    "image": {
                        "width": original_width,  # Always use original dimensions
                        "height": original_height,
                        "data": img_str
                    },
                    "face_detected": True,
                    "metrics": {}
                }
                
                # 1. Add head pose angles (pitch, yaw, roll)
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

def process_images(set_numbers: List[int]):
    """Process images using process_images.py"""
    try:
        # Get the script directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        capture_dir = os.path.abspath(os.path.join(current_dir, '../../frontend/public/captures/eye_tracking_captures'))
        enhance_dir = os.path.abspath(os.path.join(current_dir, '../../frontend/public/captures/enhance'))
        
        # Ensure enhance directory exists
        if not os.path.exists(enhance_dir):
            logging.info(f"Creating enhance directory: {enhance_dir}")
            os.makedirs(enhance_dir, exist_ok=True)
        
        # Process each set number
        for set_num in set_numbers:
            # Check if source files exist
            webcam_src = os.path.join(capture_dir, f'webcam_{set_num:03d}.jpg')
            if not os.path.exists(webcam_src):
                logging.error(f"Missing source file for set {set_num}: {webcam_src}")
                continue
            
            # Read the image
            image = cv2.imread(webcam_src)
            if image is None:
                logging.error(f"Could not read image file: {webcam_src}")
                continue
            
            # Get the face tracker
            face_tracker = get_face_tracker()
            
            # Process the image with face tracker
            timestamp_ms = int(1000)  # Placeholder timestamp
            metrics, processed_image = face_tracker.process_frame(
                image,
                timestamp_ms,
                isVideo=False,
                isEnhanceFace=True  # Enable face enhancement
            )
            
            if processed_image is None:
                logging.error(f"Failed to process image for set {set_num}")
                continue
            
            # Save the processed image
            webcam_dst = os.path.join(enhance_dir, f'webcam_enhance_{set_num:03d}.jpg')
            cv2.imwrite(webcam_dst, processed_image)
            logging.info(f"Saved enhanced image to: {webcam_dst}")
            
            # Copy screen image if it exists
            screen_src = os.path.join(capture_dir, f'screen_{set_num:03d}.jpg')
            screen_dst = os.path.join(enhance_dir, f'screen_enhance_{set_num:03d}.jpg')
            if os.path.exists(screen_src):
                with open(screen_src, 'rb') as src, open(screen_dst, 'wb') as dst:
                    dst.write(src.read())
                logging.info(f"Copied screen image to: {screen_dst}")
            
            # Update parameter file with new metrics
            param_src = os.path.join(capture_dir, f'parameter_{set_num:03d}.csv')
            param_dst = os.path.join(enhance_dir, f'parameter_enhance_{set_num:03d}.csv')
            
            if os.path.exists(param_src):
                # Read original parameters
                original_params = {}
                with open(param_src, 'r') as src:
                    for line in src:
                        if ',' in line:
                            key, value = line.strip().split(',', 1)
                            original_params[key] = value
                
                # Update with new metrics if available
                if metrics is not None:
                    # Update head pose angles
                    if hasattr(metrics, 'head_pose_angles'):
                        pitch, yaw, roll = metrics.head_pose_angles
                        original_params['pitch'] = f"{pitch:.2f}"
                        original_params['yaw'] = f"{yaw:.2f}"
                        original_params['roll'] = f"{roll:.2f}"
                    
                    # Update face box
                    if hasattr(metrics, 'face_box'):
                        min_pos, max_pos = metrics.face_box
                        original_params['face_min_position_x'] = str(int(min_pos[0]))
                        original_params['face_min_position_y'] = str(int(min_pos[1]))
                        original_params['face_max_position_x'] = str(int(max_pos[0]))
                        original_params['face_max_position_y'] = str(int(max_pos[1]))
                        original_params['face_width'] = str(int(max_pos[0] - min_pos[0]))
                        original_params['face_height'] = str(int(max_pos[1] - min_pos[1]))
                    
                    # Update eye positions
                    if hasattr(metrics, 'eye_centers'):
                        eye_centers = metrics.eye_centers
                        if len(eye_centers) > 0:
                            left_eye = eye_centers[0]
                            original_params['left_eye_position_x'] = str(int(left_eye[0]))
                            original_params['left_eye_position_y'] = str(int(left_eye[1]))
                        if len(eye_centers) > 1:
                            right_eye = eye_centers[1]
                            original_params['right_eye_position_x'] = str(int(right_eye[0]))
                            original_params['right_eye_position_y'] = str(int(right_eye[1]))
                        if len(eye_centers) > 2:
                            mid_eye = eye_centers[2]
                            original_params['center_between_eyes_x'] = str(int(mid_eye[0]))
                            original_params['center_between_eyes_y'] = str(int(mid_eye[1]))
                    
                    # Update eye boxes
                    if hasattr(metrics, 'left_eye_box'):
                        min_left, max_left = metrics.left_eye_box
                        original_params['left_eye_box_min_x'] = str(int(min_left[0]))
                        original_params['left_eye_box_min_y'] = str(int(min_left[1]))
                        original_params['left_eye_box_max_x'] = str(int(max_left[0]))
                        original_params['left_eye_box_max_y'] = str(int(max_left[1]))
                    
                    if hasattr(metrics, 'right_eye_box'):
                        min_right, max_right = metrics.right_eye_box
                        original_params['right_eye_box_min_x'] = str(int(min_right[0]))
                        original_params['right_eye_box_min_y'] = str(int(min_right[1]))
                        original_params['right_eye_box_max_x'] = str(int(max_right[0]))
                        original_params['right_eye_box_max_y'] = str(int(max_right[1]))
                    
                    # Update iris positions
                    if hasattr(metrics, 'eye_iris_center'):
                        left_iris, right_iris = metrics.eye_iris_center
                        original_params['left_iris_center_x'] = str(int(left_iris[0]))
                        original_params['left_iris_center_y'] = str(int(left_iris[1]))
                        original_params['right_iris_center_x'] = str(int(right_iris[0]))
                        original_params['right_iris_center_y'] = str(int(right_iris[1]))
                    
                    # Update iris boxes
                    if hasattr(metrics, 'eye_iris_left_box'):
                        min_left, max_left = metrics.eye_iris_left_box
                        original_params['left_iris_min_x'] = str(int(min_left[0]))
                        original_params['left_iris_min_y'] = str(int(min_left[1]))
                        original_params['left_iris_max_x'] = str(int(max_left[0]))
                        original_params['left_iris_max_y'] = str(int(max_left[1]))
                    
                    if hasattr(metrics, 'eye_iris_right_box'):
                        min_right, max_right = metrics.eye_iris_right_box
                        original_params['right_iris_min_x'] = str(int(min_right[0]))
                        original_params['right_iris_min_y'] = str(int(min_right[1]))
                        original_params['right_iris_max_x'] = str(int(max_right[0]))
                        original_params['right_iris_max_y'] = str(int(max_right[1]))
                    
                    # Update eye states
                    if hasattr(metrics, 'left_eye_state'):
                        state, ear = metrics.left_eye_state
                        original_params['left_eye_state'] = state
                        original_params['left_eye_ear'] = f"{ear:.3f}"
                    
                    if hasattr(metrics, 'right_eye_state'):
                        state, ear = metrics.right_eye_state
                        original_params['right_eye_state'] = state
                        original_params['right_eye_ear'] = f"{ear:.3f}"
                    
                    # Update depth information
                    if hasattr(metrics, 'depths'):
                        face_depth, left_eye_depth, right_eye_depth, chin_depth = metrics.depths
                        original_params['distance_cm_from_face'] = f"{face_depth:.2f}"
                        original_params['distance_cm_from_eye'] = f"{(left_eye_depth + right_eye_depth) / 2:.2f}"
                        original_params['chin_depth'] = f"{chin_depth:.2f}"
                    
                    # Update derived parameters
                    if hasattr(metrics, 'head_pose_angles'):
                        pitch, yaw, roll = metrics.head_pose_angles
                        original_params['posture'] = "Looking Down" if pitch > 10 else "Looking Up" if pitch < -10 else "Looking Straight"
                        original_params['gaze_direction'] = "Looking Right" if yaw > 10 else "Looking Left" if yaw < -10 else "Looking Straight"
                
                # Write updated parameters to new file
                with open(param_dst, 'w') as dst:
                    dst.write("Parameter,Value\n")
                    for key, value in original_params.items():
                        dst.write(f"{key},{value}\n")
                logging.info(f"Updated parameter file with new metrics: {param_dst}")
        
        return True, "Processing completed successfully"
        
    except Exception as e:
        logging.error(f"Error processing images: {str(e)}")
        return False, str(e)