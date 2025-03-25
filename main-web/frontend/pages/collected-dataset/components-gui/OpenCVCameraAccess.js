// OpenCVCameraAccess.js
import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

const OpenCVCameraAccess = ({ 
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
  const [isOpenCVReady, setIsOpenCVReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cameraStream, setCameraStream] = useState(null);
  const [metrics, setMetrics] = useState({
    resolution: 'Detecting...',
    frameRate: '30 fps',
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    faceDetected: false
  });

  // Handle OpenCV script loading
  const handleOpenCVLoad = () => {
    if (window.cv) {
      console.log('OpenCV.js loaded successfully');
      setIsOpenCVReady(true);
      
      // If the camera should be showing, start it
      if (isShowing) {
        startCamera();
      }
    } else {
      console.error('OpenCV.js failed to load');
      setErrorMessage('Failed to load OpenCV library');
    }
  };

  // Effect to control camera based on showing state
  useEffect(() => {
    if (isShowing && isOpenCVReady) {
      startCamera();
    } else if (!isShowing && cameraActive) {
      stopCamera();
    }
    
    return () => {
      if (cameraActive) {
        stopCamera();
      }
    };
  }, [isShowing, isOpenCVReady]);

  // Start the camera with OpenCV
  const startCamera = async () => {
    try {
      if (!isOpenCVReady) {
        console.log('OpenCV not ready yet');
        return;
      }
      
      setErrorMessage('');
      
      // Try to get camera access through the browser's API first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      });
      
      // Store the stream and assign to video element
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          const videoWidth = videoRef.current.videoWidth;
          const videoHeight = videoRef.current.videoHeight;
          
          console.log(`Video dimensions: ${videoWidth}x${videoHeight}`);
          
          // Set canvas dimensions to match video
          if (canvasRef.current) {
            canvasRef.current.width = videoWidth;
            canvasRef.current.height = videoHeight;
          }
          
          // Update metrics
          setMetrics(prev => ({
            ...prev,
            resolution: `${videoWidth}x${videoHeight}`
          }));
          
          // Inform parent component that camera is ready
          if (onCameraReady) {
            onCameraReady({
              width: videoWidth,
              height: videoHeight,
              distance: 120 // Estimated distance in cm
            });
          }
        };
        
        // Start processing frames with OpenCV
        startOpenCVProcessing();
        setCameraActive(true);
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      setErrorMessage(`Failed to start camera: ${error.message}`);
    }
  };

  // Stop the camera
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setCameraActive(false);
  };

  // Process frames with OpenCV
  const startOpenCVProcessing = () => {
    if (!window.cv || !videoRef.current || !canvasRef.current) return;
    
    const FPS = 30;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const processingInterval = setInterval(() => {
      if (!cameraActive || !video.videoWidth) {
        return;
      }
      
      try {
        // Make sure dimensions match
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        
        // Draw the current frame to the canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get the image data for OpenCV processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Create OpenCV matrix from image data
        const src = cv.matFromImageData(imageData);
        
        // Process the image with OpenCV
        processWithOpenCV(src, canvas);
        
        // Clean up
        src.delete();
      } catch (error) {
        console.error('Error in OpenCV processing:', error);
      }
    }, 1000 / FPS);
    
    return () => clearInterval(processingInterval);
  };

  // OpenCV processing function
  const processWithOpenCV = (src, canvas) => {
    const ctx = canvas.getContext('2d');
    const dst = new cv.Mat();
    
    // Convert to grayscale for face detection
    cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
    
    // Load the face cascade if showBoundingBox or showHeadPose is enabled
    if (showBoundingBox || showHeadPose) {
      try {
        // Face detection with haar cascade
        // Note: You would need to load haarcascade_frontalface_default.xml
        const faces = new cv.RectVector();
        const faceCascade = new cv.CascadeClassifier();
        
        // Load the pre-trained classifier (you need to load this file)
        // This would typically be: faceCascade.load('haarcascade_frontalface_default.xml');
        // But for this example, we'll just simulate face detection
        
        // Simulate face detection here
        const faceDetected = Math.random() > 0.2; // 80% chance of detecting face
        
        if (faceDetected) {
          // Create a simulated face rectangle in the center
          const centerX = src.cols / 2;
          const centerY = src.rows / 2;
          const faceWidth = src.cols * 0.4;
          const faceHeight = src.rows * 0.4;
          
          const faceRect = new cv.Rect(
            centerX - faceWidth/2,
            centerY - faceHeight/2,
            faceWidth,
            faceHeight
          );
          
          faces.push_back(faceRect);
          
          // Draw the face rectangle if showBoundingBox is enabled
          if (showBoundingBox) {
            cv.rectangle(
              src,
              new cv.Point(faceRect.x, faceRect.y),
              new cv.Point(faceRect.x + faceRect.width, faceRect.y + faceRect.height),
              [255, 0, 0, 255],
              2
            );
          }
          
          // Draw head pose if enabled
          if (showHeadPose) {
            const centerPoint = new cv.Point(
              faceRect.x + faceRect.width/2,
              faceRect.y + faceRect.height/2
            );
            
            // Draw X axis (red)
            cv.line(
              src,
              centerPoint,
              new cv.Point(
                centerPoint.x + Math.cos(Date.now()/1000) * faceRect.width/2,
                centerPoint.y
              ),
              [255, 0, 0, 255],
              2
            );
            
            // Draw Y axis (green)
            cv.line(
              src,
              centerPoint,
              new cv.Point(
                centerPoint.x,
                centerPoint.y + Math.sin(Date.now()/1000) * faceRect.height/2
              ),
              [0, 255, 0, 255],
              2
            );
            
            // Draw Z axis (blue)
            cv.line(
              src,
              centerPoint,
              new cv.Point(
                centerPoint.x + Math.cos(Date.now()/800) * faceRect.width/4,
                centerPoint.y + Math.sin(Date.now()/800) * faceRect.height/4
              ),
              [0, 0, 255, 255],
              2
            );
          }
          
          // Draw face mask if enabled
          if (showMask) {
            // Simulate face mask as an alpha-blended overlay
            const maskColor = [0, 255, 255, 128]; // Cyan with 50% transparency
            
            const maskMat = new cv.Mat(src.rows, src.cols, src.type(), [0, 0, 0, 0]);
            const center = new cv.Point(faceRect.x + faceRect.width/2, faceRect.y + faceRect.height/2);
            const radius = Math.min(faceRect.width, faceRect.height) / 2;
            
            // Draw a circle for the face mask
            cv.circle(maskMat, center, radius, maskColor, -1);
            
            // Blend the mask with the original image
            cv.addWeighted(src, 1, maskMat, 0.5, 0, src);
            
            maskMat.delete();
          }
          
          // Update metrics
          setMetrics(prev => ({
            ...prev,
            headPose: {
              pitch: Math.round(Math.sin(Date.now()/1000) * 20),
              yaw: Math.round(Math.cos(Date.now()/1000) * 30),
              roll: Math.round(Math.sin(Date.now()/500) * 15)
            },
            faceDetected: true
          }));
        } else {
          // Update metrics to show no face detected
          setMetrics(prev => ({
            ...prev,
            faceDetected: false
          }));
        }
        
        // Clean up
        faces.delete();
        faceCascade.delete();
      } catch (error) {
        console.error('Error in face detection:', error);
      }
    }
    
    // Convert back to RGBA for canvas
    cv.cvtColor(dst, src, cv.COLOR_GRAY2RGBA);
    
    // Display the processed image on the canvas
    cv.imshow(canvas, src);
    
    // Draw parameters if enabled
    if (showParameters) {
      // Add text overlay after imshow so OpenCV doesn't process it
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(10, canvas.height - 70, 150, 60);
      
      ctx.font = '12px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText(`Resolution: ${metrics.resolution}`, 15, canvas.height - 55);
      ctx.fillText(`FPS: ${metrics.frameRate}`, 15, canvas.height - 40);
      ctx.fillText(`Face: ${metrics.faceDetected ? 'Detected' : 'Not Detected'}`, 15, canvas.height - 25);
      
      if (metrics.faceDetected) {
        ctx.fillText(`Pose: P:${metrics.headPose.pitch}° Y:${metrics.headPose.yaw}° R:${metrics.headPose.roll}°`, 15, canvas.height - 10);
      }
    }
    
    dst.delete();
  };

  if (!isShowing) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '320px',
      height: '240px',
      background: 'black',
      border: '2px solid #0066cc',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
      zIndex: 999
    }}>
      {/* Load OpenCV.js */}
      <Script
        src="https://docs.opencv.org/4.5.5/opencv.js"
        onLoad={handleOpenCVLoad}
        onError={() => setErrorMessage('Failed to load OpenCV library')}
      />
      
      {!isOpenCVReady && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: '#f0f8ff',
          padding: '10px',
          textAlign: 'center'
        }}>
          <p style={{ fontWeight: 'bold', color: '#0066cc' }}>Loading OpenCV...</p>
        </div>
      )}
      
      {errorMessage && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: '#fff0f0',
          padding: '10px',
          textAlign: 'center'
        }}>
          <p style={{ color: 'red', fontWeight: 'bold', marginBottom: '10px' }}>{errorMessage}</p>
          <button
            onClick={startCamera}
            style={{
              padding: '8px 16px',
              background: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Try Again
          </button>
        </div>
      )}
      
      {/* Close button */}
      <div style={{ position: 'absolute', top: '5px', right: '5px', zIndex: 1010 }}>
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
      
      {/* Video element (hidden, used for capturing camera feed) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: isOpenCVReady ? 'none' : 'block',
          backgroundColor: 'black'
        }}
      />
      
      {/* Canvas for OpenCV processing */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: isOpenCVReady ? 'block' : 'none'
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
        OpenCV: {isOpenCVReady ? 'Ready' : 'Loading'} | Camera: {cameraActive ? 'Active' : 'Inactive'}
      </div>
    </div>
  );
};

export default OpenCVCameraAccess;