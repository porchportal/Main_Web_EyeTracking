import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from dataclasses import dataclass
from typing import Tuple, List, Dict, Optional


@dataclass
class FaceMetrics:
    """Data class to store face measurements and states"""
    # face_box: Tuple[int, int, int, int]  # min_x, min_y, max_x, max_y
    # left_eye_box: Tuple[int, int, int, int]
    # right_eye_box: Tuple[int, int, int, int]
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


class FaceTracker01:
    """Class for face tracking and analysis using MediaPipe"""

    # Class constants
    NOSE_TIP = 4
    MOUTH_LEFT = 61
    MOUTH_RIGHT = 291
    CHIN = 152
    LEFT_CHEEK = 234
    RIGHT_CHEEK = 454

    LEFT_EYE_LANDMARKS = [398, 384, 385, 386, 387, 388, 466, 263, 359, 249, 390, 373, 374,
                          380, 381, 382, 463, 362]
    # RIGHT_EYE_LANDMARKS = [33, 246, 161, 160, 159, 158, 157, 173, 133, 243, 155, 154, 153, 
    #                        145, 144, 163, 7, 130]
    RIGHT_EYE_LANDMARKS = [173, 157, 158, 159, 160, 161, 246, 33, 130, 7, 163, 144, 145, 
                           153, 154, 155, 243, 133]
    LEFT_IRIS_LANDMARKS = [474, 475, 476, 477]
    RIGHT_IRIS_LANDMARKS = [469, 470, 471, 472]
    
    LEFT_Black_eye = 473
    RIGHT_Black_eye = 468

    def __init__(self, model_path: str = 'face_landmarker.task', isVideo:bool = True, show_visualization: bool = False, Label_display: bool = False, last_y_value: int = 0):
        """Initialize FaceTracker with model path and visualization flag"""
        self.show_visualization = show_visualization
        self.Label_display = Label_display
        self.last_y_value = last_y_value
        
        self.isVideo = isVideo
        # Initialize MediaPipe Face Landmarker
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
        self.last_metrics = None

    def _calculate_eye_aspect_ratio(self, eye_points: List[Tuple[int, int]]) -> float:
        """Calculate the eye aspect ratio"""
        points = np.array(eye_points)
        v1 = np.linalg.norm(points[4] - points[12])
        v2 = np.linalg.norm(points[5] - points[11])
        h = np.linalg.norm(points[0] - points[8])
        return (v1 + v2) / (2.0 * h) if h > 0 else 0

    
    def _get_eye_state(self, ear: float) -> str:
        """Determine eye state based on EAR value"""
        if ear < 0.215:
            return "Closed"
        elif ear < 0.24:
            return "Squinting"
        return "Open"


    def _get_landmark_coords(self, landmark, frame_width: int, frame_height: int) -> Tuple[int, int]:
        """Convert landmark coordinates to pixel coordinates"""
        return (
            int(landmark.x * frame_width),
            int(landmark.y * frame_height)
        )

    def _get_eye_points(self, frame, face_landmarks, is_left: bool) -> Tuple[List[Tuple[int, int]], List[Tuple[int, int]], Tuple[int, int]]:
        """Get eye contour and iris points"""
        frame_height, frame_width = frame.shape[:2]
        landmarks = self.LEFT_EYE_LANDMARKS if is_left else self.RIGHT_EYE_LANDMARKS
        iris_landmarks = self.LEFT_IRIS_LANDMARKS if is_left else self.RIGHT_IRIS_LANDMARKS

        eye_points = []
        iris_points = []

        for idx in landmarks:
            point = face_landmarks[idx]
            x, y = self._get_landmark_coords(point, frame_width, frame_height)
            eye_points.append((x, y))

        for idx in iris_landmarks:
            point = face_landmarks[idx]
            x, y = self._get_landmark_coords(point, frame_width, frame_height)
            iris_points.append((x, y))

        iris_center = (
            sum(p[0] for p in iris_points) // len(iris_points),
            sum(p[1] for p in iris_points) // len(iris_points)
        )

        return eye_points, iris_points, iris_center
    
    def _get_refined_iris_center(self, face_landmarks, initial_iris_center: Tuple[int, int], is_left: bool, frame_width: int, frame_height: int) -> Tuple[int, int]:
        """
        Refine the iris center by averaging with a specific landmark, considering visibility scores.
        :param face_landmarks: Detected face landmarks.
        :param initial_iris_center: Previously calculated iris center.
        :param is_left: True for left eye, False for right eye.
        :param frame_width: Width of the frame.
        :param frame_height: Height of the frame.
        :return: Refined iris center coordinates (x, y).
        """
        # Define the specific iris landmark index
        landmark_index = self.LEFT_Black_eye if is_left else self.RIGHT_Black_eye

        # Extract coordinates and visibility score
        point = face_landmarks[landmark_index]
        x = int(point.x * frame_width)
        y = int(point.y * frame_height)
        visibility = point.visibility if hasattr(point, 'visibility') else 1.0

        # Refine iris center only if visibility is high
        if visibility > 0.5:
            refined_x = (x + initial_iris_center[0]) // 2
            refined_y = (y + initial_iris_center[1]) // 2
            return refined_x, refined_y
        return initial_iris_center
    
    def _constrain_iris_center(self, iris_center: Tuple[int, int], eye_points: List[Tuple[int, int]]) -> Tuple[int, int]:
        """
        Constrain the iris center within the eye contour region.
        :param iris_center: Calculated iris center (x, y).
        :param eye_points: List of eye contour points (x, y).
        :return: Constrained iris center coordinates (x, y).
        """
        x_coords = [p[0] for p in eye_points]
        y_coords = [p[1] for p in eye_points]
        min_x, max_x = min(x_coords), max(x_coords)
        min_y, max_y = min(y_coords), max(y_coords)

        constrained_x = max(min_x, min(iris_center[0], max_x))
        constrained_y = max(min_y, min(iris_center[1], max_y))
        return constrained_x, constrained_y
    
    def _calculate_depths(self, face_landmarks, frame) -> Tuple[float, float, float, float]:
        """Calculate face and feature depths"""
        frame_height, frame_width = frame.shape[:2]

        # Get key landmarks
        left_eye = self._get_landmark_coords(
            face_landmarks[self.LEFT_EYE_LANDMARKS[8]], frame_width, frame_height)
        right_eye = self._get_landmark_coords(
            face_landmarks[self.RIGHT_EYE_LANDMARKS[8]], frame_width, frame_height)
        nose = self._get_landmark_coords(
            face_landmarks[self.NOSE_TIP], frame_width, frame_height)
        chin = self._get_landmark_coords(
            face_landmarks[self.CHIN], frame_width, frame_height)

        # Calculate interpupillary distance
        ipd_pixels = np.sqrt(
            (right_eye[0] - left_eye[0])**2 + (right_eye[1] - left_eye[1])**2)

        # Constants
        REAL_IPD = 6.3  # Average IPD in cm
        FOCAL_LENGTH = frame_width

        # Calculate base depth
        base_depth = (FOCAL_LENGTH * REAL_IPD) / max(ipd_pixels, 1)
        base_depth = np.clip(base_depth, 30, 200)

        # Calculate relative depths
        center_x = frame_width / 2
        left_offset = abs(left_eye[0] - center_x) / center_x
        right_offset = abs(right_eye[0] - center_x) / center_x

        left_eye_depth = base_depth + (base_depth * left_offset * 0.2)
        right_eye_depth = base_depth + (base_depth * right_offset * 0.2)

        chin_ratio = (chin[1] - nose[1]) / frame_height
        chin_depth = base_depth + (base_depth * chin_ratio * 0.1)

        return (
            round(base_depth, 2),
            round(left_eye_depth, 2),
            round(right_eye_depth, 2),
            round(chin_depth, 2)
        )
        
    def y_update(self, y_pos):
        self.last_y_value = y_pos
        return y_pos + 40
    
    
    def _draw_visualization(self, frame: np.ndarray, metrics: FaceMetrics) -> np.ndarray:
        """Draw all visualizations on the frame"""
        if not self.show_visualization:
            return frame

        # Draw landmarks and their coordinates
        y_pos = 70
        for name, pos in metrics.landmark_positions.items():
            cv2.circle(frame, pos, 3, (0, 0, 255), -1)
            if self.Label_display:
                cv2.putText(frame, f"{name}: {pos}", (10, y_pos),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 3)
                y_pos = self.y_update(y_pos)

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
            
        if self.Label_display:
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
            if self.Label_display:
                cv2.putText(frame, f"{depth_name} Depth: {depth_val} cm",
                            (10, y_start + i * line_height),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (122, 234, 255), 3)

        return frame
    
    def calculate_eye_centers(self, frame, face_landmarks):
        """Calculate the center points of eyes and midpoint between eyes."""
        frame_height, frame_width = frame.shape[:2]
        
        # Calculate left eye center
        left_eye_x = sum(int(face_landmarks[idx].x * frame_width)
                        for idx in self.LEFT_EYE_LANDMARKS) // len(self.LEFT_EYE_LANDMARKS)
        left_eye_y = sum(int(face_landmarks[idx].y * frame_height)
                        for idx in self.LEFT_EYE_LANDMARKS) // len(self.LEFT_EYE_LANDMARKS)

        # Calculate right eye center
        right_eye_x = sum(int(face_landmarks[idx].x * frame_width)
                        for idx in self.RIGHT_EYE_LANDMARKS) // len(self.RIGHT_EYE_LANDMARKS)
        right_eye_y = sum(int(face_landmarks[idx].y * frame_height)
                        for idx in self.RIGHT_EYE_LANDMARKS) // len(self.RIGHT_EYE_LANDMARKS)

        # Calculate midpoint between eyes
        midpoint_x = (left_eye_x + right_eye_x) // 2
        midpoint_y = (left_eye_y + right_eye_y) // 2

        return (left_eye_x, left_eye_y), (right_eye_x, right_eye_y), (midpoint_x, midpoint_y)
    
    def calculate_bounding_box(self, eye_points, frame_width, frame_height, padding=5):
        # Calculate eye bounding box
        x_coords = [p[0] for p in eye_points]
        y_coords = [p[1] for p in eye_points]
        min_x, max_x = min(x_coords), max(x_coords)
        min_y, max_y = min(y_coords), max(y_coords)

        # Add small padding
        min_x = max(0, min_x - padding)
        min_y = max(0, min_y - padding)
        max_x = min(frame_width, max_x + padding)
        max_y = min(frame_height, max_y + padding)
        
        return (min_x, min_y), (max_x, max_y)

    
    def calculate_face_bounding_box(self, face_landmarks, frame_width, frame_height):
        """
        Calculate a more accurate face bounding box that adapts to face size and position
        """
        points = []
        for landmark in face_landmarks:
            x, y = self._get_landmark_coords(landmark, frame_width, frame_height)
            points.append((x, y))

        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]

        # Calculate basic bounds
        min_x, max_x = min(x_coords), max(x_coords)
        min_y, max_y = min(y_coords), max(y_coords)

        # Calculate face size metrics
        face_width = max_x - min_x
        face_height = max_y - min_y

        # Calculate dynamic padding based on face size
        horizontal_padding = int(face_width * 0.1)  # 15% of face width
        vertical_padding = int(face_height * 0.08)    # 20% of face height

        # Apply padding with bounds checking
        min_x = max(0, min_x - horizontal_padding)
        min_y = max(0, min_y - vertical_padding - 20)
        max_x = min(frame_width, max_x + horizontal_padding)
        max_y = min(frame_height, max_y + vertical_padding)

        return (min_x, min_y), (max_x, max_y)
    def _calculate_brightness(self, frame: np.ndarray, eye_points: List[Tuple[int, int]]) -> float:
        """
        Calculate the average brightness of the eye region.
        :param frame: Input frame.
        :param eye_points: List of eye points (x, y).
        :return: Average brightness of the eye region.
        """
        gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mask = np.zeros_like(gray_frame)
        points = np.array(eye_points, dtype=np.int32)
        cv2.fillPoly(mask, [points], 255)  # Create a mask for the eye region
        eye_region = cv2.bitwise_and(gray_frame, gray_frame, mask=mask)
        avg_brightness = np.mean(eye_region[mask > 0])  # Compute mean brightness
        return avg_brightness
    
    def _calculate_eye_iris_and_eye_point(self, frame, face_landmarks):
        frame_height, frame_width = frame.shape[:2]
        # Get eye points and states
        left_eye_points, left_iris_points, left_iris_center = self._get_eye_points(
            frame, face_landmarks, True)
        right_eye_points, right_iris_points, right_iris_center = self._get_eye_points(
            frame, face_landmarks, False)
        
        # Refine iris centers using specific landmarks and visibility filtering
        left_iris_center = self._get_refined_iris_center(face_landmarks, left_iris_center, True, frame_width, frame_height)
        right_iris_center = self._get_refined_iris_center(face_landmarks, right_iris_center, False, frame_width, frame_height)

        # Constrain iris centers within the eye contour region
        left_iris_center = self._constrain_iris_center(left_iris_center, left_eye_points)
        right_iris_center = self._constrain_iris_center(right_iris_center, right_eye_points)
            
        # Calculate iris bounding boxes
        min_left_iris, max_left_iris = self.calculate_bounding_box(
            left_iris_points, frame_width, frame_height, padding=2)
        min_right_iris, max_right_iris = self.calculate_bounding_box(
            right_iris_points, frame_width, frame_height, padding=2)
        
        return ((left_eye_points, right_eye_points), (left_iris_center, right_iris_center), (min_left_iris, max_left_iris), (min_right_iris, max_right_iris))
    
    # def main_process(self, face_landmarks, frame, frame_height, frame_width):
        
    #     left_pos, right_pos, mid_pos = self.calculate_eye_centers(
    #         frame, face_landmarks)
        
    #     eye_elements = self._calculate_eye_iris_and_eye_point(frame, face_landmarks)
    #     (left_eye_points, right_eye_points), (left_iris_center, right_iris_center), (min_left_iris, max_left_iris), (min_right_iris, max_right_iris) = eye_elements
        

    #     # Calculate eye states
    #     left_ear = self._calculate_eye_aspect_ratio(left_eye_points)
    #     right_ear = self._calculate_eye_aspect_ratio(right_eye_points) - 0.016
        
    #     # Get all facial landmarks
    #     landmark_positions = {
    #         'Nose': self._get_landmark_coords(face_landmarks[self.NOSE_TIP], frame_width, frame_height),
    #         'Mouth_L': self._get_landmark_coords(face_landmarks[self.MOUTH_LEFT], frame_width, frame_height),
    #         'Mouth_R': self._get_landmark_coords(face_landmarks[self.MOUTH_RIGHT], frame_width, frame_height),
    #         'Chin': self._get_landmark_coords(face_landmarks[self.CHIN], frame_width, frame_height),
    #         'Cheek_L': self._get_landmark_coords(face_landmarks[self.LEFT_CHEEK], frame_width, frame_height),
    #         'Cheek_R': self._get_landmark_coords(face_landmarks[self.RIGHT_CHEEK], frame_width, frame_height),
    #     }
    #     min_left, max_left = self.calculate_bounding_box(left_eye_points, frame_width, frame_height, padding=8)
    #     min_right, max_right= self.calculate_bounding_box(
    #         right_eye_points, frame_width, frame_height, padding=6)

    #     # Calculate bounding boxes face 
    #     min_face, max_face = self.calculate_face_bounding_box(
    #             face_landmarks, frame_width, frame_height)
        
    #     # Create metrics object
    #     metrics = FaceMetrics(
    #         # face_box=face_box,
    #         face_box=(min_face, max_face),
    #         left_eye_box= (min_left, max_left),
    #         right_eye_box=(min_right, max_right),
    #         #....... 
    #         eye_iris_center=(left_iris_center, right_iris_center),
    #         eye_centers=(left_pos, right_pos, mid_pos),
    #         eye_iris_left_box=(min_left_iris, max_left_iris),
    #         eye_iris_right_box=(min_right_iris, max_right_iris),
    #         # .......
            
    #         landmark_positions=landmark_positions,
    #         left_eye_state=(self._get_eye_state(left_ear), left_ear),
    #         right_eye_state=(self._get_eye_state(right_ear), right_ear),
    #         depths=self._calculate_depths(face_landmarks, frame)
    #     )

    #     self.last_metrics = metrics
        
    #     return metrics
    def main_process(self, face_landmarks, frame, frame_height, frame_width):
        if face_landmarks is None or frame is None:
            print("Warning: Invalid input to main_process. face_landmarks or frame is None.")
            return None

        try:
            # Calculate eye centers safely
            eye_centers = self.calculate_eye_centers(frame, face_landmarks)
            if eye_centers is None:
                print("Warning: Eye center calculation failed.")
                return None
            left_pos, right_pos, mid_pos = eye_centers

            # Calculate eye elements safely
            eye_elements = self._calculate_eye_iris_and_eye_point(frame, face_landmarks)
            if eye_elements is None:
                print("Warning: Eye elements calculation failed.")
                return None

            (left_eye_points, right_eye_points), (left_iris_center, right_iris_center), \
            (min_left_iris, max_left_iris), (min_right_iris, max_right_iris) = eye_elements

            # Calculate eye states
            left_ear = self._calculate_eye_aspect_ratio(left_eye_points) if left_eye_points else 0
            right_ear = (self._calculate_eye_aspect_ratio(right_eye_points) - 0.016) if right_eye_points else 0
            
            # Ensure facial landmarks exist before accessing them
            # required_landmarks = [self.NOSE_TIP, self.MOUTH_LEFT, self.MOUTH_RIGHT, self.CHIN, self.LEFT_CHEEK, self.RIGHT_CHEEK]
            # required_indices = [self.NOSE_TIP, self.MOUTH_LEFT, self.MOUTH_RIGHT, 
            #                self.CHIN, self.LEFT_CHEEK, self.RIGHT_CHEEK]
        
            # Properly check if the required landmark indices are within range
            # if len(face_landmarks) <= max(required_indices):
            #     print("Warning: Face landmarks list is too short. Expected at least 478 landmarks.")
            #     return None

            # Get all facial landmarks safely
            landmark_positions = {
                'Nose': self._get_landmark_coords(face_landmarks[self.NOSE_TIP], frame_width, frame_height),
                'Mouth_L': self._get_landmark_coords(face_landmarks[self.MOUTH_LEFT], frame_width, frame_height),
                'Mouth_R': self._get_landmark_coords(face_landmarks[self.MOUTH_RIGHT], frame_width, frame_height),
                'Chin': self._get_landmark_coords(face_landmarks[self.CHIN], frame_width, frame_height),
                'Cheek_L': self._get_landmark_coords(face_landmarks[self.LEFT_CHEEK], frame_width, frame_height),
                'Cheek_R': self._get_landmark_coords(face_landmarks[self.RIGHT_CHEEK], frame_width, frame_height),
            }

            # Calculate bounding boxes safely
            min_left, max_left = self.calculate_bounding_box(left_eye_points, frame_width, frame_height, padding=8) if left_eye_points else (None, None)
            min_right, max_right = self.calculate_bounding_box(right_eye_points, frame_width, frame_height, padding=6) if right_eye_points else (None, None)
            min_face, max_face = self.calculate_face_bounding_box(face_landmarks, frame_width, frame_height) if face_landmarks else (None, None)

            # Create metrics object
            metrics = FaceMetrics(
                face_box=(min_face, max_face),
                left_eye_box=(min_left, max_left),
                right_eye_box=(min_right, max_right),
                eye_iris_center=(left_iris_center, right_iris_center),
                eye_centers=(left_pos, right_pos, mid_pos),
                eye_iris_left_box=(min_left_iris, max_left_iris),
                eye_iris_right_box=(min_right_iris, max_right_iris),
                landmark_positions=landmark_positions,
                left_eye_state=(self._get_eye_state(left_ear), left_ear) if left_ear else (None, 0),
                right_eye_state=(self._get_eye_state(right_ear), right_ear) if right_ear else (None, 0),
                depths=self._calculate_depths(face_landmarks, frame) if face_landmarks else None
            )

            self.last_metrics = metrics
            return metrics
        
        except Exception as e:
            print(f"Error in main_process: {e}")
            return None

        
    def process_frame(self, frame: np.ndarray, timestamp_ms: int = 0) -> Optional[FaceMetrics]:
        """
        Process a frame and return face metrics
        Returns None if no face is detected
        """
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        if self.isVideo:
            detection_result = self.detector.detect_for_video(mp_image, timestamp_ms)
        else:
            detection_result = self.detector.detect(mp_image)

        if not detection_result.face_landmarks:
            return None
        
        frame_height, frame_width = frame.shape[:2]

        face_landmarks = detection_result.face_landmarks[0]
        metrics = self.main_process(face_landmarks, frame, frame_height, frame_width)


        if self.show_visualization:
            frame = self._draw_visualization(frame, metrics)

        return metrics

    def get_last_metrics(self) -> Optional[FaceMetrics]:
        """Return the last computed metrics"""
        return self.last_metrics
    
    def get_eye_elements(self, frame, face_landmarks):
        """Get eye elements"""
        return self._calculate_eye_iris_and_eye_point(frame, face_landmarks)


    def set_Label_display(self, show: bool) -> bool:
        """Set whether to show visualization overlays
        
        Args:
            show (bool): Flag to enable/disable visualization
            
        Returns:
            bool: The current visualization state
        """
        self.Label_display = show
        return self.Label_display
    
    def set_visualization(self, show: bool) -> bool:
        """Set whether to show visualization overlays
        
        Args:
            show (bool): Flag to enable/disable visualization
            
        Returns:
            bool: The current visualization state
        """
        self.show_visualization = show
        return self.show_visualization

    def get_visualization_state(self) -> bool:
        """Get current visualization state
        
        Returns:
            bool: Current visualization state
        """
        return self.show_visualization
    
    def get_last_y_value_label(self) -> int:
        """Get the last y value of the label
        
        Returns:
            int: The last y value of the label
        """
        return self.last_y_value

    # @classmethod
    # def create_webcam_capture(cls, camera_index: int = 0) -> cv2.VideoCapture:
    #     """Helper method to create a webcam capture"""
    #     return cv2.VideoCapture(camera_index)


# # Example usage
# if __name__ == "__main__":
#     # Initialize tracker
#     tracker = FaceTracker()
#     cap = tracker.create_webcam_capture(0)

#     timestamp_ms = 0
#     while True:
#         ret, frame = cap.read()
#         if not ret:
#             break

#         # Process frame and get metrics
#         metrics = tracker.process_frame(frame, timestamp_ms)

#         if metrics:
#             # Access specific metrics if needed
#             print(f"Left eye state: {metrics.left_eye_state[0]}")
#             print(f"Face depth: {metrics.depths[0]} cm")

#         cv2.imshow('Face Tracking', frame)
#         if cv2.waitKey(1) & 0xFF == ord('q'):
#             break
#         timestamp_ms += 10

#     cap.release()
#     cv2.destroyAllWindows()
