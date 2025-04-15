#!/usr/bin/env python3
# backend/process_images.py

import os
import sys
import argparse
import time
import shutil
from datetime import datetime
import mediapipe as mp
import cv2
import numpy as np

# Import the face tracking class
from Main_model02.showframeVisualization import FrameShow_head_face

def process_set(set_number, capture_path, enhance_path, face_tracker):
    """Process a set of images (webcam, screen, parameters)"""
    print(f"Processing set {set_number}")
    
    # File paths
    webcam_file = os.path.join(capture_path, f"webcam_{set_number}.jpg")
    screen_file = os.path.join(capture_path, f"screen_{set_number}.jpg")
    
    # Check for parameters file (can be named either way)
    param_file = os.path.join(capture_path, f"parameters_{set_number}.csv")
    if not os.path.exists(param_file):
        param_file = os.path.join(capture_path, f"parameter_{set_number}.csv")
    
    # Check that all files exist
    missing_files = []
    if not os.path.exists(webcam_file):
        missing_files.append(f"webcam_{set_number}.jpg")
    if not os.path.exists(screen_file):
        missing_files.append(f"screen_{set_number}.jpg")
    if not os.path.exists(param_file):
        missing_files.append(f"parameters_{set_number}.csv or parameter_{set_number}.csv")
    
    if missing_files:
        print(f"Warning: Missing files for set {set_number}: {', '.join(missing_files)}")
        print(f"Capture path being checked: {capture_path}")
        return False
    
    try:
        # Process webcam image
        print(f"Processing webcam image: {webcam_file}")
        webcam_frame = cv2.imread(webcam_file)
        if webcam_frame is None:
            print(f"Error: Could not read webcam image from {webcam_file}")
            return False
        
        # Process the webcam frame
        timestamp_ms = int(time.time() * 1000)
        metrics, processed_webcam = face_tracker.process_frame(
            webcam_frame, 
            timestamp_ms, 
            isVideo=False, 
            isEnhanceFace=True
        )
        
        # Save the processed webcam image
        webcam_enhance_file = os.path.join(enhance_path, f"webcam_enhance_{set_number}.jpg")
        cv2.imwrite(webcam_enhance_file, processed_webcam)
        print(f"Saved processed webcam image to: {webcam_enhance_file}")
        
        # Simply copy the screen image (no processing)
        screen_enhance_file = os.path.join(enhance_path, f"screen_enhance_{set_number}.jpg")
        shutil.copy2(screen_file, screen_enhance_file)
        print(f"Copied screen image to: {screen_enhance_file}")
        
        # Process parameters file - add face tracking metrics
        with open(param_file, 'r') as f:
            param_content = f.read()
        
        param_enhance_file = os.path.join(enhance_path, f"parameters_enhance_{set_number}.csv")
        
        with open(param_enhance_file, 'w') as f:
            f.write(param_content)
            f.write(f"\n# Enhanced at: {datetime.now().isoformat()}\n")
            
            if metrics is not None:
                # Add head pose metrics
                pitch, yaw, roll = metrics.head_pose_angles
                f.write(f"# Head Pose - Pitch: {pitch:.2f}, Yaw: {yaw:.2f}, Roll: {roll:.2f}\n")
                
                # Add eye centers if available
                if hasattr(metrics, 'eye_centers') and metrics.eye_centers is not None:
                    left_eye = metrics.eye_centers[0].tolist() if len(metrics.eye_centers) > 0 else None
                    right_eye = metrics.eye_centers[1].tolist() if len(metrics.eye_centers) > 1 else None
                    f.write(f"# Eye Centers - Left: {left_eye}, Right: {right_eye}\n")
            else:
                f.write("# No face detected in the webcam image\n")
        
        print(f"Updated parameters file: {param_enhance_file}")
        print(f"Set {set_number} processed successfully")
        return True
        
    except Exception as e:
        print(f"Error processing set {set_number}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def find_project_root():
    """
    Try to find the project root directory based on common markers.
    This helps ensure correct path resolution regardless of where the script is run from.
    """
    # Start from the current directory
    current_dir = os.getcwd()
    
    # Check if we're already in a directory that contains the expected folders
    if os.path.exists(os.path.join(current_dir, 'public', 'captures')):
        return current_dir
    
    # Check if we're in the backend directory
    if os.path.basename(current_dir) == 'backend':
        parent_dir = os.path.dirname(current_dir)
        if os.path.exists(os.path.join(parent_dir, 'public', 'captures')):
            return parent_dir
    
    # Check parent directories
    parent_dir = os.path.dirname(current_dir)
    if os.path.exists(os.path.join(parent_dir, 'public', 'captures')):
        return parent_dir
    
    # If all else fails, return the current directory and log a warning
    print("Warning: Could not determine project root directory")
    return current_dir

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Process eye tracking images')
    parser.add_argument('--sets', type=str, help='Comma-separated list of set numbers to process')
    parser.add_argument('--lock', type=str, help='Path to lock file')
    parser.add_argument('--root', type=str, help='Path to project root directory')
    args = parser.parse_args()
    
    try:
        # Determine project root directory
        project_root = args.root if args.root else find_project_root()
        print(f"Project root: {project_root}")
        
        # Get set numbers to process
        set_numbers = args.sets.split(',') if args.sets else []
        print(f"Processing sets: {set_numbers}")
        
        # Define paths relative to the project root
        capture_path = os.path.join(project_root, 'public', 'captures', 'eye_tracking_captures')
        enhance_path = os.path.join(project_root, 'public', 'captures', 'enhance')
        model_path = os.path.join(project_root, 'Main_model02', 'face_landmarker.task')
        
        print(f"Capture path: {capture_path}")
        print(f"Enhance path: {enhance_path}")
        print(f"Model path: {model_path}")
        
        # Verify directories exist
        if not os.path.exists(capture_path):
            print(f"Error: Capture directory does not exist: {capture_path}")
            sys.exit(1)
            
        # Make sure enhance directory exists
        os.makedirs(enhance_path, exist_ok=True)
        
        # Verify model path
        if not os.path.exists(model_path):
            # Try alternative location
            model_path = os.path.join(project_root, 'backend', 'Main_model02', 'face_landmarker.task')
            print(f"Alternative model path: {model_path}")
            
            if not os.path.exists(model_path):
                print(f"Error: Face landmarker model not found at: {model_path}")
                print("Please ensure the model file is in the correct location.")
                sys.exit(1)
        
        # Initialize the face tracker (once for all images)
        print(f"Initializing face tracker with model: {model_path}")
        face_tracker = FrameShow_head_face(
            model_path=model_path,
            isVideo=False,  # Set to False for static image processing
            isHeadposeOn=True,
            isFaceOn=True
        )
        
        # Configure face tracker settings
        face_tracker.set_labet_face_element(False)  # Show parameters
        face_tracker.set_IsShowBox(False)           # Show bounding box
        face_tracker.set_IsShowHeadpose(False)      # Show head pose visualization
        face_tracker.set_IsMaskOn(False)           # Don't show face mask
        
        # Process each set
        successful_sets = 0
        for set_number in set_numbers:
            if process_set(set_number, capture_path, enhance_path, face_tracker):
                successful_sets += 1
                
        print(f"Processing completed: {successful_sets} out of {len(set_numbers)} sets processed successfully")
    except Exception as e:
        print(f"Error during processing: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        # Always remove the lock file when done
        if args.lock and os.path.exists(args.lock):
            try:
                os.remove(args.lock)
                print(f"Removed lock file: {args.lock}")
            except Exception as e:
                print(f"Warning: Could not remove lock file {args.lock}: {e}")

if __name__ == "__main__":
    main()