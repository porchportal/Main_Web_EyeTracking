import React, { useEffect, useRef, useState } from 'react';

// Set to false to use actual camera instead of mock data
const ENABLE_MOCK_MODE = false;

const CameraProcessor = ({ 
  isShowing, 
  stream, 
  videoRef, 
  onProcessedFrame,
  showHeadPose = false,
  showBoundingBox = false,
  showMask = false,
  showParameters = false
}) => {
  const canvasRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const processingIntervalRef = useRef(null);
  const frameCountRef = useRef(0);
  const [fps, setFps] = useState(0);
  const fpsTimerRef = useRef(null);
  const fpsCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());

  // Mock processing function
  const mockProcessFrame = (videoElement, options) => {
    // Create a canvas to draw the frame
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match video
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    // Draw the current video frame
    ctx.drawImage(videoElement, 0, 0);
    
    // Apply visual effects based on options
    if (options.showHeadPose) {
      drawMockHeadPose(ctx, canvas.width, canvas.height);
    }
    
    if (options.showBoundingBox) {
      drawMockBoundingBox(ctx, canvas.width, canvas.height);
    }
    
    if (options.showMask) {
      drawMockMask(ctx, canvas.width, canvas.height);
    }
    
    // Generate mock metrics
    const faceDetected = Math.random() > 0.1; // 90% chance of face detected
    const metrics = faceDetected ? generateMockMetrics() : { face_detected: false };
    
    // Convert canvas to base64
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64Data = dataUrl.split(',')[1];
    
    // Return mock response
    return {
      success: true,
      metrics,
      image: base64Data
    };
  };
  
  // Helper to draw a mock head pose
  const drawMockHeadPose = (ctx, width, height) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const time = Date.now() / 1000;
    
    // Draw X axis (red)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + 50 * Math.sin(time), centerY);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw Y axis (green)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX, centerY + 50 * Math.sin(time + 1));
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw Z axis (blue)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + 25 * Math.sin(time + 2), centerY - 25 * Math.cos(time + 2));
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 3;
    ctx.stroke();
  };
  
  // Helper to draw a mock bounding box
  const drawMockBoundingBox = (ctx, width, height) => {
    const boxSize = Math.min(width, height) * 0.7;
    const leftX = (width - boxSize) / 2;
    const topY = (height - boxSize) / 2;
    
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;
    ctx.strokeRect(leftX, topY, boxSize, boxSize);
    
    // Draw corner markers
    ctx.fillStyle = 'yellow';
    const markerSize = 6;
    
    // Top left
    ctx.fillRect(leftX - markerSize/2, topY - markerSize/2, markerSize, markerSize);
    // Top right
    ctx.fillRect(leftX + boxSize - markerSize/2, topY - markerSize/2, markerSize, markerSize);
    // Bottom left
    ctx.fillRect(leftX - markerSize/2, topY + boxSize - markerSize/2, markerSize, markerSize);
    // Bottom right
    ctx.fillRect(leftX + boxSize - markerSize/2, topY + boxSize - markerSize/2, markerSize, markerSize);
  };
  
  // Helper to draw a mock face mask
  const drawMockMask = (ctx, width, height) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;
    
    // Draw semi-transparent face mask
    ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw eyes
    const eyeRadius = radius * 0.15;
    const eyeOffsetX = radius * 0.3;
    const eyeOffsetY = radius * 0.1;
    
    // Left eye
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(centerX - eyeOffsetX, centerY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Right eye
    ctx.beginPath();
    ctx.arc(centerX + eyeOffsetX, centerY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw mouth
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY + radius * 0.2, radius * 0.4, 0.2, Math.PI - 0.2);
    ctx.stroke();
  };
  
  // Generate mock metrics
  const generateMockMetrics = () => {
    const time = Date.now() / 1000;
    
    return {
      face_detected: true,
      head_pose: {
        pitch: Math.round(Math.sin(time) * 20),
        yaw: Math.round(Math.sin(time + 1) * 30),
        roll: Math.round(Math.sin(time + 2) * 15)
      },
      eye_centers: {
        left: [100, 100],
        right: [140, 100]
      }
    };
  };

  // Check backend connection on mount
  useEffect(() => {
    const checkBackendConnection = async () => {
      try {
        const response = await fetch('/api/check-backend-connection');
        const data = await response.json();
        setBackendConnected(data.connected);
        console.log(`Backend connection: ${data.connected ? 'OK' : 'Failed'}`);
      } catch (error) {
        console.error('Error checking backend connection:', error);
        setBackendConnected(false);
      }
    };

    if (!ENABLE_MOCK_MODE) {
      checkBackendConnection();
    }
  }, []);

  // Setup FPS counter
  useEffect(() => {
    const updateFps = () => {
      const now = Date.now();
      const elapsed = now - lastFpsUpdateRef.current;
      
      if (elapsed >= 1000) { // Update FPS every second
        setFps(Math.round((fpsCountRef.current * 1000) / elapsed));
        fpsCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }
    };

    fpsTimerRef.current = setInterval(updateFps, 500);
    
    return () => {
      if (fpsTimerRef.current) {
        clearInterval(fpsTimerRef.current);
      }
    };
  }, []);

  // Set up processing using requestAnimationFrame for smoother performance
  useEffect(() => {
    if (!isShowing || !stream) return;

    let animationFrameId;
    let lastProcessTime = 0;
    const interval = 33; // Target ~30 fps (33ms between frames)
    
    const processLoop = (timestamp) => {
      if (timestamp - lastProcessTime >= interval) {
        processFrame();
        lastProcessTime = timestamp;
      }
      animationFrameId = requestAnimationFrame(processLoop);
    };
    
    animationFrameId = requestAnimationFrame(processLoop);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isShowing, stream, showHeadPose, showBoundingBox, showMask, showParameters]);

  const processFrame = async () => {
    if (!videoRef.current || videoRef.current.readyState !== 4 || !canvasRef.current || isProcessing) {
      console.log('Video not ready yet or processing in progress');
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    
    setIsProcessing(true);
    
    try {
      // Draw the current video frame to the canvas
      ctx.drawImage(video, 0, 0);
      
      let data;
      
      // Draw the video directly to ensure it's always visible
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // If mock mode is enabled or backend is not connected, use mock processing
      if (ENABLE_MOCK_MODE || !backendConnected) {
        // Use mock processing
        data = mockProcessFrame(video, {
          showHeadPose,
          showBoundingBox,
          showMask,
          showParameters
        });
        
        // Reduced simulated delay to improve real-time feel
        await new Promise(resolve => setTimeout(resolve, 10));
      } else {
        // Use real backend processing
        // Get the frame data as a blob
        const blob = await new Promise(resolve => {
          canvas.toBlob(resolve, 'image/jpeg', 0.8);
        });
        
        if (!blob) {
          console.error('Failed to create blob from canvas');
          setIsProcessing(false);
          return;
        }
        
        // Create form data with the blob
        const formData = new FormData();
        formData.append('file', blob, 'frame.jpg');
        
        // Add parameters for face processing options
        formData.append('showHeadPose', showHeadPose);
        formData.append('showBoundingBox', showBoundingBox);
        formData.append('showMask', showMask);
        formData.append('showParameters', showParameters);
        
        // Send to backend with improved error handling
        try {
          const response = await fetch('/api/process-frame', {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            throw new Error(`Backend error: ${response.status} ${response.statusText}`);
          }
          
          data = await response.json();
        } catch (error) {
          console.error('Backend API error:', error);
          // Fall back to mock mode if backend fails
          console.log('Falling back to mock mode due to API error');
          data = mockProcessFrame(video, {
            showHeadPose,
            showBoundingBox,
            showMask,
            showParameters
          });
        }
      }
      
      if (data && data.success) {
        // Update UI with processed frame
        if (data.image) {
          const img = new Image();
          img.onload = () => {
            // Clear canvas and draw processed image
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Callback with metrics
            if (onProcessedFrame) {
              onProcessedFrame({
                metrics: data.metrics,
                timestamp: Date.now(),
                frameNumber: frameCountRef.current++,
                fps: fps
              });
            }
            
            // Update FPS counter
            fpsCountRef.current++;
            
            setIsProcessing(false);
          };
          img.onerror = () => {
            console.error('Failed to load processed image');
            setIsProcessing(false);
          };
          img.src = `data:image/jpeg;base64,${data.image}`;
        } else {
          // If no processed image, just use original frame
          if (onProcessedFrame) {
            onProcessedFrame({
              metrics: data.metrics,
              timestamp: Date.now(),
              frameNumber: frameCountRef.current++,
              fps: fps
            });
          }
          fpsCountRef.current++;
          setIsProcessing(false);
        }
      } else {
        console.error('Processing failed:', data?.error || 'Unknown error');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error processing frame:', error);
      setIsProcessing(false);
    }
  };

  if (!isShowing) {
    return null;
  }

  return (
    <div className="camera-processor" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        className="processing-canvas"
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1001 // Show the canvas on top of the video when processing
        }}
      />
      
      {/* Status indicators */}
      {(ENABLE_MOCK_MODE || !backendConnected) && (
        <div style={{ 
          position: 'absolute', 
          top: '5px', 
          left: '5px', 
          background: 'rgba(0,0,0,0.5)', 
          color: 'white', 
          padding: '2px 4px', 
          borderRadius: '2px', 
          fontSize: '10px', 
          zIndex: 1002 
        }}>
          Mock Mode
        </div>
      )}
      
      {/* Debug indicator */}
      <div style={{ 
        position: 'absolute', 
        bottom: '5px', 
        right: '5px', 
        background: 'rgba(0,255,0,0.5)', 
        color: 'white', 
        padding: '2px 4px', 
        borderRadius: '2px', 
        fontSize: '10px', 
        zIndex: 1002 
      }}>
        FPS: {fps}
      </div>
    </div>
  );
};

export default CameraProcessor;