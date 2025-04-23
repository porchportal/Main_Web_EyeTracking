# process_video.py - Handle video processing for face tracking
import cv2
import numpy as np
import base64
from fastapi import UploadFile
import tempfile
import os
import asyncio
from typing import Dict, Any, List

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



# Initialize face tracker specifically for video processing
video_face_tracker = None  # Will be initialized on first use

def get_video_face_tracker():
    """
    Initialize the video face tracker if not already initialized
    """
    global video_face_tracker
    if video_face_tracker is None:
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
            
        # print(f"Initializing video face tracker with model: {model_path}")
        video_face_tracker = FrameShow_head_face(
            # model_path=model_path,
            isVideo=True,  # Set to True for video processing
            isHeadposeOn=True,
            isFaceOn=True
        )
        
    return video_face_tracker

async def process_video_handler(
    file: UploadFile,
    show_head_pose: bool = False,
    show_bounding_box: bool = False,
    show_mask: bool = False,
    show_parameters: bool = False
) -> Dict[str, Any]:
    """
    Process a video file for face tracking and analysis
    
    Args:
        file: The uploaded video file
        show_head_pose: Whether to visualize head pose
        show_bounding_box: Whether to show face bounding box
        show_mask: Whether to show face mask visualization
        show_parameters: Whether to show detection parameters
        
    Returns:
        Dict with processing results including metrics and processed frames data
    """
    tmp_path = None
    try:
        # Log the incoming request details
        print(f"Processing video: {file.filename}")
        print(f"Parameters: head_pose={show_head_pose}, bounding_box={show_bounding_box}, mask={show_mask}, params={show_parameters}")
        
        # Get the face tracker
        face_tracker = get_video_face_tracker()
        
        # Configure the face tracker based on parameters
        face_tracker.set_IsShowHeadpose(show_head_pose)
        face_tracker.set_IsShowBox(show_bounding_box)
        face_tracker.set_IsMaskOn(show_mask)
        face_tracker.set_labet_face_element(show_parameters)
        
        # Create a temporary file to save the uploaded video
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
            # Write the uploaded file to the temporary file
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
            print(f"Saved to temporary file: {tmp_path}")
        
        # Open the video file
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            return {"success": False, "error": "Could not open video file"}
        
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        print(f"Video properties: {width}x{height}, {fps} fps, {frame_count} frames")
        
        # Prepare result containers
        all_metrics = []
        processed_frames = []
        face_detection_stats = {"detected": 0, "not_detected": 0}
        
        # Process video frames (limited to first 300 frames to avoid memory issues)
        max_frames = min(300, frame_count)
        current_frame = 0
        
        while current_frame < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
                
            # Store original frame dimensions
            original_height, original_width = frame.shape[:2]
            
            # Make a copy of the frame for processing
            process_frame = frame.copy()
            
            # Process frame with face tracker
            timestamp_ms = int(1000 * current_frame / fps)
            metrics, processed_frame = face_tracker.process_frame(
                process_frame,
                timestamp_ms,
                isVideo=True,
                isEnhanceFace=True
            )
            
            # Check processed frame dimensions
            processed_height, processed_width = processed_frame.shape[:2]
            
            # Log if dimensions changed but don't resize them back
            if processed_width != original_width or processed_height != original_height:
                print(f"Frame {current_frame}: Dimensions changed during processing: Original ({original_width}x{original_height}) → Processed ({processed_width}x{processed_height})")
                # We're intentionally NOT resizing the image back to preserve the model's output dimensions
            
            # Check if face was detected and update stats
            if metrics is not None:
                face_detection_stats["detected"] += 1
                frame_metrics = {
                    "timestamp": timestamp_ms,
                    "frame_number": current_frame,
                    "face_detected": True,
                    "head_pose": {
                        "pitch": round(metrics.head_pose_angles[0], 2),
                        "yaw": round(metrics.head_pose_angles[1], 2),
                        "roll": round(metrics.head_pose_angles[2], 2)
                    }
                }
                # Add eye centers if available
                if hasattr(metrics, 'eye_centers') and metrics.eye_centers is not None:
                    try:
                        frame_metrics["eye_centers"] = {
                            "left": np.array(metrics.eye_centers[0]).tolist() if len(metrics.eye_centers) > 0 else None,
                            "right": np.array(metrics.eye_centers[1]).tolist() if len(metrics.eye_centers) > 1 else None
                        }
                    except AttributeError:
                        frame_metrics["eye_centers"] = {
                            "left": list(metrics.eye_centers[0]) if len(metrics.eye_centers) > 0 else None,
                            "right": list(metrics.eye_centers[1]) if len(metrics.eye_centers) > 1 else None
                        }
                
                all_metrics.append(frame_metrics)
            else:
                face_detection_stats["not_detected"] += 1
                all_metrics.append({
                    "timestamp": timestamp_ms,
                    "frame_number": current_frame,
                    "face_detected": False
                })
                
                # We'll still use the processed frame even if no face was detected
                # This allows any visualization or modifications from the model to be preserved
            
            # Convert frame to base64 (for key frames only to reduce data size)
            if current_frame % 10 == 0:  # Store every 10th frame
                _, buffer = cv2.imencode('.jpg', processed_frame)
                img_str = base64.b64encode(buffer).decode('utf-8')
                processed_frames.append({
                    "frame": current_frame,
                    "image": img_str,
                    "width": processed_width,
                    "height": processed_height
                })
            
            current_frame += 1
            # Allow other asyncio tasks to run
            if current_frame % 10 == 0:
                await asyncio.sleep(0.001)
        
        # Close the video capture
        cap.release()
        
        # Calculate summary statistics
        detection_rate = 0
        if current_frame > 0:
            detection_rate = face_detection_stats["detected"] / current_frame * 100
            
        # Check if we have any face detections
        if face_detection_stats["detected"] > 0:
            return {
                "success": True,
                "video_info": {
                    "fps": fps,
                    "frame_count": frame_count,
                    "processed_frames": current_frame,
                    "width": width,
                    "height": height
                },
                "detection_summary": {
                    "detection_rate": round(detection_rate, 2),
                    "frames_with_face": face_detection_stats["detected"],
                    "frames_without_face": face_detection_stats["not_detected"]
                },
                "metrics": all_metrics,
                "keyframes": processed_frames  # Only include key frames
            }
        else:
            return {
                "success": True,
                "video_info": {
                    "fps": fps,
                    "frame_count": frame_count,
                    "processed_frames": current_frame,
                    "width": width,
                    "height": height
                },
                "detection_summary": {
                    "detection_rate": 0,
                    "frames_with_face": 0,
                    "frames_without_face": current_frame
                },
                "message": "No faces detected in the video"
            }
    
    except Exception as e:
        print(f"Error processing video: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return {"success": False, "error": f"Error processing video: {str(e)}"}
    
    finally:
        # Clean up the temporary file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
                print(f"Temporary file removed: {tmp_path}")
            except Exception as e:
                print(f"Warning: Failed to remove temporary file: {e}")