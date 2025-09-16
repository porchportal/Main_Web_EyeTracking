# process_image.py - Handle image processing for face tracking
import cv2
import numpy as np
import os
import traceback
from typing import Dict, Any, List, Tuple, Generator, AsyncGenerator
import logging
import requests
from datetime import datetime
import json

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

def update_progress(userId, currentSet, totalSets, processedSets, status, message, currentFile="", currentIndex=None):
    """
    Update progress information for the frontend
    """
    try:
        # Calculate progress based on current index vs total sets
        # If currentIndex is provided, use it; otherwise try to calculate from processedSets length
        if totalSets > 0:
            if currentIndex is not None:
                # Use the provided index (0-based, so add 1 for percentage)
                progress_percentage = int(((currentIndex + 1) / totalSets) * 100)
            elif len(processedSets) > 0:
                # Fallback: use length of processedSets
                progress_percentage = int((len(processedSets) / totalSets) * 100)
            else:
                # If no processed sets yet, use 0
                progress_percentage = 0
        else:
            progress_percentage = 0
        
        # Ensure progress is between 0 and 100
        progress_percentage = max(0, min(100, progress_percentage))
        
        # Create progress data
        progress_data = {
            "currentSet": currentSet,
            "totalSets": totalSets,
            "processedSets": processedSets,
            "status": status,
            "message": message,
            "currentFile": currentFile,
            "timestamp": datetime.now().isoformat(),
            "userId": userId,
            "progress": progress_percentage
        }
        
        # Write progress to file (this will be read by the frontend API)
        # Use the same path structure that the frontend API expects
        # The frontend reads from: backend/auth_service/resource_security/public/captures/{userId}/processing_progress.json
        progress_file = f"/app/resource_security/public/captures/{userId}/processing_progress.json"
        os.makedirs(os.path.dirname(progress_file), exist_ok=True)
        
        with open(progress_file, 'w') as f:
            json.dump(progress_data, f, indent=2)
            f.flush()  # Ensure data is written to disk immediately
            
        print(f"🔄 Progress updated: {status} - {message} - Progress: {progress_percentage}%")
        print(f"📁 Progress file written to: {progress_file}")
        print(f"📊 Progress data: {progress_data}")
        logging.info(f"Progress updated: {status} - {message} - Progress: {progress_percentage}%")
        logging.info(f"Progress file written to: {progress_file}")
        logging.info(f"Progress data: {progress_data}")
        
    except Exception as e:
        logging.error(f"Error updating progress: {e}")

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
    show_head_pose: bool = False,
    show_bounding_box: bool = False,
    show_mask: bool = False,
    show_parameters: bool = False,
    userId: str = None,
    enhanceFace: bool = True,
    batch_size: int = 6
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Process multiple images for face tracking and analysis (batch processing only).
    Processes images in batches of 6 to avoid memory issues and provide better progress tracking.
    
    Args:
        set_numbers: List of set numbers to process (for batch processing)
        show_head_pose: Whether to visualize head pose
        show_bounding_box: Whether to show face bounding box
        show_mask: Whether to show face mask visualization
        show_parameters: Whether to show detection parameters
        userId: User ID for user-specific processing
        enhanceFace: Whether to enhance face in processed images
        batch_size: Number of images to process in each batch (default: 6)
        
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
        
        # Batch processing
        if set_numbers is not None:
            # Get the script directory
            current_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Get the directories with userId support and enhanceFace toggle
            if userId:
                # Use the mounted volume paths
                user_capture_dir = os.path.abspath(os.path.join('/app/resource_security/public/captures', userId))
                # Fallback to general directory if user-specific doesn't exist
                general_capture_dir = os.path.abspath('/app/resource_security/public/captures/eye_tracking_captures')
                
                # If userId is 'default', try to find the first available user folder
                if userId == 'default' and not os.path.exists(user_capture_dir):
                    try:
                        captures_base_dir = os.path.abspath('/app/resource_security/public/captures')
                        user_folders = [d for d in os.listdir(captures_base_dir) 
                                      if os.path.isdir(os.path.join(captures_base_dir, d)) 
                                      and d not in ['enhance', 'eye_tracking_captures']]
                        if user_folders:
                            actual_user_id = user_folders[0]  # Use the first available user folder
                            user_capture_dir = os.path.abspath(os.path.join('/app/resource_security/public/captures', actual_user_id))
                    except Exception as e:
                        logging.warning(f"Error finding user folders: {e}")
                # Use user-specific directory if it exists, otherwise fallback to general
                if os.path.exists(user_capture_dir):
                    capture_dir = user_capture_dir
                else:
                    capture_dir = general_capture_dir
                
                # Choose output directory based on enhanceFace value
                # Use the actual user ID (which might be different from the input userId)
                actual_user_id = os.path.basename(capture_dir)
                if enhanceFace:
                    output_dir = os.path.abspath(os.path.join('/app/resource_security/public/enhance', actual_user_id))
                else:
                    output_dir = os.path.abspath(os.path.join('/app/resource_security/public/complete', actual_user_id))
            else:
                capture_dir = os.path.abspath('/app/resource_security/public/captures/eye_tracking_captures')
                if enhanceFace:
                    output_dir = os.path.abspath('/app/resource_security/public/enhance')
                else:
                    output_dir = os.path.abspath('/app/resource_security/public/complete')
            
            
            
            # Test different path resolutions
            test_paths = [
                os.path.abspath(os.path.join(current_dir, '../auth_service/resource_security/public/captures')),
                os.path.abspath(os.path.join(current_dir, '../../auth_service/resource_security/public/captures')),
                os.path.abspath(os.path.join(current_dir, '../../../auth_service/resource_security/public/captures')),
            ]
            
            # Check if capture directory exists
            if not os.path.exists(capture_dir):
                logging.error(f"Capture directory does not exist: {capture_dir}")
                
                # Try to find any available capture directories
                base_captures_dir = os.path.abspath(os.path.join(current_dir, '../../auth_service/resource_security/public/captures'))
                if os.path.exists(base_captures_dir):
                    available_dirs = [d for d in os.listdir(base_captures_dir) if os.path.isdir(os.path.join(base_captures_dir, d))]
                
                yield {
                    "status": "error",
                    "message": f"Capture directory not found: {capture_dir}. Available directories: {available_dirs if 'available_dirs' in locals() else 'none'}",
                    "progress": 0,
                    "currentSet": 0,
                    "currentFile": ""
                }
                return
            
            # List files in capture directory for debugging
            try:
                capture_files = os.listdir(capture_dir)
            except Exception as e:
                logging.error(f"Error listing capture directory: {e}")
            
            # Ensure output directory exists
            if not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)
            
            # Process each set number in batches
            total_sets = len(set_numbers)
            processed_sets = []
            
            # Initial progress update
            update_progress(userId, 0, total_sets, processed_sets, "processing", "Starting processing...", "", 0)
            
            # Process images in batches of 6
            for batch_start in range(0, total_sets, batch_size):
                batch_end = min(batch_start + batch_size, total_sets)
                current_batch = set_numbers[batch_start:batch_end]
                batch_number = (batch_start // batch_size) + 1
                total_batches = (total_sets + batch_size - 1) // batch_size
                
                print(f"🔄 Processing batch {batch_number}/{total_batches} (sets {batch_start + 1}-{batch_end})")
                
                # Update progress for batch start
                update_progress(userId, batch_start + 1, total_sets, processed_sets, "processing", 
                              f"Processing batch {batch_number}/{total_batches} (sets {batch_start + 1}-{batch_end})", "", batch_start)
                
                yield {
                    "status": "processing",
                    "message": f"Processing batch {batch_number}/{total_batches} (sets {batch_start + 1}-{batch_end})",
                    "progress": int((batch_start / total_sets) * 100),
                    "currentSet": batch_start + 1,
                    "currentFile": f"Batch {batch_number}/{total_batches}"
                }
                
                # Process each image in the current batch
                for i, set_num in enumerate(current_batch):
                    global_index = batch_start + i
                    try:
                        # Update progress - use global_index+1 for 1-based progress calculation
                        current_file = f"webcam_{set_num:03d}.jpg"
                        
                        # Calculate progress for yield (1-based)
                        progress_percentage = int(((global_index + 1) / total_sets) * 100)
                        
                        # Update progress file with current index (global_index is 0-based, so global_index+1 gives us 1-based progress)
                        update_progress(userId, set_num, total_sets, processed_sets, "processing", 
                                      f"Processing set {set_num} ({global_index + 1}/{total_sets}) in batch {batch_number}/{total_batches}", current_file, global_index)
                        
                        yield {
                            "status": "processing",
                            "message": f"Processing set {set_num} ({global_index + 1}/{total_sets}) in batch {batch_number}/{total_batches}",
                            "progress": progress_percentage,
                            "currentSet": set_num,
                            "currentFile": current_file
                        }
                        
                        # Process webcam image - check for both webcam and webcam_sub files
                        webcam_src = os.path.join(capture_dir, f'webcam_{set_num:03d}.jpg')
                        webcam_sub_src = os.path.join(capture_dir, f'webcam_sub_{set_num:03d}.jpg')
                        
                        # Determine which webcam file to use (prefer main webcam, fallback to webcam_sub)
                        webcam_file_to_use = None
                        webcam_file_type = ""
                        
                        if os.path.exists(webcam_src):
                            webcam_file_to_use = webcam_src
                            webcam_file_type = "webcam"
                        elif os.path.exists(webcam_sub_src):
                            webcam_file_to_use = webcam_sub_src
                            webcam_file_type = "webcam_sub"
                        
                        if webcam_file_to_use is None:
                            # List available webcam files for debugging
                            webcam_files = [f for f in capture_files if f.startswith('webcam_')]
                            logging.warning(f"Webcam files not found for set {set_num}")
                            logging.warning(f"Available webcam files: {webcam_files}")
                        
                            # Update progress for skipped file
                            update_progress(userId, set_num, total_sets, processed_sets, "warning", 
                                          f"Skipped set {set_num}: No webcam image found", f"webcam_{set_num:03d}.jpg", global_index)
                        
                            yield {
                                "status": "warning",
                                "message": f"Skipping set {set_num}: No webcam image found (checked webcam_{set_num:03d}.jpg and webcam_sub_{set_num:03d}.jpg). Available webcam files: {webcam_files}",
                                "progress": progress_percentage,
                                "currentSet": set_num,
                                "currentFile": f"webcam_{set_num:03d}.jpg"
                            }
                            continue
                        
                        # Set destination path based on file type and enhanceFace setting
                        if enhanceFace:
                            webcam_dst = os.path.join(output_dir, f'{webcam_file_type}_enhance_{set_num:03d}.jpg')
                        else:
                            webcam_dst = os.path.join(output_dir, f'{webcam_file_type}_{set_num:03d}.jpg')
                        
                        # Read and process the image
                        image = cv2.imread(webcam_file_to_use)
                        
                        # Validate the image
                        if is_empty_image(image):
                            yield {
                                "status": "warning",
                                "message": f"Skipping set {set_num}: Could not read image",
                                "progress": progress_percentage,
                                "currentSet": set_num,
                                "currentFile": f"webcam_{set_num:03d}.jpg"
                            }
                            continue
                            
                        if is_black_image(image):
                            yield {
                                "status": "warning",
                                "message": f"Skipping set {set_num}: Black image detected",
                                "progress": progress_percentage,
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
                            # isEnhanceFace=True
                            isEnhanceFace=enhanceFace
                        )
                        
                        # Save the processed image
                        cv2.imwrite(webcam_dst, processed_image)
                        
                        # Copy screen image
                        screen_src = os.path.join(capture_dir, f'screen_{set_num:03d}.jpg')
                        screen_dst = os.path.join(output_dir, f'screen_enhance_{set_num:03d}.jpg' if enhanceFace else f'screen_{set_num:03d}.jpg')
                        
                        if os.path.exists(screen_src):
                            with open(screen_src, 'rb') as src, open(screen_dst, 'wb') as dst:
                                dst.write(src.read())
                        
                        # Copy webcam_sub image if it exists AND wasn't already processed
                        webcam_sub_src = os.path.join(capture_dir, f'webcam_sub_{set_num:03d}.jpg')
                        if os.path.exists(webcam_sub_src) and webcam_file_type != "webcam_sub":
                            if enhanceFace:
                                webcam_sub_dst = os.path.join(output_dir, f'webcam_sub_enhance_{set_num:03d}.jpg')
                            else:
                                webcam_sub_dst = os.path.join(output_dir, f'webcam_sub_{set_num:03d}.jpg')
                            
                            with open(webcam_sub_src, 'rb') as src, open(webcam_sub_dst, 'wb') as dst:
                                dst.write(src.read())
                        
                        # Add to processed sets
                        processed_sets.append(set_num)
                        
                        # Update progress for successful completion
                        update_progress(userId, set_num, total_sets, processed_sets, "processing", 
                                      f"Completed set {set_num} ({len(processed_sets)}/{total_sets})", current_file, global_index)
                        
                        # Also yield progress update for immediate frontend update
                        yield {
                            "status": "processing",
                            "message": f"Completed set {set_num} ({len(processed_sets)}/{total_sets})",
                            "progress": int(((global_index + 1) / total_sets) * 100),
                            "currentSet": set_num,
                            "currentFile": current_file
                        }
                        
                        # Update parameter file with new metrics
                        param_src = os.path.join(capture_dir, f'parameter_{set_num:03d}.csv')
                        param_dst = os.path.join(output_dir, f'parameter_enhance_{set_num:03d}.csv' if enhanceFace else f'parameter_{set_num:03d}.csv')
                        
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
                            
                            # 1. Add head pose angles
                            if hasattr(metrics, 'head_pose_angles') and metrics.head_pose_angles is not None:
                                pitch, yaw, roll = metrics.head_pose_angles
                                dst.write(f"pitch,{round(pitch, 3)}\n")
                                dst.write(f"yaw,{round(yaw, 3)}\n")
                                dst.write(f"roll,{round(roll, 3)}\n")
                            
                            # 2. Add face_box (face bounding box)
                            if hasattr(metrics, 'face_box') and metrics.face_box is not None:
                                try:
                                    min_pos, max_pos = metrics.face_box
                                    min_x, min_y = min_pos
                                    max_x, max_y = max_pos
                                    dst.write(f"face_min_position_x,{int(min_x)}\n")
                                    dst.write(f"face_min_position_y,{int(min_y)}\n")
                                    dst.write(f"face_max_position_x,{int(max_x)}\n")
                                    dst.write(f"face_max_position_y,{int(max_y)}\n")
                                except Exception as e:
                                    print(f"Error extracting face box: {e}")
                            
                            # 3. Add left_eye_box
                            if hasattr(metrics, 'left_eye_box') and metrics.left_eye_box is not None:
                                try:
                                    min_left, max_left = metrics.left_eye_box
                                    min_x, min_y = min_left
                                    max_x, max_y = max_left
                                    dst.write(f"left_eye_box_min_x,{int(min_x)}\n")
                                    dst.write(f"left_eye_box_min_y,{int(min_y)}\n")
                                    dst.write(f"left_eye_box_max_x,{int(max_x)}\n")
                                    dst.write(f"left_eye_box_max_y,{int(max_y)}\n")
                                except Exception as e:
                                    print(f"Error extracting left eye box: {e}")
                            
                            # 4. Add right_eye_box
                            if hasattr(metrics, 'right_eye_box') and metrics.right_eye_box is not None:
                                try:
                                    min_right, max_right = metrics.right_eye_box
                                    min_x, min_y = min_right
                                    max_x, max_y = max_right
                                    dst.write(f"right_eye_box_min_x,{int(min_x)}\n")
                                    dst.write(f"right_eye_box_min_y,{int(min_y)}\n")
                                    dst.write(f"right_eye_box_max_x,{int(max_x)}\n")
                                    dst.write(f"right_eye_box_max_y,{int(max_y)}\n")
                                except Exception as e:
                                    print(f"Error extracting right eye box: {e}")
                            
                            # 5. Add eye_iris_center
                            if hasattr(metrics, 'eye_iris_center') and metrics.eye_iris_center is not None:
                                try:
                                    left_iris, right_iris = metrics.eye_iris_center
                                    dst.write(f"left_iris_center_x,{int(left_iris[0])}\n")
                                    dst.write(f"left_iris_center_y,{int(left_iris[1])}\n")
                                    dst.write(f"right_iris_center_x,{int(right_iris[0])}\n")
                                    dst.write(f"right_iris_center_y,{int(right_iris[1])}\n")
                                except Exception as e:
                                    print(f"Error extracting iris centers: {e}")
                            
                            # 6. Add eye_iris boxes
                            if hasattr(metrics, 'eye_iris_left_box') and metrics.eye_iris_left_box is not None:
                                try:
                                    min_left, max_left = metrics.eye_iris_left_box
                                    min_x, min_y = min_left
                                    max_x, max_y = max_left
                                    dst.write(f"left_iris_box_min_x,{int(min_x)}\n")
                                    dst.write(f"left_iris_box_min_y,{int(min_y)}\n")
                                    dst.write(f"left_iris_box_max_x,{int(max_x)}\n")
                                    dst.write(f"left_iris_box_max_y,{int(max_y)}\n")
                                except Exception as e:
                                    print(f"Error extracting left iris box: {e}")
                            
                            if hasattr(metrics, 'eye_iris_right_box') and metrics.eye_iris_right_box is not None:
                                try:
                                    min_right, max_right = metrics.eye_iris_right_box
                                    min_x, min_y = min_right
                                    max_x, max_y = max_right
                                    dst.write(f"right_iris_box_min_x,{int(min_x)}\n")
                                    dst.write(f"right_iris_box_min_y,{int(min_y)}\n")
                                    dst.write(f"right_iris_box_max_x,{int(max_x)}\n")
                                    dst.write(f"right_iris_box_max_y,{int(max_y)}\n")
                                except Exception as e:
                                    print(f"Error extracting right iris box: {e}")
                            
                            # 7. Add eye_centers
                            if hasattr(metrics, 'eye_centers') and metrics.eye_centers is not None:
                                try:
                                    eye_centers = metrics.eye_centers
                                    if len(eye_centers) > 0:
                                        left_eye = eye_centers[0]
                                        dst.write(f"left_eye_position_x,{int(left_eye[0])}\n")
                                        dst.write(f"left_eye_position_y,{int(left_eye[1])}\n")
                                    
                                    if len(eye_centers) > 1:
                                        right_eye = eye_centers[1]
                                        dst.write(f"right_eye_position_x,{int(right_eye[0])}\n")
                                        dst.write(f"right_eye_position_y,{int(right_eye[1])}\n")
                                    
                                    if len(eye_centers) > 2:
                                        mid_eye = eye_centers[2]
                                        dst.write(f"center_between_eyes_x,{int(mid_eye[0])}\n")
                                        dst.write(f"center_between_eyes_y,{int(mid_eye[1])}\n")
                                except Exception as e:
                                    print(f"Error extracting eye centers: {e}")
                            
                            # 8. Add landmark positions
                            if hasattr(metrics, 'landmark_positions') and metrics.landmark_positions is not None:
                                try:
                                    landmarks = metrics.landmark_positions
                                    
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
                                    
                                    # Add the specific named parameters if this landmark is in our mapping
                                    for landmark_name, landmark_position in landmarks.items():
                                        if landmark_name in landmark_mapping:
                                            x_key, y_key = landmark_mapping[landmark_name]
                                            dst.write(f"{x_key},{int(landmark_position[0])}\n")
                                            dst.write(f"{y_key},{int(landmark_position[1])}\n")
                                except Exception as e:
                                    print(f"Error extracting landmarks: {e}")
                            
                            # 9. Add eye states
                            if hasattr(metrics, 'left_eye_state') and metrics.left_eye_state is not None:
                                try:
                                    state, ear = metrics.left_eye_state
                                    dst.write(f"left_eye_state,{state}\n")
                                    dst.write(f"left_eye_ear,{round(ear, 3)}\n")
                                except Exception as e:
                                    print(f"Error extracting left eye state: {e}")
                            
                            if hasattr(metrics, 'right_eye_state') and metrics.right_eye_state is not None:
                                try:
                                    state, ear = metrics.right_eye_state
                                    dst.write(f"right_eye_state,{state}\n")
                                    dst.write(f"right_eye_ear,{round(ear, 3)}\n")
                                except Exception as e:
                                    print(f"Error extracting right eye state: {e}")
                            
                            # 10. Add depth information
                            if hasattr(metrics, 'depths') and metrics.depths is not None:
                                try:
                                    face_depth, left_eye_depth, right_eye_depth, chin_depth = metrics.depths
                                    dst.write(f"distance_cm_from_face,{round(face_depth, 3)}\n")
                                    dst.write(f"distance_cm_from_eye,{round(float((left_eye_depth + right_eye_depth) / 2), 3)}\n")
                                    dst.write(f"chin_depth,{round(chin_depth, 3)}\n")
                                except Exception as e:
                                    print(f"Error extracting depth information: {e}")
                            
                            # 11. Add derived parameters like posture and gaze direction
                            if hasattr(metrics, 'head_pose_angles') and metrics.head_pose_angles is not None:
                                pitch, yaw, roll = metrics.head_pose_angles
                                
                                # Determine posture based on pitch
                                posture = "Looking Straight"
                                if pitch > 10:
                                    posture = "Looking Down"
                                elif pitch < -10:
                                    posture = "Looking Up"
                                    
                                dst.write(f"posture,{posture}\n")
                                
                                # Determine gaze direction based on yaw
                                gaze_direction = "Looking Straight"
                                if yaw > 10:
                                    gaze_direction = "Looking Right"
                                elif yaw < -10:
                                    gaze_direction = "Looking Left"
                                    
                                dst.write(f"gaze_direction,{gaze_direction}\n")
                            
                            # Add processing timestamp
                            dst.write(f"processing_time,{datetime.now().isoformat()}\n")
                    
                    except Exception as e:
                        logging.error(f"Error processing set {set_num}: {str(e)}")
                        
                        # Update progress for error
                        update_progress(userId, set_num, total_sets, processed_sets, "error", 
                                      f"Error processing set {set_num}: {str(e)}", current_file, global_index)
                        
                        yield {
                            "status": "error",
                            "message": f"Error processing set {set_num}: {str(e)}",
                            "progress": progress_percentage,
                            "currentSet": set_num,
                            "currentFile": f"webcam_{set_num:03d}.jpg"
                        }
                        continue
                
                # Batch completion message
                batch_completed_count = len([s for s in processed_sets if s in current_batch])
                print(f"✅ Completed batch {batch_number}/{total_batches} - processed {batch_completed_count}/{len(current_batch)} images")
                
                # Update progress for batch completion
                update_progress(userId, current_batch[-1] if current_batch else 0, total_sets, processed_sets, "processing", 
                              f"Completed batch {batch_number}/{total_batches} ({len(processed_sets)}/{total_sets} total)", "", batch_end - 1)
                
                yield {
                    "status": "batch_completed",
                    "message": f"Completed batch {batch_number}/{total_batches} - processed {batch_completed_count}/{len(current_batch)} images",
                    "progress": int((batch_end / total_sets) * 100),
                    "currentSet": current_batch[-1] if current_batch else 0,
                    "currentFile": f"Batch {batch_number}/{total_batches} completed"
                }
            
            # Final success message
            update_progress(userId, set_numbers[-1] if set_numbers else 0, total_sets, processed_sets, 
                          "completed", f"All images processed successfully ({len(processed_sets)}/{total_sets})", "", len(set_numbers) - 1)
            
            yield {
                "status": "completed",
                "message": "All images processed successfully",
                "progress": 100,
                "currentSet": set_numbers[-1],
                "currentFile": f"webcam_{set_numbers[-1]:03d}.jpg"
            }
        
        else:
            yield {"success": False, "error": "No set_numbers provided for batch processing"}
    
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