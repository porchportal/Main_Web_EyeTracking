import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
# from mediapipe.tasks.python import BaseOptions
import math
from dataclasses import dataclass
from typing import Tuple, List, Dict, Optional

from .headpose_outCV import HeadPoseTracker01
from .facetrack_outCV import FaceTracker01
from .UpResolution import FaceEnhancer

from PIL import Image
from torchvision.transforms import functional as F
import torch
from mediapipe import Image
import os
import sys
# current_dir = os.path.dirname(os.path.abspath(__file__))
# if current_dir not in sys.path:
#     sys.path.append(current_dir)
# from .headpose_outCV import HeadPoseTracker01
# from .facetrack_outCV import FaceTracker01

@dataclass
class all_data_output:
    head_pose_angles: Tuple[float, float, float]
    
    # face_box_enhance: Tuple[int, int]  # (min_x, min_y), (max_x, max_y)
    # face_width_height_enhance: Tuple[int, int]
    
    face_box: Tuple[int, int]  # (min_x, min_y), (max_x, max_y)
    left_eye_box: Tuple[int, int]
    right_eye_box: Tuple[int, int]
    
    # eye_iris_center=(left_iris_center, right_iris_center),
    eye_iris_center: Tuple[int, int]  # left, right
    eye_iris_left_box: Tuple[int, int] # min_left_iris, max_left_iris
    eye_iris_right_box: Tuple[int, int] # min_right_iris, max_right_iris
    
    eye_centers: Tuple[Tuple[int, int], Tuple[int, int],
                       Tuple[int, int]]  # left, right, mid
    
    landmark_positions: Dict[str, Tuple[int, int]]
    left_eye_state: Tuple[str, float]  # (state, EAR)
    right_eye_state: Tuple[str, float]
    # face, left_eye, right_eye, chin
    depths: Tuple[float, float, float, float]


class FrameShow_head_face:
    def __init__(self, model_path: str = 'face_landmarker.task', isVideo =True, position_base_3d: Tuple[int, int] = (960, 540), isHeadposeOn: bool = False, isFaceOn: bool = False):
        # self.show_visualization = show_visualization
        # self.numYaxis_labels = numYaxis_labels
        # self.position_base_3d = position_base_3d
        self.isVideo = isVideo
        base_options = mp.tasks.BaseOptions(
            model_asset_path=model_path,
            # delegate=python.BaseOptions.Delegate.GPU
        )
        options = mp.tasks.vision.FaceLandmarkerOptions(
            base_options=base_options,
            running_mode= mp.tasks.vision.RunningMode.VIDEO if self.isVideo else mp.tasks.vision.RunningMode.IMAGE,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=True,
            num_faces=1,
            min_face_detection_confidence=0.6, 
            min_face_presence_confidence=0.6,  
            min_tracking_confidence=0.6  
        )
        self.detector = mp.tasks.vision.FaceLandmarker.create_from_options(options)
        
        
        self.enhancer = FaceEnhancer(
            # model_name='RealESRGAN_x4plus', 
            model_name='realesr-general-x4v3', 
            denoise_strength=0.8,  
            outscale=4,
            fp32=True,
            face_enhance=False    
        )
        
        self.isHeadposeOn = isHeadposeOn
        self.isFaceOn = isFaceOn
        self.isEnhanceFace = False
        
        self.face_Label_display = False
        self.Face_bounding_box = False
        self.Head_isMaskOn = False
        self.draw_headpose = False
        self.isZoomFace = False
        
        self.arrow_length = 200
        
        
        self.tracker_headpose = HeadPoseTracker01(model_path= model_path, isVideo= self.isVideo)
        self.tracker_face = FaceTracker01(model_path= model_path, isVideo= self.isVideo)
    
    
    def y_update(self, y_pos):
        self.last_y_value = y_pos
        return y_pos + 40
    
    def _draw_visualization(self, face_landmarks, frame: np.ndarray, metrics: all_data_output)-> np.ndarray:
        """Draw all visualizations on the frame"""
        # Draw landmarks and their coordinates
        y_pos = 70
        if hasattr(metrics, 'landmark_positions') and metrics.landmark_positions is not None:
            for name, pos in metrics.landmark_positions.items():
                if self.face_Label_display:
                    cv2.circle(frame, pos, 3, (0, 0, 255), -1)
                    cv2.putText(frame, f"{name}: {pos}", (10, y_pos),
                                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 3)
                    y_pos = self.y_update(y_pos)
        else:
            print("Warning: Missing required facial landmarks.")

        # Draw eye info with green color (like in the image)
        left_eye_color = (0, 255, 0)  # Green color for eye information
        y_pos = 310  # Starting position for eye information
        # Eye states
        left_state, left_ear = metrics.left_eye_state
        right_state, right_ear = metrics.right_eye_state
        
        def eyes_state(eye_state):
            if eye_state == "Closed":
                return (0, 0, 255)  # Red for closed eyes
            elif eye_state == "Squinting":
                return (0, 165, 255)
            else:
                return (160, 240, 130)
            
        if self.face_Label_display == True:
            # Add face box coordinates
            cv2.putText(frame,
                    f"Face: Min({metrics.face_box[0]}), Max({metrics.face_box[1]})",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 3)

            # Left eye coordinates
            cv2.putText(frame, f"Left eye: {metrics.eye_iris_center[0]}", (10, y_pos),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, left_eye_color, 3)
            y_pos = self.y_update(y_pos)

            # Right eye coordinates 
            cv2.putText(frame, f"Right eye: {metrics.eye_iris_center[1]}", (10, y_pos),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, left_eye_color, 3)
            y_pos = self.y_update(y_pos)

            # Left and right eye box
            cv2.putText(frame,
                        f"Left Box: Min({metrics.left_eye_box[0]}), Max({metrics.left_eye_box[1]})",
                        (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 1, left_eye_color, 3)
            y_pos = self.y_update(y_pos)
            cv2.putText(frame,
                        f"Right Box: Min({metrics.right_eye_box[0]}), Max({metrics.right_eye_box[1]})",
                        (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 1, left_eye_color, 3)
            y_pos = self.y_update(y_pos)
            
            # Left and right eye iris box
            cv2.putText(frame,
                    f"Left Iris Box: Min({ metrics.eye_iris_left_box[0]}), Max({ metrics.eye_iris_left_box[1]})",
                    (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 1, left_eye_color, 3)
            y_pos = self.y_update(y_pos)
            cv2.putText(frame,
                        f"Right Iris Box: Min({metrics.eye_iris_right_box[0]}), Max({metrics.eye_iris_right_box[1]})",
                        (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 1, left_eye_color, 3)
            y_pos = self.y_update(y_pos)
            
            # Left and right eye state
            cv2.putText(frame, f"(EAR: {left_ear:.3f}) Left Eye State: {left_state}",
                        (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 1, eyes_state(left_state), 3)
            y_pos = self.y_update(y_pos)

            cv2.putText(frame, f"(EAR: {right_ear:.3f}) Right Eye State: {right_state}",
                        (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 1, eyes_state(right_state), 3)
            y_pos = self.y_update(y_pos)

            # Eye socket centers
            cv2.putText(frame, f"Center left eye socket: {metrics.eye_centers[0]}",
                        (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 1, left_eye_color, 3)
            y_pos = self.y_update(y_pos)
            cv2.putText(frame, f"Center right eye socket: {metrics.eye_centers[1]}",
                        (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 1, left_eye_color, 3)
            y_pos = self.y_update(y_pos)
            cv2.putText(frame, f"Center between eye: {metrics.eye_centers[2]}",
                        (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 1, left_eye_color, 3)
            y_pos = self.y_update(y_pos)
            
            # Direction
            for landmark in face_landmarks:
                cv2.circle(frame, (int(landmark.x), int(landmark.y)), 2, (0, 255, 0), -1)
            
            pitch, yaw, roll = metrics.head_pose_angles
            cv2.putText(frame, f"Pitch: {pitch:.3f}",
                        (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 1, left_eye_color, 3)
            y_pos = self.y_update(y_pos)
            cv2.putText(frame, f"Yaw: {yaw:.3f}",
                        (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 1, left_eye_color, 3)
            y_pos = self.y_update(y_pos)
            cv2.putText(frame, f"Roll: {roll:.3f}",
                        (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 1, left_eye_color, 3)
            y_pos = self.y_update(y_pos)
            
        if self.Face_bounding_box == True:
            # face boces 
            cv2.rectangle(frame, metrics.face_box[0], metrics.face_box[1],
                        (0, 255, 0), 2)
            # Draw boxes
            cv2.rectangle(frame,
                        (metrics.left_eye_box[0]),
                        (metrics.left_eye_box[1]),
                        (0, 255, 0), 1)
            cv2.rectangle(frame,
                        (metrics.right_eye_box[0]),
                        (metrics.right_eye_box[1]),
                        (0, 255, 0), 1)
            cv2.rectangle(frame,
                    metrics.eye_iris_left_box[0],
                    metrics.eye_iris_left_box[1],
                    (0, 0, 255), 1)  # Red color 
            cv2.rectangle(frame,
                        metrics.eye_iris_right_box[0],
                        metrics.eye_iris_right_box[1],
                        (0, 0, 255), 1)  # Red color 
            
            # Draw iris centers and horizontal lines
            left_center = metrics.eye_iris_center[0]
            right_center = metrics.eye_iris_center[1]

            cv2.circle(frame, left_center, 2, (0, 0, 255), -1)
            cv2.line(frame,
                    (metrics.left_eye_box[0][0], left_center[1]),
                    (metrics.left_eye_box[1][0], left_center[1]),
                    (255, 0, 0), 1)

            # Right eye iris center and line
            cv2.circle(frame, right_center, 2, (0, 0, 255), -1)
            cv2.line(frame,
                    (metrics.right_eye_box[0][0], right_center[1]),
                    (metrics.right_eye_box[1][0], right_center[1]),
                    (255, 0, 0), 1)
        # Add depth measurements
        y_start = y_pos
        line_height = 40
        depths = ["Face", "Left Eye", "Right Eye", "Chin"]
        for i, (depth_name, depth_val) in enumerate(zip(depths, metrics.depths)):
            if self.face_Label_display == True:
                cv2.putText(frame, f"{depth_name} Depth: {depth_val} cm",
                            (10, y_start + i * line_height),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (122, 234, 255), 3)

        return frame
    
    def get_draw_mask_face(self, frame, face_landmarks):
        h, w = frame.shape[:2]
        for landmark in face_landmarks:
            x = int(landmark.x * w)
            y = int(landmark.y * h)
            cv2.circle(frame, (x, y), 1, (0, 255, 0), -1)
    def dynamic_gamma_correction(self, frame: np.ndarray) -> np.ndarray:
        """
        Apply dynamic gamma correction based on frame brightness
        
        Args:
            frame: Input frame in BGR format
            
        Returns:
            Gamma corrected frame
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        avg_brightness = gray.mean()
        
        # Determine gamma based on brightness
        if avg_brightness < 50:  # Very dark
            gamma = 2.0
        elif avg_brightness > 200:  # Very bright
            gamma = 0.5
        else:  # Moderate lighting
            gamma = 1.0
            
        # Apply gamma correction
        inv_gamma = 1.0 / gamma
        table = np.array([((i / 255.0) ** inv_gamma) * 255 
                        for i in range(256)]).astype("uint8")
        return cv2.LUT(frame, table)
    
    def rgb_frame(self, frame):
        """
        Convert BGR frame to RGB and create a MediaPipe image
        
        Args:
            frame: Input frame in BGR format (numpy array)
            
        Returns:
            MediaPipe image object
        """
        # Check if frame is valid before processing
        if frame is None or frame.size == 0 or not isinstance(frame, np.ndarray):
            raise ValueError("Invalid frame provided to rgb_frame method")
        
        # Convert color and apply gamma correction
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame = self.dynamic_gamma_correction(rgb_frame)
        
        # Create MediaPipe image with version compatibility
        try:
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        except AttributeError:
            try:
                mp_image = mp.Image(image_format=mp.ImageFormat.RGB, data=rgb_frame)
            except AttributeError:
                mp_image = mp.Image(data=rgb_frame)
        
        return mp_image
    
    def set_functional_process(self, frame, timestamp_ms: int = 0, isVideo=None)-> Tuple[Optional[all_data_output], np.ndarray]:
        mp_image = self.rgb_frame(frame)
        if self.isVideo:
            detection_result = self.detector.detect_for_video(mp_image, timestamp_ms)
        else:
            detection_result = self.detector.detect(mp_image)
        frame_height, frame_width = frame.shape[:2]
        if not detection_result.face_landmarks:
            return None, frame
        face_landmarks = detection_result.face_landmarks[0]
        
        # head
        pitch, yaw, roll  = self.tracker_headpose.get_calculate_angles(face_landmarks)
        # face
        all_element = self.tracker_face.main_process(face_landmarks, frame.copy(), frame_height, frame_width)
        
        return all_element, (pitch, yaw, roll), (frame_width, frame_height), face_landmarks, frame
    
    def enhance_image_set(self, frame, face_box, timestamp_ms: int = 0, isVideo=None):
        enhanced_face = self.enhancer.main_process(frame.copy(), face_box=face_box)
        if not isinstance(enhanced_face, np.ndarray):
            enhanced_face = np.array(enhanced_face)
        return self.set_functional_process(enhanced_face, timestamp_ms, isVideo)

    def process_frame(self, frame, timestamp_ms: int = 0, isVideo=None, isEnhanceFace=None)-> Tuple[Optional[all_data_output], np.ndarray]:
        """Process frame and return frame with face landmarks and head pose angles"""
        
        if isVideo is not None:
            self.isVideo = isVideo
        if isEnhanceFace is not None:
            self.isEnhanceFace = isEnhanceFace
        
        all_element, (pitch, yaw, roll), (frame_width, frame_height), face_landmarks, frame = self.set_functional_process(frame, timestamp_ms, isVideo)
        print(f"DEBUG - After set_functional_process - frame type: {type(frame)}, shape: {frame.shape if hasattr(frame, 'shape') else 'Unknown'}")
    
        if self.isEnhanceFace:
            self.Face_bounding_box = True
            self.face_Label_display = True
            all_element, (pitch, yaw, roll), (frame_width, frame_height), face_landmarks, frame = self.enhance_image_set(frame, all_element.face_box)
            print(f"DEBUG - After enhance_image_set - frame type: {type(frame)}, shape: {frame.shape if hasattr(frame, 'shape') else 'Unknown'}")

        if frame.dtype != np.uint8:
            frame = frame.astype(np.uint8)
        if hasattr(frame, 'numpy_view'):
            try:
                frame = frame.numpy_view()
            except:
                pass
        if self.isHeadposeOn:
            (pitch, x1, y1), (yaw, x2, y2), (roll, x3, y3) = self.tracker_headpose.get_draw_pose(pitch, yaw, roll, self.arrow_length)
            center_y, center_x = int(frame_height//2), int(frame_width//1.4)
            base = (center_x, center_y)
            if self.draw_headpose:
                cv2.arrowedLine(frame, base, (int(center_x + x1), int(center_y + y1)), (255, 0, 0), 6) # Draw yaw arrow (blue)
                cv2.arrowedLine(frame, base, (int(center_x + x2), int(center_y + y2)), (0, 255, 0), 6) # Draw pitch arrow (green)
                cv2.arrowedLine(frame, base, (int(center_x + x3), int(center_y + y3)), (0, 0, 255), 6) # Draw roll arrow (red)
                
        if self.Head_isMaskOn:
            self.get_draw_mask_face(frame.copy(), face_landmarks)
            
        metrics = all_data_output(
            head_pose_angles=(pitch, yaw, roll),
            face_box=getattr(all_element, "face_box", None),
            left_eye_box=getattr(all_element, "left_eye_box", None),
            right_eye_box=getattr(all_element, "right_eye_box", None),
            eye_iris_left_box=getattr(all_element, "eye_iris_left_box", None),
            eye_iris_right_box=getattr(all_element, "eye_iris_right_box", None),
            eye_iris_center=getattr(all_element, "eye_iris_center", None),
            eye_centers=getattr(all_element, "eye_centers", None),
            left_eye_state=getattr(all_element, "left_eye_state", None),
            right_eye_state=getattr(all_element, "right_eye_state", None),
            depths=getattr(all_element, "depths", None),
            landmark_positions=getattr(all_element, "landmark_positions", None)
        )
        if self.isFaceOn:
            frame = self._draw_visualization(face_landmarks, frame.copy(), metrics)
            
            # if self.isZoomFace:
            #     # frame = cv2.resize(enhanced_face, (frame_width, frame_height))
            #     frame = enhanced_face
        return metrics, frame

        
    def set_is_head_face(self, isHeadposeOn: bool, isFaceOn: bool):
        self.isHeadposeOn = isHeadposeOn
        self.isFaceOn = isFaceOn
        
    def set_labet_face_element(self, Label_display: bool):
        self.face_Label_display= Label_display
        
    def set_IsMaskOn(self, isMaskOn: bool):
        self.Head_isMaskOn= isMaskOn
        
    def set_IsShowHeadpose(self, draw_headpose: bool):
        self.draw_headpose= draw_headpose
    def get_avriable_headpose(self, pitch, yaw, roll, arrow_length= 200):
        self.arrow_length = arrow_length
        (pitch, x1, y1), (yaw, x2, y2), (roll, x3, y3) = self.tracker_headpose.get_draw_pose(pitch, yaw, roll, self.arrow_length)
        return (pitch, x1, y1), (yaw, x2, y2), (roll, x3, y3)
    
    def set_IsShowBox(self, Face_bounding_box: bool):
        self.Face_bounding_box= Face_bounding_box
    
    def set_IsZoomFace(self, isZoomFace: bool):
        self.isZoomFace= isZoomFace
        
    @staticmethod
    def create_webcam_capture(camera_index: int = 0) -> cv2.VideoCapture:
        """Create a webcam capture object"""
        return cv2.VideoCapture(camera_index)
 