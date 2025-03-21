import cv2
import glob
import os
import re
import time
import torch
import numpy as np
import csv
import datetime
from pathlib import Path
from typing import Dict, Tuple, Optional, List, Union

# Import RealESRGAN components
from basicsr.archs.rrdbnet_arch import RRDBNet
from basicsr.utils.download_util import load_file_from_url
from realesrgan import RealESRGANer
from realesrgan.archs.srvgg_arch import SRVGGNetCompact

# Import face tracking component
# from showframeVisualization import FrameShow_head_face


class FaceEnhancer:
    """
    A class for enhancing face images using Real-ESRGAN models
    with optional face tracking functionality.
    """
    
    # Model configurations
    MODEL_CONFIGS = {
        'RealESRGAN_x4plus': {
            'model': lambda: RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4),
            'netscale': 4,
            'url': ['https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth']
        },
        'RealESRNet_x4plus': {
            'model': lambda: RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4),
            'netscale': 4,
            'url': ['https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.1/RealESRNet_x4plus.pth']
        },
        'RealESRGAN_x4plus_anime_6B': {
            'model': lambda: RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=6, num_grow_ch=32, scale=4),
            'netscale': 4,
            'url': ['https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth']
        },
        'RealESRGAN_x2plus': {
            'model': lambda: RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=2),
            'netscale': 2,
            'url': ['https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth']
        },
        'realesr-animevideov3': {
            'model': lambda: SRVGGNetCompact(num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=16, upscale=4, act_type='prelu'),
            'netscale': 4,
            'url': ['https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-animevideov3.pth']
        },
        'realesr-general-x4v3': {
            'model': lambda: SRVGGNetCompact(num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=32, upscale=4, act_type='prelu'),
            'netscale': 4,
            'url': [
                'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-wdn-x4v3.pth',
                'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth'
            ]
        }
    }
    
    def __init__(
        self,
        model_name: str = 'realesr-general-x4v3',
        denoise_strength: float = 0.5,
        outscale: int = 4,
        fp32: bool = True,
        face_enhance: bool = False,
        tile: int = 0,
        tile_pad: int = 10,
        pre_pad: int = 0,
        alpha_upsampler: str = 'realesrgan',
        gpu_id: Optional[int] = None
    ):
        """
        Initialize the FaceEnhancer with specified parameters.
        
        Args:
            face_model_path: Path to the face landmarker model
            model_name: Name of the Real-ESRGAN model to use
            denoise_strength: Strength of the denoising (0-1)
            outscale: Output upscaling factor
            fp32: Whether to use FP32 precision (True) or FP16 (False)
            face_enhance: Whether to use GFPGAN for face enhancement
            tile: Tile size for processing (0 for no tiling)
            tile_pad: Padding for tiles
            pre_pad: Pre-padding for model
            alpha_upsampler: Method for upsampling alpha channel
            gpu_id: GPU ID to use, None for automatic selection
        """
        # Store parameters
        self.model_name = model_name
        self.denoise_strength = denoise_strength
        self.outscale = outscale
        self.fp32 = fp32
        self.face_enhance = face_enhance
        self.tile = tile
        self.tile_pad = tile_pad
        self.pre_pad = pre_pad
        self.alpha_upsampler = alpha_upsampler
        self.gpu_id = gpu_id
        
        # Initialize face tracker if provided
        self.tracker = None
        self.start_time = time.time()
        
        # Initialize device
        self.device = self._get_device()
        print(f"Using device: {self.device}")
        
        # Initialize upsampler
        self._setup_model()
        
    def _get_device(self) -> torch.device:
        """Determine and return the appropriate device for computation."""
        if torch.cuda.is_available():
            return torch.device(f'cuda:{self.gpu_id}' if self.gpu_id is not None else 'cuda')
        elif torch.backends.mps.is_available():
            return torch.device('mps')
        else:
            return torch.device('cpu')
        
    def _setup_model(self) -> None:
        """Set up the model based on model name."""
        if self.model_name not in self.MODEL_CONFIGS:
            raise ValueError(f"Unknown model name: {self.model_name}")
        
        config = self.MODEL_CONFIGS[self.model_name.split('.')[0]]
        self.model = config['model']()
        self.netscale = config['netscale']
        file_url = config['url']
        
        # Determine model paths
        model_path = self._get_model_path(file_url)
        
        # Use dni to control the denoise strength
        dni_weight = None
        if self.model_name == 'realesr-general-x4v3' and self.denoise_strength != 1:
            wdn_model_path = model_path.replace('realesr-general-x4v3', 'realesr-general-wdn-x4v3')
            model_path = [model_path, wdn_model_path]
            dni_weight = [self.denoise_strength, 1 - self.denoise_strength]
        
        # Initialize upsampler
        self.upsampler = RealESRGANer(
            scale=self.netscale,
            model_path=model_path,
            dni_weight=dni_weight,
            model=self.model,
            tile=self.tile,
            tile_pad=self.tile_pad,
            pre_pad=self.pre_pad,
            half=not self.fp32,
            gpu_id=self.gpu_id,
            device=self.device
        )
        
        # Initialize face enhancer if needed
        if self.face_enhance:
            from gfpgan import GFPGANer
            self.face_enhancer = GFPGANer(
                model_path='https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.3.pth',
                upscale=self.outscale,
                arch='clean',
                channel_multiplier=2,
                bg_upsampler=self.upsampler
            )
    
    def _get_model_path(self, file_url: List[str]) -> Union[str, List[str]]:
        """
        Get the path to the model, downloading it if necessary.
        
        Args:
            file_url: URL(s) to download the model from
            
        Returns:
            Path to the downloaded model
        """
        # Try to locate the model in the weights directory
        model_name = self.model_name.split('.')[0]
        model_path = os.path.join('weights', model_name + '.pth')
        
        if not os.path.isfile(model_path):
            # Create weights directory in current working directory
            ROOT_DIR = os.getcwd()
            weights_dir = os.path.join(ROOT_DIR, 'weights')
            os.makedirs(weights_dir, exist_ok=True)
            
            # Download model if not found
            for url in file_url:
                model_path = load_file_from_url(
                    url=url, 
                    model_dir=weights_dir, 
                    progress=True, 
                    file_name=None
                )
                
                if isinstance(model_path, (list, tuple, np.ndarray)):
                    model_path = str(model_path[0] if len(model_path) > 0 else '')
                    
        return model_path
    
    def process_image(
        self, 
        image_path: str, 
        output_path: str, 
        existing_params: Optional[Dict] = None, 
        next_number: Optional[int] = None
    ) -> bool:
        """
        Process a single image.
        
        Args:
            image_path: Path to the input image
            output_path: Path to save the output image
            existing_params: Dictionary of existing parameters from CSV
            next_number: Next file number for parameter CSV
            
        Returns:
            bool: True if processing was successful, False otherwise
        """
        try:
            # Read the image
            img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
            if img is None:
                print(f"Error: Could not read image from {image_path}")
                return False
            
            # Determine if image has alpha channel
            img_mode = 'RGBA' if len(img.shape) == 3 and img.shape[2] == 4 else None
            
            # Enhance the image
            try:
                if self.face_enhance:
                    _, _, output = self.face_enhancer.enhance(img, has_aligned=False, only_center_face=False, paste_back=True)
                else:
                    output, _ = self.upsampler.enhance(img, outscale=self.outscale)
            except RuntimeError as error:
                print(f'Error processing {image_path}: {error}')
                return False
            
            # Process with face tracker if available
            if self.tracker and existing_params and next_number is not None:
                current_time = time.time()
                timestamp_ms = int((current_time - self.start_time) * 1000)
                
                try:
                    matrix_out, tracker_output = self.tracker.process_frame(output, timestamp_ms)
                    
                    # Skip if no face detected
                    if matrix_out is None or not hasattr(matrix_out, 'face_box'):
                        print(f"Error: No face detected in {image_path}")
                        return False
                    
                    # Save parameters to CSV
                    param_path = os.path.join(os.path.dirname(output_path), f'parameters_{next_number:03d}.csv')
                    self.save_parameters_to_csv(
                        param_path,
                        output,  # Using enhanced output image
                        None,    # No screen frame reference
                        matrix_out,
                        next_number,
                        existing_params
                    )
                    print(f"Saved parameters to {param_path}")
                except Exception as e:
                    print(f"Error during face tracking: {e}")
                    return False
            
            # Create output directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Save the output image
            cv2.imwrite(output_path, output)
            print(f'Saved enhanced image to {output_path}')
            return True
            
        except Exception as e:
            print(f"Error processing image {image_path}: {e}")
            return False
    
    def get_face_crop(self, frame, face_box):
        """
        Extract face region from frame using bounding box coordinates
        Args:
        frame: Input image
        face_box: Tuple of ((min_x, min_y), (max_x, max_y))
        Returns:
        Cropped face image or None if face_box is None
        """
        if face_box is None:
            return None
        # Extract coordinates from face_box tuples
        (min_x, min_y) = face_box[0]
        (max_x, max_y) = face_box[1]
        # Ensure coordinates are within image bounds
        h, w = frame.shape[:2]
        min_x = max(0, min_x)
        min_y = max(0, min_y)
        max_x = min(w, max_x)
        max_y = min(h, max_y)
        
        return frame[min_y:max_y, min_x:max_x]
    
    def process_face(self, frame, face_box: Tuple[int, int]):
        """
        Process a face region from a frame by enhancing its resolution.
        
        Args:
            frame: Input image frame
            face_box: Tuple of ((min_x, min_y), (max_x, max_y)) defining face boundaries
            
        Returns:
            Enhanced face image or None if processing fails
        """
        try:
            # Extract face crop from the frame
            face_crop = self.get_face_crop(frame, face_box)
            
            if face_crop is None or face_crop.size == 0:
                print("Error: Invalid face crop")
                return None
            
            # Enhance the face crop using the initialized upsampler
            try:
                if self.face_enhance:
                    _, _, enhanced_face = self.face_enhancer.enhance(
                        face_crop, 
                        has_aligned=False, 
                        only_center_face=False, 
                        paste_back=True
                    )
                else:
                    enhanced_face, _ = self.upsampler.enhance(
                        face_crop, 
                        outscale=self.outscale
                    )
                    
                return enhanced_face
                
            except RuntimeError as error:
                print(f'Error enhancing face: {error}')
                return None
                
        except Exception as e:
            print(f"Error processing face: {e}")
            return None
        
    def main_process(self, frame, face_box: Tuple[int, int]):
        """
        Main processing function to enhance a face from a frame.
        
        Args:
            frame: Input image frame
            face_box: Tuple of ((min_x, min_y), (max_x, max_y)) defining face boundaries
            
        Returns:
            Enhanced face image or None if processing fails
        """
        try:    
            enhanced_face = self.process_face(frame, face_box)
            
            return enhanced_face
            
        except Exception as e:
            print(f"Error in main process: {e}")
            return None
            
            