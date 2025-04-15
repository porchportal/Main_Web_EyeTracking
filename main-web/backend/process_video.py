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
from Main_model02.showframeVisualization import FrameShow_head_face

# Initialize face tracker specifically for video processing
video_face_tracker = FrameShow_head_face(
    model_path='Main_model02/face_landmarker.task',
    isVideo=True,  # Set to True for video processing
    isHeadposeOn=True,
    isFaceOn=True
)

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
    # Configure the face tracker based on parameters
    video_face_tracker.set_IsShowHeadpose(show_head_pose)
    video_face_tracker.set_IsShowBox(show_bounding_box)
    video_face_tracker.set_IsMaskOn(show_mask)
    video_face_tracker.set_labet_face_element(show_parameters)
    
    # Create a temporary file to save the uploaded video
    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
        # Write the uploaded file to the temporary file
        content = await file.read()
        tmp_file.write(content)
        tmp_path = tmp_file.name
    
    try:
        # Open the video file
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            return {"success": False, "error": "Could not open video file"}
        
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
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
                
            # Process frame with face tracker
            timestamp_ms = int(1000 * current_frame / fps)
            metrics, processed_frame = video_face_tracker.process_frame(
                frame,
                timestamp_ms,
                isVideo=True,
                isEnhanceFace=True
            )
            
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
                    frame_metrics["eye_centers"] = {
                        "left": metrics.eye_centers[0].tolist(),
                        "right": metrics.eye_centers[1].tolist()
                    }
                
                all_metrics.append(frame_metrics)
            else:
                face_detection_stats["not_detected"] += 1
                all_metrics.append({
                    "timestamp": timestamp_ms,
                    "frame_number": current_frame,
                    "face_detected": False
                })
            
            # Convert frame to base64 (for key frames only to reduce data size)
            if current_frame % 10 == 0:  # Store every 10th frame
                _, buffer = cv2.imencode('.jpg', processed_frame)
                img_str = base64.b64encode(buffer).decode('utf-8')
                processed_frames.append({
                    "frame": current_frame,
                    "image": img_str
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
        return {"success": False, "error": f"Error processing video: {str(e)}"}
    
    finally:
        # Clean up the temporary file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)