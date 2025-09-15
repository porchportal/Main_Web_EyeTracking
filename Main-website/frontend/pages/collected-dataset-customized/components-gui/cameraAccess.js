// Unified Camera Access Component
import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { getHighestResolutionConstraints } from '../../../components/collected-dataset-customized/Helper/savefile';
import styles from '../styles/camera-ui.module.css';

// Create the main camera component
const CameraAccessComponent = ({ 
  isShowing, 
  isHidden = false,
  onClose, 
  onCameraReady,
  showHeadPose = false,
  showBoundingBox = false,
  showMask = false,
  showParameters = false,
  selectedCameras = [],
  cameraIndex = 0
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
  
  // Check if we should redirect to camera port for HTTPS
  const shouldUseCameraPort = () => {
    if (typeof window === 'undefined') return false;
    const isSecure = window.location.protocol === 'https:';
    const currentPort = window.location.port;
    // Only redirect if we're on HTTPS and not already on camera port
    // But don't redirect for main application routes - only for camera-specific functionality
    return isSecure && currentPort !== '8443' && window.location.pathname.includes('/camera');
  };
  
  // Redirect to camera port if needed (only for camera-specific routes)
  const redirectToCameraPort = () => {
    if (shouldUseCameraPort()) {
      const hostname = window.location.hostname;
      const newUrl = `https://${hostname}:8443${window.location.pathname}${window.location.search}`;
      window.location.href = newUrl;
      return true;
    }
    return false;
  };
  
  // WebSocket connection
  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    setWsStatus('connecting');
    try {
      // Determine WebSocket URL based on current protocol and port
      const isSecure = window.location.protocol === 'https:';
      const currentPort = window.location.port;
      const hostname = window.location.hostname;
      
      let wsUrl;
      if (isSecure) {
        // Use WSS for HTTPS connections
        if (currentPort === '8443') {
          // Camera-specific port
          wsUrl = `wss://${hostname}:8443`;
        } else {
          // Main HTTPS port
          wsUrl = `wss://${hostname}:443`;
        }
      } else {
        // Fallback to environment variable for development
        wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8108';
      }
      
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
          // Error parsing WebSocket message
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        setWsStatus('error');
        setErrorMessage('Failed to connect to FastAPI backend. Please check if the server is running.');
        setIsLinked(false);
      };

      ws.onclose = (event) => {
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
        }
      }
      return;
    }

    // When camera is shown, ensure it's properly activated
    if (isShowing && typeof window !== 'undefined' && window.cameraStateManager) {
      // Set camera as activated when camera component is shown
      window.cameraStateManager.setActivation(true);
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

  // Load selected cameras from localStorage
  const loadSelectedCamerasFromStorage = () => {
    if (typeof window !== 'undefined') {
      try {
        const storedCameras = localStorage.getItem('selectedCameras');
        const storedCameraData = localStorage.getItem('selectedCamerasData');
        
        if (storedCameras) {
          const parsedCameras = JSON.parse(storedCameras);
          if (Array.isArray(parsedCameras) && parsedCameras.length > 0) {
            console.log('Loaded selected cameras from localStorage:', parsedCameras);
            
            // Load camera data with tags if available
            if (storedCameraData) {
              try {
                const parsedCameraData = JSON.parse(storedCameraData);
                console.log('Loaded camera data with tags:', parsedCameraData);
              } catch (dataError) {
                console.warn('Error parsing camera data:', dataError);
              }
            }
            
            return parsedCameras;
          }
        }
      } catch (error) {
        console.warn('Error loading selected cameras from localStorage:', error);
      }
    }
    return selectedCameras; // Fallback to prop
  };

  // Start camera with highest resolution
  const startCamera = async () => {
    setErrorMessage('');
    setIsVideoReady(false);
    setIsStarting(true);

    // Check if we need to redirect to camera port for HTTPS
    if (redirectToCameraPort()) {
      return;
    }

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
        navigator.mediaDevices = {};
      }

      // 4. Enhanced MediaDevices Support
      if (!navigator.mediaDevices.getUserMedia) {
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
                      window.location.hostname === '0.0.0.0' ||
                      process.env.NODE_ENV === 'development';
      
      if (!isSecure) {
        throw new Error(`Camera access requires HTTPS or localhost. Current protocol: ${window.location.protocol}, hostname: ${window.location.hostname}. Please access via https://${window.location.hostname}:8443 for camera access.`);
      }

      // 6. Enhanced Permission Handling
      let permissionStatus = 'prompt';
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const permissionResult = await navigator.permissions.query({ name: 'camera' });
          permissionStatus = permissionResult.state;

          permissionResult.onchange = () => {
            permissionStatus = permissionResult.state;
          };
        }
      } catch (permissionError) {
        // Could not check camera permissions
      }

      // 7. Handle Permission States
      if (permissionStatus === 'denied') {
        throw new Error('Camera access has been permanently denied. Please update your browser settings to allow camera access.');
      }

      // 8. Get Camera Constraints with selected camera
      const constraints = await getHighestResolutionConstraints();
      
      // Load selected cameras from localStorage
      const effectiveSelectedCameras = loadSelectedCamerasFromStorage();
      
      // Add deviceId constraint if a specific camera is selected
      if (effectiveSelectedCameras && effectiveSelectedCameras.length > 0 && cameraIndex < effectiveSelectedCameras.length) {
        constraints.video = {
          ...constraints.video,
          deviceId: { exact: effectiveSelectedCameras[cameraIndex] }
        };
        console.log(`Using camera ${cameraIndex + 1}/${effectiveSelectedCameras.length}: ${effectiveSelectedCameras[cameraIndex]}`);
      }

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
      
      // Add deviceId to fallback if a specific camera is selected
      if (selectedCameras && selectedCameras.length > 0 && cameraIndex < selectedCameras.length) {
        fallbackConstraints.video.deviceId = { exact: selectedCameras[cameraIndex] };
      }

      // 10. Try to Access Camera with Permission Handling
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          ...constraints,
          audio: false
        });
      } catch (error) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        } catch (fallbackError) {
          
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
          setIsVideoReady(true);
          
          // Expose video element to global scope for capture functions
          window.videoElement = video;
          
          if (wsStatus === 'connected') {
            processingInterval.current = setInterval(captureAndProcessFrame, 33);
          }
        } catch (playError) {
          // Handle specific play errors
          if (playError.name === 'AbortError') {
            return; // Don't throw error for abort
          } else if (playError.name === 'NotAllowedError') {
            // For autoplay blocked, just set video as ready and let it play when user interacts
            setIsVideoReady(true);
          } else {
            // For other errors, just set video as ready
            setIsVideoReady(true);
          }
        }
      }
    } catch (error) {
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
    // Clear processing interval first
    if (processingInterval.current) {
      clearInterval(processingInterval.current);
      processingInterval.current = null;
    }
    
    // Stop all tracks in the stream
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
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
      } catch (error) {
        // Error resetting video element
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
    }
  };

    // Start camera on component mount if isShowing is true or if hidden but active
  useEffect(() => {
    let isMounted = true;
    
    const handleCameraLifecycle = async () => {
      if ((isShowing || isHidden) && isMounted) {
        await startCamera();
      } else if (!isShowing && !isHidden && isMounted) {
        stopCamera();
      }
    };

    handleCameraLifecycle();
    
    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isShowing, isHidden, selectedCameras, cameraIndex]);

  // Setup FPS counter
  useEffect(() => {
    if (!isShowing && !isHidden) return;
    
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
  }, [isShowing, isHidden]);

  // Update dimensions when container size changes
  useEffect(() => {
    if (!isShowing && !isHidden) return;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isShowing, isHidden]);

  // Handle video element ready state
  useEffect(() => {
    if ((!isShowing && !isHidden) || !videoRef.current || !stream) return;
    
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

  if (!isShowing && !isHidden) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className={`${styles.cameraContainer} ${selectedCameras.length > 1 ? styles.dualCamera : ''} ${isHidden ? styles.hidden : ''}`}
      style={{
        position: 'relative',
        transform: 'none',
        top: 'auto',
        left: 'auto'
      }}
    >
      <video
        ref={videoRef}
        className={`${styles.cameraVideo} ${!isVideoReady ? styles.notReady : ''}`}
        playsInline
        muted
        autoPlay={false}
        onLoadedMetadata={() => {
          // Video metadata loaded
        }}
        onCanPlay={() => {
          // Try to play when video is ready
          if (videoRef.current && !isVideoReady) {
            videoRef.current.play().catch(error => {
              // Auto-play on canplay failed
            });
          }
        }}
        onPlay={() => {
          setIsVideoReady(true);
        }}
        onError={(e) => {
          setErrorMessage('Video playback error occurred');
        }}
      />
      <canvas
        ref={canvasRef}
        className={`${styles.cameraCanvas} ${!isLinked ? styles.hidden : ''}`}
      />
      {/* Camera label */}
      <div className={styles.cameraLabel}>
        Camera {cameraIndex + 1}
      </div>
      
      <div className={styles.cameraControls}>
        <button
          onClick={onClose}
          className={styles.cameraButton}
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
          className={`${styles.cameraButton} ${isLinked ? styles.unlinkButton : styles.linkButton}`}
        >
          {isLinked ? 'Unlink' : 'Link'}
        </button>
      </div>

      {/* Loading indicator */}
      {isStarting && (
        <div className={styles.cameraLoading}>
          <div className={styles.cameraLoadingIcon}>📷</div>
          <div className={styles.cameraLoadingText}>Starting camera...</div>
        </div>
      )}

      {/* HTTPS Camera Access Notice - Only show for camera-specific routes */}
      {shouldUseCameraPort() && (
        <div className={styles.cameraHttpsNotice}>
          <div className={styles.cameraHttpsIcon}>🔒</div>
          <div className={styles.cameraHttpsTitle}>Camera Access Required</div>
          <div className={styles.cameraHttpsMessage}>
            For security, camera access requires HTTPS on port 8443.
          </div>
          <button
            onClick={() => {
              const hostname = window.location.hostname;
              const newUrl = `https://${hostname}:8443${window.location.pathname}${window.location.search}`;
              window.location.href = newUrl;
            }}
            className={styles.cameraHttpsButton}
          >
            Access Camera Port
          </button>
        </div>
      )}





      {/* Status indicator */}
      <div className={styles.cameraStatus}>
        {isVideoReady ? `Camera ${cameraIndex + 1} Ready` : isStarting ? 'Starting...' : 'Camera Off'}
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
      <div className={styles.cameraLoadingPlaceholder}>
        <div className={styles.cameraLoadingPlaceholderIcon}>📷</div>
        <p className={styles.cameraLoadingPlaceholderText}>
          Loading camera...
        </p>
      </div>
    )
  }
);

export default CameraAccess;