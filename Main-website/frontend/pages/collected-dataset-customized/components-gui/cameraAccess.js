// Unified Camera Access Component
import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { getHighestResolutionConstraints } from '../../../components/collected-dataset-customized/Helper/savefile';

// Create the main camera component
const CameraAccessComponent = ({ 
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
  const [isStarting, setIsStarting] = useState(false);
  
  // WebSocket connection
  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    setWsStatus('connecting');
    try {
      // Connect to FastAPI WebSocket endpoint
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8108';
      const ws = new WebSocket(`${wsUrl}/ws/video`);
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
          // drawResults(result);
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
      // Clear any camera activation data when camera is closed
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cameraActivated');
        localStorage.removeItem('cameraActivationTime');
        // Clean up global video element when camera is closed
        if (window.videoElement) {
          delete window.videoElement;
          console.log('Global video element cleaned up (camera closed)');
        }
      }
      return;
    }

    return () => {
      disconnectWebSocket();
      // Clear any camera activation data when component unmounts
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cameraActivated');
        localStorage.removeItem('cameraActivationTime');
        // Clean up global video element
        if (window.videoElement) {
          delete window.videoElement;
          console.log('Global video element cleaned up');
        }
      }
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

  // Start camera with highest resolution
  const startCamera = async () => {
    setErrorMessage('');
    setIsVideoReady(false);
    setIsStarting(true);

    // Clear any existing processing intervals
    if (processingInterval.current) {
      clearInterval(processingInterval.current);
      processingInterval.current = null;
    }

    try {
      // 1. Enhanced Browser Environment Check
      if (typeof window === 'undefined') {
        throw new Error('Window object not available - not running in a browser environment');
      }

      if (typeof navigator === 'undefined') {
        throw new Error('Navigator object not available - not running in a browser environment');
      }

      // 2. Comprehensive Browser Detection
      const userAgent = navigator.userAgent.toLowerCase();
      const browserInfo = {
        isChrome: /chrome/.test(userAgent) && !/edge/.test(userAgent),
        isFirefox: /firefox/.test(userAgent),
        isSafari: /safari/.test(userAgent) && !/chrome/.test(userAgent),
        isEdge: /edge/.test(userAgent),
        isOpera: /opr/.test(userAgent),
        isIE: /trident/.test(userAgent),
        isMobile: /mobile|android|iphone|ipad|phone/i.test(userAgent),
        version: userAgent.match(/(chrome|firefox|safari|edge|opr)\/([0-9]+)/)
      };

      // 3. Initialize MediaDevices API
      if (!navigator.mediaDevices) {
        console.warn('MediaDevices API not available, initializing...');
        navigator.mediaDevices = {};
      }

      // 4. Enhanced MediaDevices Support
      if (!navigator.mediaDevices.getUserMedia) {
        console.warn('getUserMedia not available, checking implementations...');
        
        // Try all possible implementations
        const implementations = {
          standard: navigator.mediaDevices.getUserMedia,
          webkit: navigator.webkitGetUserMedia || navigator.mediaDevices.webkitGetUserMedia,
          moz: navigator.mozGetUserMedia || navigator.mediaDevices.mozGetUserMedia,
          ms: navigator.msGetUserMedia || navigator.mediaDevices.msGetUserMedia,
          legacy: navigator.getUserMedia
        };

        // Try to find a working implementation
        let getUserMedia = null;
        let implementationName = null;

        for (const [name, impl] of Object.entries(implementations)) {
          if (impl) {
            getUserMedia = impl;
            implementationName = name;
            break;
          }
        }

        if (getUserMedia) {
          console.log(`Using ${implementationName} implementation of getUserMedia`);
          
          // Wrap the implementation in a Promise
          navigator.mediaDevices.getUserMedia = function(constraints) {
            return new Promise((resolve, reject) => {
              if (implementationName === 'standard') {
                getUserMedia.call(navigator.mediaDevices, constraints)
                  .then(resolve)
                  .catch(reject);
              } else {
                getUserMedia.call(navigator, constraints, resolve, reject);
              }
            });
          };
        } else {
          // Provide specific guidance based on browser
          if (browserInfo.isMobile) {
            throw new Error('Camera access on mobile devices requires HTTPS. Please use a secure connection.');
          } else if (browserInfo.isIE) {
            throw new Error('Internet Explorer does not support camera access. Please use Chrome, Firefox, or Edge.');
          } else if (browserInfo.isSafari) {
            throw new Error('Safari requires HTTPS for camera access. Please use a secure connection or try Chrome/Firefox.');
          } else {
            throw new Error('Camera access not supported in this browser. Please use Chrome, Firefox, or Edge.');
          }
        }
      }

      // 5. Check Security Context
      const isSecure = window.location.protocol === 'https:' || 
                      window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      process.env.NODE_ENV === 'development';
      
      if (!isSecure) {
        throw new Error(`Camera access requires HTTPS or localhost. Current protocol: ${window.location.protocol}, hostname: ${window.location.hostname}`);
      }

      // 6. Enhanced Permission Handling
      let permissionStatus = 'prompt';
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const permissionResult = await navigator.permissions.query({ name: 'camera' });
          permissionStatus = permissionResult.state;
          console.log('Camera permission status:', permissionStatus);

          permissionResult.onchange = () => {
            console.log('Camera permission changed to:', permissionResult.state);
            permissionStatus = permissionResult.state;
          };
        }
      } catch (permissionError) {
        console.warn('Could not check camera permissions:', permissionError);
      }

      // 7. Handle Permission States
      if (permissionStatus === 'denied') {
        throw new Error('Camera access has been permanently denied. Please update your browser settings to allow camera access.');
      }

      // 8. Get Camera Constraints
      console.log('Starting camera access with highest resolution...');
      const constraints = await getHighestResolutionConstraints();
      console.log('Using camera constraints:', constraints);

      // 9. Add Fallback Constraints
      const fallbackConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      // 10. Try to Access Camera with Permission Handling
      let mediaStream;
      try {
        console.log('Attempting to access camera with high resolution...');
        mediaStream = await navigator.mediaDevices.getUserMedia({
          ...constraints,
          audio: false
        });
      } catch (error) {
        console.warn('Failed to get high resolution stream, trying fallback constraints:', error);
        try {
          console.log('Attempting to access camera with fallback constraints...');
          mediaStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        } catch (fallbackError) {
          console.error('Failed to get camera access with fallback constraints:', fallbackError);
          
          // Provide specific guidance based on error type
          if (fallbackError.name === 'NotAllowedError') {
            if (permissionStatus === 'prompt') {
              throw new Error('Camera access was denied. Please allow camera access when prompted by your browser.');
            } else {
              throw new Error('Camera access has been blocked. Please check your browser settings and allow camera access for this site.');
            }
          } else if (fallbackError.name === 'NotFoundError') {
            throw new Error('No camera found. Please connect a camera and try again.');
          } else if (fallbackError.name === 'NotReadableError') {
            throw new Error('Camera is already in use by another application. Please close other applications using the camera.');
          } else {
            throw new Error(`Camera access error: ${fallbackError.message}`);
          }
        }
      }

      console.log('Camera access granted successfully!');
      setStream(mediaStream);

      // 11. Setup Video Element with improved error handling
      if (videoRef.current) {
        const video = videoRef.current;
        
        // Reset video element
        video.pause();
        video.currentTime = 0;
        video.srcObject = null;
        
        // Set video properties
        video.playsInline = true;
        video.muted = true;
        video.autoplay = false; // Don't autoplay, we'll handle it manually
        
        // Set the stream
        video.srcObject = mediaStream;
        
        // Wait for video to be ready
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Video loading timeout'));
          }, 10000); // 10 second timeout
          
          const handleCanPlay = () => {
            clearTimeout(timeout);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('error', handleError);
            resolve();
          };
          
          const handleError = (error) => {
            clearTimeout(timeout);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('error', handleError);
            reject(new Error(`Video error: ${error.message}`));
          };
          
          video.addEventListener('canplay', handleCanPlay);
          video.addEventListener('error', handleError);
          
          // If video is already ready, resolve immediately
          if (video.readyState >= 2) {
            handleCanPlay();
          }
        });

        // Try to play the video with improved autoplay handling
        try {
          // Set video properties for better autoplay success
          video.muted = true;
          video.playsInline = true;
          video.autoplay = false;
          
          // Try to play immediately
          await video.play();
          console.log('Video playing successfully!');
          setIsVideoReady(true);
          
          // Expose video element to global scope for capture functions
          window.videoElement = video;
          console.log('Video element exposed to global scope:', {
            videoElement: window.videoElement,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState,
            srcObject: !!video.srcObject
          });
          
          if (wsStatus === 'connected') {
            processingInterval.current = setInterval(captureAndProcessFrame, 33);
          }
        } catch (playError) {
          console.error('Video play failed:', playError);
          
          // Handle specific play errors
          if (playError.name === 'AbortError') {
            console.warn('Video play was aborted, this is normal during component unmount');
            return; // Don't throw error for abort
                     } else if (playError.name === 'NotAllowedError') {
             // For autoplay blocked, just set video as ready and let it play when user interacts
             console.log('Autoplay blocked, setting video as ready');
             setIsVideoReady(true);
             console.log('Video ready but waiting for user interaction');
           } else {
            // For other errors, just set video as ready
            console.warn('Video play error, but setting as ready:', playError.message);
            setIsVideoReady(true);
          }
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
      } else if (error.message.includes('HTTPS')) {
        errorMessage += 'Camera access requires HTTPS or localhost. Please use HTTPS or run the application on localhost.';
      } else if (error.message.includes('permanently denied')) {
        errorMessage += 'Camera access has been permanently denied. Please update your browser settings.';
      } else if (error.message.includes('Video loading timeout')) {
        errorMessage += 'Video took too long to load. Please try again.';
      } else {
        errorMessage += error.message || 'Unknown error';
      }
      
      setErrorMessage(errorMessage);
    } finally {
      setIsStarting(false);
    }
  };

  const stopCamera = () => {
    console.log('Stopping camera...');
    
    // Clear processing interval first
    if (processingInterval.current) {
      clearInterval(processingInterval.current);
      processingInterval.current = null;
    }
    
    // Stop all tracks in the stream
    if (stream) {
      console.log('Stopping stream tracks...');
      stream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped track: ${track.kind}`);
      });
      setStream(null);
    }
    
    // Clear video source and reset video element
    if (videoRef.current) {
      const video = videoRef.current;
      try {
        video.pause();
        video.currentTime = 0;
        video.srcObject = null;
        video.load(); // Reset the video element
        console.log('Video element reset successfully');
      } catch (error) {
        console.warn('Error resetting video element:', error);
      }
    }
    
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    
    setIsVideoReady(false);
    setErrorMessage('');
    setIsStarting(false);
    
    // Clean up global video element
    if (typeof window !== 'undefined' && window.videoElement) {
      delete window.videoElement;
      console.log('Global video element cleaned up (camera stopped)');
    }
    
    console.log('Camera stopped successfully');
  };

  // Start camera on component mount if isShowing is true
  useEffect(() => {
    let isMounted = true;
    
    const handleCameraLifecycle = async () => {
      if (isShowing && isMounted) {
        console.log('Starting camera...');
        await startCamera();
      } else if (!isShowing && isMounted) {
        console.log('Stopping camera...');
        stopCamera();
      }
    };
    
    handleCameraLifecycle();
    
    return () => {
      isMounted = false;
      console.log('Component unmounting, cleaning up camera...');
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
      setIsVideoReady(true);
      
      // Get video dimensions
      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 480;
      
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
          opacity: isVideoReady ? 1 : 0.5,
          zIndex: 1,
          transition: 'opacity 0.3s ease'
        }}
        playsInline
        muted
        autoPlay={false}
        onLoadedMetadata={() => {
          console.log('Video metadata loaded');
        }}
        onCanPlay={() => {
          console.log('Video can play');
          // Try to play when video is ready
          if (videoRef.current && !isVideoReady) {
            videoRef.current.play().catch(error => {
              console.log('Auto-play on canplay failed:', error);
            });
          }
        }}
        onPlay={() => {
          console.log('Video started playing');
          setIsVideoReady(true);
        }}
        onError={(e) => {
          console.error('Video error:', e);
          setErrorMessage('Video playback error occurred');
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
          zIndex: 2,
          pointerEvents: 'none',
          display: isLinked ? 'block' : 'none'
        }}
      />
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        display: 'flex',
        gap: '10px',
        zIndex: 3
      }}>
        <button
          onClick={onClose}
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
            zIndex: 3
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
            transition: 'background-color 0.3s ease',
            zIndex: 3
          }}
        >
          {isLinked ? 'Unlink' : 'Link'}
        </button>
      </div>

      {/* Loading indicator */}
      {isStarting && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          borderRadius: '8px',
          zIndex: 4,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>📷</div>
          <div>Starting camera...</div>
        </div>
      )}





      {/* Status indicator */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        padding: '4px 8px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        borderRadius: '4px',
        fontSize: '10px',
        zIndex: 3
      }}>
        {isVideoReady ? 'Camera Ready' : isStarting ? 'Starting...' : 'Camera Off'}
      </div>
    </div>
  );
};

// Create the dynamic import wrapper with SSR disabled
const CameraAccess = dynamic(
  () => Promise.resolve(CameraAccessComponent),
  { 
    ssr: false, // Disable server-side rendering for camera component
    loading: () => (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '480px',
        height: '360px',
        background: '#f0f8ff',
        border: '2px solid #0066cc',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        zIndex: 999
      }}>
        <div style={{ fontSize: '48px', marginBottom: '15px' }}>📷</div>
        <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#0066cc' }}>
          Loading camera...
        </p>
      </div>
    )
  }
);

export default CameraAccess;