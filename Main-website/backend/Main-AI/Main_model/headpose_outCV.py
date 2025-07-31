
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import math
from dataclasses import dataclass
from typing import Tuple, List, Dict, Optional

class HeadPoseTracker01:
    """Class for head pose estimation using MediaPipe"""
    
    def __init__(self, model_path: str = 'face_landmarker.task', isVideo:bool = True, show_visualization: bool = False, isMaskOn: bool = False, numYaxis_labels: int = 30, position_base_3d: Tuple[int, int] = (960, 540)):
        """Initialize HeadPoseTracker with model path and visualization flag"""
        self.show_visualization = show_visualization
        self.isMaskOn = isMaskOn
        self.numYaxis_labels = numYaxis_labels
        self.position_base_3d = position_base_3d
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
        
        
    def calculate_angles(self, face_landmarks) -> Tuple[float, float, float]:
        """Calculate pitch, yaw, and roll angles from face landmarks."""
        # Eyes
        left_eye_corner_left = np.array([face_landmarks[33].x, face_landmarks[33].y, face_landmarks[33].z])
        left_eye_corner_right = np.array([face_landmarks[133].x, face_landmarks[133].y, face_landmarks[133].z])
        left_eye = (left_eye_corner_left + left_eye_corner_right) / 2
        
        right_eye_corner_left = np.array([face_landmarks[362].x, face_landmarks[362].y, face_landmarks[362].z])
        right_eye_corner_right = np.array([face_landmarks[263].x, face_landmarks[263].y, face_landmarks[263].z])
        right_eye = (right_eye_corner_left + right_eye_corner_right) / 2

        # Mouth points
        left_mouth = np.array([face_landmarks[61].x, face_landmarks[61].y, face_landmarks[61].z])
        right_mouth = np.array([face_landmarks[291].x, face_landmarks[291].y, face_landmarks[291].z])
        
        # Face points
        chin = np.array([face_landmarks[152].x, face_landmarks[152].y, face_landmarks[152].z])
        forehead = np.array([face_landmarks[10].x, face_landmarks[10].y, face_landmarks[10].z])
        
        def normalize(vector):
            return vector / np.linalg.norm(vector)
        
        # Calculate vectors for pose estimation
        vector_eye = left_eye - right_eye
        vector_mouth = left_mouth - right_mouth
        vector_vertical = forehead - chin
        
        z_axis_eye = normalize(np.cross(vector_eye, vector_vertical))
        z_axis_mouth = normalize(np.cross(vector_mouth, vector_vertical))
        z_axis = (z_axis_eye + z_axis_mouth) / 2
        
        # Calculate angles
        yaw = math.degrees(math.atan2(z_axis[0], z_axis[2])) * 1.05
        pitch = math.degrees(math.atan2(z_axis[1], math.sqrt(z_axis[0]**2 + z_axis[2]**2))) * 1.45
        
        # Calculate roll using both eyes and mouth points
        eye_roll = math.degrees(math.atan2(right_eye[1] - left_eye[1], right_eye[0] - left_eye[0]))
        mouth_roll = math.degrees(math.atan2(right_mouth[1] - left_mouth[1], right_mouth[0] - left_mouth[0]))
        roll = -((eye_roll + mouth_roll) / 2) * 0.7
        
        return pitch, yaw, roll

    def draw_pose_visualization(self, pitch: float, yaw: float, roll: float, arrow_length: int = 200) -> np.ndarray:
        """Draw visualization arrows for head pose angles"""
        # if not self.show_visualization:
        #     return frame
            
        # h, w = frame.shape[:2]
        # center_x = w // 8
        # center_y = h // 2
        # center_x, center_y = self.position_base_3d
        # arrow_length = 200
        
        # Convert angles to radians
        pitch_rad = math.radians(pitch)
        yaw_rad = math.radians(yaw)
        roll_rad = math.radians(roll)
        
        # (center_x, center_y) = centers_position
        
        # Draw yaw arrow (blue)
        x1 = arrow_length * (math.cos(yaw_rad) * math.cos(roll_rad))
        y1 = arrow_length * -(math.cos(pitch_rad) * math.sin(roll_rad) + math.cos(roll_rad) * math.sin(pitch_rad) * math.sin(yaw_rad))
        # cv2.arrowedLine(frame, base, (int(center_x + x1), int(center_y + y1)), (255, 0, 0), 6)
        
        # Draw pitch arrow (green)
        x2 = arrow_length * (-math.cos(yaw_rad) * math.sin(roll_rad))
        y2 = arrow_length * -(math.cos(pitch_rad) * math.cos(roll_rad) - math.sin(pitch_rad) * math.sin(yaw_rad) * math.sin(roll_rad))
        # cv2.arrowedLine(frame, base, (int(center_x + x2), int(center_y + y2)), (0, 255, 0), 6)
        
        # Draw roll arrow (red)
        x3 = arrow_length * -(math.sin(yaw_rad))
        y3 = arrow_length * (-math.cos(yaw_rad) * math.sin(pitch_rad))
        # cv2.arrowedLine(frame, base, (int(center_x + x3), int(center_y + y3)), (0, 0, 255), 6)
        
        # # Add angle text
        # scale = 1
        # thickness = 4
        # cv2.putText(frame, f"Pitch: {pitch:.2f}", (10, self.numYaxis_labels), cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 255, 200), thickness)
        # cv2.putText(frame, f"Yaw: {yaw:.2f}", (10, self.numYaxis_labels + 40), cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 255, 200), thickness)
        # cv2.putText(frame, f"Roll: {roll:.2f}", (10, self.numYaxis_labels + 80), cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 255, 200), thickness)
        
        return (pitch_rad, x1, y1), (yaw_rad, x2, y2), (roll_rad, x3, y3)

    # def process_frame(self, frame: np.ndarray, timestamp_ms: int = 0) -> Tuple[Optional[Tuple[float, float, float]], np.ndarray]:
    #     """Process a frame and return head pose angles (pitch, yaw, roll) and the visualization frame"""
    #     try:
    #         rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    #         mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            
    #         detection_result = self.detector.detect_for_video(mp_image, timestamp_ms)
            
    #         if not detection_result.face_landmarks:
    #             return None, frame
                
    #         face_landmarks = detection_result.face_landmarks[0]
    #         pitch, yaw, roll = self.calculate_angles(face_landmarks)
            
    #         # if self.show_visualization:
    #         #     frame = self.draw_pose_visualization(frame, pitch, yaw, roll)
                
    #         # Draw landmarks if visualization is enabled
    #         # if self.isMaskOn:
    #         #     h, w = frame.shape[:2]
    #         #     for landmark in face_landmarks:
    #         #         x = int(landmark.x * w)
    #         #         y = int(landmark.y * h)
    #         #         cv2.circle(frame, (x, y), 1, (0, 255, 0), -1)
                    
    #         return (pitch, yaw, roll), frame, face_landmarks
            
    #     except ValueError as e:
    #         if "Input timestamp must be monotonically increasing" in str(e):
    #             # Return None for angles but still return the frame
    #             return None, frame
    #         raise e

    def set_visualization(self, show: bool) -> None:
        """Set whether to show visualization overlays"""
        self.show_visualization = show
        
    def setMesh(self, isMeshOn: bool) -> None:
        """Set whether to show mesh landmarks"""
        self.isMeshOn = isMeshOn
        
    def set_labels(self, numYaxis_labels: int) -> None:
        """Set the number of labels on the Y-axis"""
        self.numYaxis_labels = numYaxis_labels
    
    def set_position_base_3d(self, position_base_3d: Tuple[int, int]) -> None:
        """Set the base position for 3D visualization"""
        self.position_base_3d = position_base_3d
        
    def get_draw_pose(self, pitch, yaw, roll, arrow_length):
        return self.draw_pose_visualization(pitch, yaw, roll, arrow_length)
    
    def get_draw_mask_face(self, frame, face_landmarks):
        h, w = frame.shape[:2]
        for landmark in face_landmarks:
            x = int(landmark.x * w)
            y = int(landmark.y * h)
        return (x, y)
    
    def get_calculate_angles(self, face_landmarks):
        pitch, yaw, roll = self.calculate_angles(face_landmarks)
        return pitch, yaw, roll 

    # @staticmethod
    # def create_webcam_capture(camera_index: int = 0) -> cv2.VideoCapture:
    #     """Create a webcam capture object"""
    #     return cv2.VideoCapture(camera_index)

# def main():
#     """Example usage of HeadPoseTracker"""
#     tracker = HeadPoseTracker()
#     cap = tracker.create_webcam_capture(1)  # Adjust camera index if needed
    
#     while True:
#         ret, frame = cap.read()
#         if not ret:
#             break
            
#         angles, visualization = tracker.process_frame(frame)
        
#         if angles:
#             pitch, yaw, roll = angles
#             print(f"Pitch: {pitch:.2f}, Yaw: {yaw:.2f}, Roll: {roll:.2f}")
            
#         cv2.imshow('Head Pose Estimation', visualization)
#         if cv2.waitKey(1) & 0xFF == ord('q'):
#             break
            
#     cap.release()
#     cv2.destroyAllWindows()

# if __name__ == "__main__":
#     main()