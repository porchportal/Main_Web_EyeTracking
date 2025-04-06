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
  const [stream, setStream] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [fps, setFps] = useState(0);
  const fpsTimerRef = useRef(null);
  const processingInterval = useRef(null);
  
  // Start camera on component mount if isShowing is true
  useEffect(() => {
    if (isShowing) {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [isShowing]);

  // Setup FPS counter
  useEffect(() => {
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
  }, []);

  // Simplified camera start function
  const startCamera = async () => {
    setErrorMessage('');
    
    try {
      console.log('Starting camera access...');
      
      // Request camera access with minimal constraints
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      
      console.log('Camera access granted!');
      
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
          
          // Get video dimensions after a short delay to ensure they're available
          setTimeout(() => {
            const videoWidth = videoRef.current.videoWidth || 640;
            const videoHeight = videoRef.current.videoHeight || 480;
            
            console.log(`Video dimensions: ${videoWidth}x${videoHeight}`);
            
            // Setup canvas for processing
            if (canvasRef.current) {
              canvasRef.current.width = videoWidth;
              canvasRef.current.height = videoHeight;
            }
            
            // Notify parent component
            // if (onCameraReady) {
            //   onCameraReady({
            //     width: videoWidth,
            //     height: videoHeight,
            //     distance: 120
            //   });
            // }
            
            // Start processing frames
            startProcessing();
          }, 300);
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
  };

  const startProcessing = () => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Match canvas size to video
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    // Start processing frames at ~30fps
    processingInterval.current = setInterval(() => {
      if (video.readyState !== 4) return;
      
      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
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
    <div className="camera-component" style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '480px',
      height: '360px',
      background: 'black',
      border: '2px solid #0066cc',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
      zIndex: 999
    }}>
      {errorMessage && (
        <div style={{
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '10px', 
          textAlign: 'center', 
          backgroundColor: '#fff0f0'
        }}>
          <p style={{
            fontSize: '14px', 
            color: 'red', 
            margin: '0 0 20px', 
            fontWeight: 'bold'
          }}>
            {errorMessage}
          </p>
          <button 
            onClick={startCamera}
            style={{
              padding: '12px 24px', 
              background: '#0066cc', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              fontSize: '16px'
            }}
          >
            Try Again
          </button>
        </div>
      )}
      
      {!errorMessage && (
        <>
          <div style={{position: 'absolute', top: '5px', right: '5px', zIndex: 12}}>
            <button 
              onClick={onClose} 
              style={{
                padding: '2px 6px', 
                background: '#cc0000', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                fontSize: '12px', 
                cursor: 'pointer'
              }}
            >
              X
            </button>
          </div>
          
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              backgroundColor: 'black'
            }}
          />
          
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 1001
            }}
          />
          
          {/* Debug information */}
          <div style={{
            position: 'absolute', 
            bottom: '5px', 
            left: '5px', 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            color: 'white',
            padding: '3px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            zIndex: 1005
          }}>
            Stream: {stream ? 'Active' : 'None'} | FPS: {fps}
          </div>
        </>
      )}
    </div>
  );
};

export default CameraAccess;