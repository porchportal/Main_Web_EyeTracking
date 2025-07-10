// cameraAccess.js
import React, { useEffect, useRef, useState } from 'react';
import { getHighestResolutionConstraints } from '../../../components/collected-dataset/Helper/savefile';

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
  const wsRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [fps, setFps] = useState(0);
  const fpsTimerRef = useRef(null);
  const processingInterval = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [processingResults, setProcessingResults] = useState(null);
  const frameQueue = useRef([]);
  const isProcessing = useRef(false);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [isLinked, setIsLinked] = useState(false);
  
  // WebSocket connection
  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    setWsStatus('connecting');
    try {
      // Connect to FastAPI WebSocket endpoint
      const ws = new WebSocket('ws://localhost:8000/ws/video');
      wsRef.current = ws;

      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('WebSocket connection timeout');
          ws.close();
          setWsStatus('error');
          setErrorMessage('Connection timeout. Please check if the backend server is running.');
          setIsLinked(false);
        }
      }, 5000);

      ws.onopen = () => {
        console.log('WebSocket connected to FastAPI backend');
        clearTimeout(connectionTimeout);
        setWsStatus('connected');
        setErrorMessage('');
        setIsLinked(true);
        if (isVideoReady) {
          processingInterval.current = setInterval(captureAndProcessFrame, 33);
        }
      };

      ws.onmessage = (event) => {
        try {
          const result = JSON.parse(event.data);
          setProcessingResults(result);
          drawResults(result);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(connectionTimeout);
        setWsStatus('error');
        setErrorMessage('Failed to connect to FastAPI backend. Please check if the server is running.');
        setIsLinked(false);
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        clearTimeout(connectionTimeout);
        setWsStatus('disconnected');
        setIsLinked(false);
        // Stop frame processing
        if (processingInterval.current) {
          clearInterval(processingInterval.current);
          processingInterval.current = null;
        }
        
        // If the connection was closed due to an error, show error message
        if (event.code !== 1000) { // 1000 is normal closure
          setErrorMessage(`WebSocket connection closed: ${event.reason || 'Unknown reason'}`);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setWsStatus('error');
      setErrorMessage('Failed to create WebSocket connection. Please check your network connection.');
      setIsLinked(false);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User requested disconnect');
      wsRef.current = null;
      setWsStatus('disconnected');
      setIsLinked(false);
      // Stop frame processing
      if (processingInterval.current) {
        clearInterval(processingInterval.current);
        processingInterval.current = null;
      }
      // Clear the canvas to remove any overlays
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  useEffect(() => {
    if (!isShowing) {
      disconnectWebSocket();
      return;
    }

    return () => {
      disconnectWebSocket();
    };
  }, [isShowing]);

  // Frame capture and processing
  const captureAndProcessFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isVideoReady || !wsRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Only draw on canvas if WebSocket is connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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

      // Convert canvas to blob with high quality
      canvas.toBlob((blob) => {
        if (blob && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          // Send frame to backend
          wsRef.current.send(blob);
        }
      }, 'image/jpeg', 0.95);
    }
  };

  // Draw processing results
  const drawResults = (results) => {
    if (!canvasRef.current || !results) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Draw bounding box if available
    if (results.bounding_box && showBoundingBox) {
      const { x, y, width, height } = results.bounding_box;
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
    }

    // Draw head pose if available
    if (results.head_pose && showHeadPose) {
      const { pitch, yaw, roll } = results.head_pose;
      // Draw head pose visualization
      drawHeadPose(ctx, canvas, pitch, yaw, roll);
    }

    // Draw face mask if available
    if (results.face_mask && showMask) {
      const { points } = results.face_mask;
      drawFaceMask(ctx, canvas, points);
    }

    // Draw parameters if enabled
    if (showParameters) {
      drawParameters(ctx, canvas, results);
    }
  };

  // Start camera with highest resolution
  const startCamera = async () => {
    setErrorMessage('');
    setIsVideoReady(false);

    try {
      // Check if MediaDevices API is supported
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        // Try to polyfill the MediaDevices API
        if (typeof navigator !== 'undefined') {
          navigator.mediaDevices = {};
        }
        
        // Add getUserMedia polyfill if needed
        if (!navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia = function(constraints) {
            // First get ahold of the legacy getUserMedia, if present
            const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
            
            // Some browsers just don't implement it - return a rejected promise with an error
            if (!getUserMedia) {
              return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
            }
            
            // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
            return new Promise(function(resolve, reject) {
              getUserMedia.call(navigator, constraints, resolve, reject);
            });
          };
        }
      }

      // Check if we're on HTTPS or localhost
      const isSecure = window.location.protocol === 'https:' || 
                      window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      process.env.NODE_ENV === 'development';
      
      if (!isSecure) {
        throw new Error('Camera access requires HTTPS or localhost. Please use HTTPS or run the application on localhost.');
      }

      console.log('Starting camera access with highest resolution...');

      // Get highest resolution constraints
      const constraints = await getHighestResolutionConstraints();
      console.log('Using camera constraints:', constraints);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        ...constraints,
        audio: false
      });

      console.log('High resolution camera access granted!');
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
        videoRef.current.autoplay = true;
        videoRef.current.srcObject = mediaStream;

        try {
          await videoRef.current.play();
          console.log('Video playing successfully!');
          setIsVideoReady(true);
          
          // Start frame processing if WebSocket is connected
          if (wsStatus === 'connected') {
            processingInterval.current = setInterval(captureAndProcessFrame, 33); // ~30fps
          }
        } catch (playError) {
          console.error('Error playing video:', playError);
          setErrorMessage('Unable to start video stream. Please try again.');
        }
      }
    } catch (error) {
      console.error('Camera access error:', error);
      let errorMessage = 'Camera error: ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Camera access was denied. Please allow camera access in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found. Please connect a camera and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage += 'Camera does not support the requested resolution.';
      } else if (error.message === 'getUserMedia is not implemented in this browser') {
        errorMessage += 'Your browser does not support camera access. Please try using a modern browser like Chrome, Firefox, or Edge.';
      } else {
        errorMessage += error.message || 'Unknown error';
      }
      
      setErrorMessage(errorMessage);
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

  // Start camera on component mount if isShowing is true
  useEffect(() => {
    if (isShowing) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
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
  }, [stream, isShowing, dimensions, onCameraReady]);

  const startProcessing = () => {
    if (!canvasRef.current || !videoRef.current || !isVideoReady) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
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
  const drawHeadPose = (ctx, canvas, pitch, yaw, roll) => {
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
  const drawFaceMask = (ctx, canvas, points) => {
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
        width: '30vw',
        height: '30vh',
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
          transform: 'scaleX(-1)',
          opacity: 1
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
          zIndex: 1,
          pointerEvents: 'none',
          display: isLinked ? 'block' : 'none' // Hide canvas when not linked
        }}
      />
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        display: 'flex',
        gap: '10px',
        zIndex: 2
      }}>
        <button
          onClick={onClose}
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease'
          }}
        >
          Close
        </button>
        
        <button
          onClick={() => {
            if (isLinked) {
              disconnectWebSocket();
            } else {
              connectWebSocket();
            }
          }}
          style={{
            padding: '8px 12px',
            backgroundColor: isLinked ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 255, 0, 0.7)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease'
          }}
        >
          {isLinked ? 'Unlink' : 'Link'}
        </button>
      </div>

      {wsStatus === 'error' && (
        <div style={{
          position: 'absolute',
          top: '50px',
          right: '10px',
          padding: '8px 12px',
          backgroundColor: 'rgba(255, 0, 0, 0.7)',
          color: 'white',
          borderRadius: '4px',
          zIndex: 2
        }}>
          Connection Error: {errorMessage}
        </div>
      )}
    </div>
  );
};

export default CameraAccess;