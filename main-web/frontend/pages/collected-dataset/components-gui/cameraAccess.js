// cameraAccess.js
import React, { useEffect, useRef, useState } from 'react';

const CameraAccess = ({ 
  isShowing, 
  onClose, 
  onCameraReady,
  showHeadPose = false,
  showBoundingBox = false,
  showMask = false,
  showParameters = false
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [fps, setFps] = useState(0);
  const fpsTimerRef = useRef(null);
  const processingInterval = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [currentResolution, setCurrentResolution] = useState('low');
  const resolutionTimerRef = useRef(null);
  
  // Start camera on component mount if isShowing is true
  useEffect(() => {
    if (isShowing) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
      if (resolutionTimerRef.current) {
        clearTimeout(resolutionTimerRef.current);
      }
    };
  }, [isShowing]);

  // Setup FPS counter
  useEffect(() => {
    if (!isShowing) return;
    
    fpsTimerRef.current = setInterval(() => {
      setFps(prevFps => {
        // Simple mock for fps counter
        const newFps = Math.floor(Math.random() * 10) + 25; // Random between 25-35 fps
        return newFps;
      });
    }, 1000);
    
    return () => {
      if (fpsTimerRef.current) {
        clearInterval(fpsTimerRef.current);
      }
      if (processingInterval.current) {
        clearInterval(processingInterval.current);
      }
    };
  }, [isShowing]);

  // Update dimensions when container size changes
  useEffect(() => {
    if (!isShowing) return;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isShowing]);

  // Handle video element ready state
  useEffect(() => {
    if (!isShowing || !videoRef.current || !stream) return;
    
    const video = videoRef.current;
    
    const handleLoadedMetadata = () => {
      console.log('Video metadata loaded');
      setIsVideoReady(true);
      
      // Get video dimensions
      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 480;
      
      console.log(`Video dimensions: ${videoWidth}x${videoHeight}`);
      
      // Setup canvas for processing
      if (canvasRef.current) {
        // Store actual dimensions for capture
        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;
        
        // Set display size to maintain aspect ratio
        const aspectRatio = videoWidth / videoHeight;
        const containerWidth = dimensions.width;
        const containerHeight = containerWidth / aspectRatio;
        
        canvasRef.current.style.width = `${containerWidth}px`;
        canvasRef.current.style.height = `${containerHeight}px`;
      }
      
      // Start processing frames
      startProcessing();
      
      // Notify parent component that camera is ready
      if (onCameraReady) {
        onCameraReady({
          width: videoWidth,
          height: videoHeight
        });
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [stream, dimensions, isShowing, onCameraReady]);

  // Handle resolution upgrade
  useEffect(() => {
    if (!isShowing || !stream || currentResolution === 'high') return;

    const upgradeResolution = async () => {
      try {
        // Stop current tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Request higher resolution
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
          },
          audio: false
        });
        
        // Update stream and resolution state
        setStream(newStream);
        setCurrentResolution('high');
        
        // Apply new stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
        
        console.log('Camera resolution upgraded to high');
      } catch (error) {
        console.error('Error upgrading camera resolution:', error);
        // Keep using current resolution if upgrade fails
      }
    };

    // Schedule resolution upgrade after 2 seconds
    resolutionTimerRef.current = setTimeout(upgradeResolution, 2000);
    
    return () => {
      if (resolutionTimerRef.current) {
        clearTimeout(resolutionTimerRef.current);
      }
    };
  }, [stream, isShowing, currentResolution]);

  const startCamera = async () => {
    setErrorMessage('');
    setIsVideoReady(false);
    setCurrentResolution('low');
    
    try {
      console.log('Starting camera access with low resolution...');
      
      // Start with low resolution for quick preview
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320, max: 640 },
          height: { ideal: 240, max: 480 },
          facingMode: "user"
        },
        audio: false
      });
      
      console.log('Low resolution camera access granted!');
      
      // Store the stream
      setStream(mediaStream);
      
      // Apply stream to video element
      if (videoRef.current) {
        // Critical attributes for cross-browser compatibility
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
        videoRef.current.autoplay = true;
        
        // Apply stream to video element
        videoRef.current.srcObject = mediaStream;
        
        try {
          // Explicitly try to play the video
          await videoRef.current.play();
          console.log('Video playing successfully!');
        } catch (playError) {
          console.error('Error playing video:', playError);
          setErrorMessage('Unable to start video stream. Please try again.');
        }
      } else {
        throw new Error('Video element not found');
      }
    } catch (error) {
      console.error('Camera access error:', error);
      
      // Handle specific error types
      if (error.name === 'NotAllowedError') {
        setErrorMessage('Camera access denied. Please check browser permissions and try again.');
      } else if (error.name === 'NotFoundError') {
        setErrorMessage('No camera detected. Please connect a camera and try again.');
      } else if (error.name === 'NotReadableError') {
        setErrorMessage('Camera is being used by another application.');
      } else {
        setErrorMessage(`Camera error: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const stopCamera = () => {
    // Stop all tracks in the stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Clear processing interval
    if (processingInterval.current) {
      clearInterval(processingInterval.current);
      processingInterval.current = null;
    }
    
    setIsVideoReady(false);
  };

  const startProcessing = () => {
    if (!canvasRef.current || !videoRef.current || !isVideoReady) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Use high resolution for processing canvas regardless of current video resolution
    const processingWidth = 1280;
    const processingHeight = 720;
    
    // Set canvas to high resolution for processing
    canvas.width = processingWidth;
    canvas.height = processingHeight;
    
    // Start processing frames at ~30fps
    processingInterval.current = setInterval(() => {
      if (video.readyState !== 4) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Save the current context state
      ctx.save();
      
      // Flip the context horizontally to mirror the video
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      
      // Draw video frame to canvas at high resolution
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Restore the context state
      ctx.restore();
      
      // Simulate face detection (90% chance of face detected)
      const faceDetected = Math.random() > 0.1;
      
      // Draw visualizations based on enabled options
      if (faceDetected) {
        if (showBoundingBox) {
          drawBoundingBox(ctx, canvas);
        }
        
        if (showHeadPose) {
          drawHeadPose(ctx, canvas);
        }
        
        if (showMask) {
          drawFaceMask(ctx, canvas);
        }
      }
      
      // Display parameters if enabled
      if (showParameters) {
        drawParameters(ctx, canvas, faceDetected);
      }
    }, 33); // ~30fps
  };
  
  // Helper function to draw bounding box
  const drawBoundingBox = (ctx, canvas) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const boxWidth = canvas.width * 0.6;
    const boxHeight = canvas.height * 0.8;
    
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      centerX - boxWidth/2, 
      centerY - boxHeight/2, 
      boxWidth, 
      boxHeight
    );
  };
  
  // Helper function to draw head pose axes
  const drawHeadPose = (ctx, canvas) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const time = Date.now() / 1000;
    const length = canvas.width * 0.1;
    
    // X axis (red)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + length * Math.sin(time), centerY);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Y axis (green)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX, centerY + length * Math.sin(time + 1));
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Z axis (blue)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + length/2 * Math.sin(time + 2), 
      centerY - length/2 * Math.cos(time + 2)
    );
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 3;
    ctx.stroke();
  };
  
  // Helper function to draw face mask
  const drawFaceMask = (ctx, canvas) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.2;
    
    // Draw mask
    ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw eyes
    const eyeRadius = radius * 0.2;
    const eyeOffsetX = radius * 0.3;
    const eyeOffsetY = radius * 0.1;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    
    // Left eye
    ctx.beginPath();
    ctx.arc(centerX - eyeOffsetX, centerY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Right eye
    ctx.beginPath();
    ctx.arc(centerX + eyeOffsetX, centerY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
  };
  
  // Helper function to draw parameters
  const drawParameters = (ctx, canvas, faceDetected) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(5, canvas.height - 60, 150, 50);
    
    ctx.font = '12px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText(`Resolution: ${canvas.width}x${canvas.height}`, 10, canvas.height - 40);
    ctx.fillText(`FPS: ${fps}`, 10, canvas.height - 25);
    ctx.fillText(`Face: ${faceDetected ? 'Detected' : 'Not Detected'}`, 10, canvas.height - 10);
  };

  if (!isShowing) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      style={{ 
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '30vw', // 30% of viewport width
        height: '30vh', // 30% of viewport height
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
        zIndex: 1000
      }}
    >
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)', // Flip horizontally
          opacity: 0 // Keep video hidden but functional
        }}
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1
        }}
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '8px 12px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          zIndex: 2
        }}
      >
        Close
      </button>
    </div>
  );
};

export default CameraAccess;