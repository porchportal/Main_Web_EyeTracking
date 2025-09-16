# individualProcess.py - Handle individual image processing for face tracking
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
import json
from PIL import Image
import io
import subprocess

# Import the face tracking class
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
            image_face_tracker = FrameShow_head_face(
                isVideo=False,  # Set to False for image processing
                isHeadposeOn=True,
                isFaceOn=True
            )
        except Exception as e:
            pass
            raise
        
    return image_face_tracker

def convert_avif_with_system_tool(content, file_extension):
    """
    Convert AVIF images using the system's avifdec tool
    """
    try:
        # First, let's check what avifdec supports
        try:
            help_result = subprocess.run(['avifdec', '--help'], capture_output=True, text=True, timeout=10)
        except Exception as e:
            pass
        
        # Create temporary files for input and output
        with tempfile.NamedTemporaryFile(suffix='.avif', delete=False) as input_file:
            input_file.write(content)
            input_path = input_file.name
        
        # Try different output formats
        output_formats = ['.png', '.jpg', '.yuv', '.bmp']
        image = None
        
        for output_ext in output_formats:
            with tempfile.NamedTemporaryFile(suffix=output_ext, delete=False) as output_file:
                output_path = output_file.name
            
            try:
                # Use avifdec to convert AVIF
                result = subprocess.run([
                    'avifdec', 
                    input_path, 
                    output_path
                ], capture_output=True, text=True, timeout=30)
                
                if result.returncode == 0:
                    # Check if output file exists and has content
                    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                        # Try to read with OpenCV
                        if output_ext == '.yuv':
                            # For YUV format, we need to know dimensions - skip for now
                            continue
                        else:
                            image = cv2.imread(output_path)
                            if image is not None:
                                break
                
            except Exception as e:
                pass
            finally:
                # Clean up output file
                try:
                    if os.path.exists(output_path):
                        os.unlink(output_path)
                except:
                    pass
        
        # Clean up input file
        try:
            if os.path.exists(input_path):
                os.unlink(input_path)
        except:
            pass
        
        if image is None:
            return None
        
        return image
        
    except subprocess.TimeoutExpired:
        return None
    except FileNotFoundError:
        return None
    except Exception as e:
        return None

def convert_image_with_pil(content, file_extension):
    """
    Convert unsupported image formats (like WebP) to OpenCV-compatible format using PIL
    """
    try:
        # Open image with PIL
        pil_image = Image.open(io.BytesIO(content))
        
        # Convert to RGB if necessary (OpenCV expects RGB)
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        # Convert PIL image to numpy array
        img_array = np.array(pil_image)
        
        # Convert RGB to BGR for OpenCV
        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        
        return img_bgr
        
    except Exception as e:
        return None

async def process_single_image(
    file: UploadFile,
    show_head_pose: bool = False,
    show_bounding_box: bool = False,
    show_mask: bool = False,
    show_parameters: bool = False,
    enhanceFace: bool = True
) -> Dict[str, Any]:
    """
    Process a single uploaded image for face tracking and analysis.
    
    Args:
        file: Single uploaded file to process
        show_head_pose: Whether to visualize head pose
        show_bounding_box: Whether to show face bounding box
        show_mask: Whether to show face mask visualization
        show_parameters: Whether to show detection parameters
        enhanceFace: Whether to enhance face in the processed image
        
    Returns:
        Dictionary containing processing results and metrics
    """
    try:
        # Get the face tracker
        face_tracker = get_face_tracker()
        
        # Configure the face tracker based on parameters
        face_tracker.set_IsShowHeadpose(show_head_pose)
        face_tracker.set_IsShowBox(show_bounding_box)
        face_tracker.set_IsMaskOn(show_mask)
        face_tracker.set_labet_face_element(show_parameters)
        
        tmp_path = None
        try:
            # Read the file content first
            content = await file.read()
            if not content or len(content) == 0:
                return {"success": False, "error": "Uploaded file is empty"}
            
            pass
            
            # Detect image format from content
            def detect_image_format(content):
                """Detect image format from file content"""
                # Define signature bytes outside f-string to avoid backslash issues
                jpeg_sig = b'\xff\xd8\xff'
                png_sig = b'\x89PNG\r\n\x1a\n'
                gif_sig1 = b'GIF87a'
                gif_sig2 = b'GIF89a'
                bmp_sig = b'BM'
                avif_sig = b'ftypavif'
                webp_sig = b'RIFF'
                
                pass
                
                if content.startswith(jpeg_sig):
                    return '.jpg'
                elif content.startswith(png_sig):
                    return '.png'
                elif content.startswith(gif_sig1) or content.startswith(gif_sig2):
                    return '.gif'
                elif content.startswith(bmp_sig):
                    return '.bmp'
                elif avif_sig in content[:20]:  # AVIF signature is usually in the first 20 bytes
                    return '.avif'
                elif content.startswith(webp_sig):
                    return '.webp'
                else:
                    # Default to jpg if format is unknown
                    return '.jpg'
            
            # Get the appropriate file extension
            file_extension = detect_image_format(content)
            
            # Create a temporary file with the correct extension
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
                tmp_file.write(content)
                tmp_path = tmp_file.name
            
            # Process the single image
            pass
            
            # Try reading with different methods
            image = None
            try:
                # First try with default flags
                image = cv2.imread(tmp_path)
                pass
                
                if image is None:
                    # Try with different flags
                    image = cv2.imread(tmp_path, cv2.IMREAD_COLOR)
                    pass
                    
                if image is None:
                    image = cv2.imread(tmp_path, cv2.IMREAD_UNCHANGED)
                    pass
                
                if image is None:
                    # Try reading from memory buffer instead
                    pass
                    try:
                        nparr = np.frombuffer(content, np.uint8)
                        pass
                        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        pass
                        if image is not None:
                            pass
                        else:
                            # Try with different flags
                            image = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
                            pass
                            if image is not None:
                                pass
                    except Exception as decode_error:
                        pass
                
                # If still no image and it's an unsupported format, try conversion
                if image is None and file_extension == '.avif':
                    pass
                    image = convert_avif_with_system_tool(content, file_extension)
                elif image is None and file_extension == '.webp':
                    pass
                    image = convert_image_with_pil(content, file_extension)
                
                if image is None:
                    # Try to create a simple test image to verify OpenCV is working
                    pass
                    try:
                        test_img = np.zeros((100, 100, 3), dtype=np.uint8)
                        test_img[:, :] = [255, 0, 0]  # Blue image
                        test_success = cv2.imwrite('/tmp/test_opencv.jpg', test_img)
                        pass
                        
                        # Try to read the test image
                        test_read = cv2.imread('/tmp/test_opencv.jpg')
                        pass
                        
                        # Clean up test file
                        if os.path.exists('/tmp/test_opencv.jpg'):
                            os.unlink('/tmp/test_opencv.jpg')
                            
                    except Exception as test_error:
                        pass
                    
                    error_message = f"Could not read image file with any method. File size: {os.path.getsize(tmp_path)} bytes, Detected format: {file_extension}."
                    
                    if file_extension == '.avif':
                        error_message += " AVIF format conversion failed. Please ensure libavif-dev is installed in the system or convert your image to JPG, PNG, or another supported format."
                    else:
                        error_message += " Supported formats: JPG, JPEG, PNG, GIF, BMP, WebP, AVIF"
                    
                    return {"success": False, "error": error_message}
                    
            except Exception as e:
                pass
                return {"success": False, "error": f"Error reading image file: {str(e)}"}
            
            # Check if image is valid
            if image is None or image.size == 0:
                return {"success": False, "error": "Image file appears to be corrupted or empty"}
            
            pass
            
            # Store original dimensions before processing
            original_width = image.shape[1]
            original_height = image.shape[0]
            
            # Process the image
            timestamp_ms = int(1000)
            metrics, processed_image = face_tracker.process_frame(
                image,
                timestamp_ms,
                isVideo=False,
                isEnhanceFace=enhanceFace
            )
            
            # Convert processed image to base64
            _, buffer = cv2.imencode('.jpg', processed_image)
            img_str = base64.b64encode(buffer).decode('utf-8')
            
            # Prepare result
            result = {
                "success": True,
                "image": {
                    "width": processed_image.shape[1],
                    "height": processed_image.shape[0],
                    "data": img_str
                },
                "face_detected": metrics is not None,
                "metrics": {}
            }
            
            # If face enhancement is enabled, store original dimensions
            if enhanceFace:
                result["image"]["original_width"] = original_width
                result["image"]["original_height"] = original_height
            
            # Extract metrics if face was detected
            if metrics is not None:
                # Add all available metrics
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
                        pass
                
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
                        pass
                
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
                        pass
                
                # 5. Add eye_iris_center
                if hasattr(metrics, 'eye_iris_center') and metrics.eye_iris_center is not None:
                    try:
                        left_iris, right_iris = metrics.eye_iris_center
                        result["metrics"]["eye_iris_center"] = {
                            "left": np.array(left_iris).tolist() if hasattr(left_iris, 'tolist') else list(left_iris),
                            "right": np.array(right_iris).tolist() if hasattr(right_iris, 'tolist') else list(right_iris)
                        }
                    except Exception as e:
                        pass
                
                # 6. Add eye_iris boxes
                if hasattr(metrics, 'eye_iris_left_box') and metrics.eye_iris_left_box is not None:
                    try:
                        min_left, max_left = metrics.eye_iris_left_box
                        result["metrics"]["eye_iris_left_box"] = {
                            "min": np.array(min_left).tolist() if hasattr(min_left, 'tolist') else list(min_left),
                            "max": np.array(max_left).tolist() if hasattr(max_left, 'tolist') else list(max_left)
                        }
                    except Exception as e:
                        pass
                
                if hasattr(metrics, 'eye_iris_right_box') and metrics.eye_iris_right_box is not None:
                    try:
                        min_right, max_right = metrics.eye_iris_right_box
                        result["metrics"]["eye_iris_right_box"] = {
                            "min": np.array(min_right).tolist() if hasattr(min_right, 'tolist') else list(min_right),
                            "max": np.array(max_right).tolist() if hasattr(max_right, 'tolist') else list(max_right)
                        }
                    except Exception as e:
                        pass
                
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
                        pass
                
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
                        pass
                
                # 9. Add eye states
                if hasattr(metrics, 'left_eye_state') and metrics.left_eye_state is not None:
                    try:
                        state, ear = metrics.left_eye_state
                        result["metrics"]["left_eye_state"] = state
                        result["metrics"]["left_eye_ear"] = round(ear, 3)
                    except Exception as e:
                        pass
                
                if hasattr(metrics, 'right_eye_state') and metrics.right_eye_state is not None:
                    try:
                        state, ear = metrics.right_eye_state
                        result["metrics"]["right_eye_state"] = state
                        result["metrics"]["right_eye_ear"] = round(ear, 3)
                    except Exception as e:
                        pass
                
                # 10. Add depth information
                if hasattr(metrics, 'depths') and metrics.depths is not None:
                    try:
                        face_depth, left_eye_depth, right_eye_depth, chin_depth = metrics.depths
                        result["metrics"]["distance_cm_from_face"] = round(face_depth, 3)
                        result["metrics"]["distance_cm_from_eye"] = round(float((left_eye_depth + right_eye_depth) / 2), 3)
                        result["metrics"]["chin_depth"] = round(chin_depth, 3)
                    except Exception as e:
                        pass
                
                # 11. Add derived parameters like posture and gaze direction
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
            
        finally:
            # Clean up temporary file
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except:
                    pass
    
    except Exception as e:
        error_msg = f"Error processing single image: {str(e)}"
        logging.error(error_msg)
        return {"success": False, "error": error_msg}

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
