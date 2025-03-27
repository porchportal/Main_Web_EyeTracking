// components/Action/RandomDotAction.js
import React, { useState, useRef } from 'react';

const RandomDotAction = ({ canvasRef, onStatusUpdate, triggerCameraAccess, toggleTopBar }) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState({ screen: null, webcam: null });
  const [showImagePreviews, setShowImagePreviews] = useState(false);
  
  // Reference to store webcam video element
  const webcamRef = useRef(null);

  // Generate a random position on the canvas
  const getRandomPosition = () => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    
    return {
      x: Math.floor(Math.random() * (width - 20)) + 10,
      y: Math.floor(Math.random() * (height - 20)) + 10
    };
  };

  // Draw a dot on the canvas
  const drawDot = (x, y, color = 'red', radius = 5) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear previous dot
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw new dot
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    return { x, y }; // Return the position for reference
  };

  // Start countdown timer
  const startCountdown = (count, onComplete) => {
    // Update status with countdown
    onStatusUpdate({
      countdownValue: count,
      isCapturing: true
    });
    
    const timer = setTimeout(() => {
      if (count > 1) {
        startCountdown(count - 1, onComplete);
      } else {
        // Final countdown step
        onStatusUpdate({
          countdownValue: "Capturing...",
          isCapturing: true
        });
        
        setTimeout(() => {
          // Clear countdown
          onStatusUpdate({
            countdownValue: null
          });
          
          // Execute completion callback
          if (onComplete) onComplete();
        }, 1000);
      }
    }, 800);
    
    return () => clearTimeout(timer);
  };

  // Capture screen image (canvas content)
  const captureScreenImage = (position) => {
    console.log('Capturing screen at dot position:', position);
    
    // Capture the current canvas as an image
    const canvas = canvasRef.current;
    if (canvas) {
      const screenImage = canvas.toDataURL('image/png');
      return screenImage;
    }
    return null;
  };

  // Capture webcam image
  const captureWebcamImage = () => {
    console.log('Capturing webcam image');
    
    // Trigger camera access if needed
    if (triggerCameraAccess) {
      triggerCameraAccess();
    }
    
    // If we have access to a video element from the camera component
    if (window.videoElement) {
      // Create a temporary canvas to capture the current video frame
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      
      // Set the canvas dimensions to match the video
      tempCanvas.width = window.videoElement.videoWidth;
      tempCanvas.height = window.videoElement.videoHeight;
      
      // Draw the current video frame onto the canvas
      ctx.drawImage(window.videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // Convert the canvas to a data URL
      const webcamImage = tempCanvas.toDataURL('image/png');
      return webcamImage;
    }
    
    // Fallback message if webcam isn't available
    return null;
  };

  // Handle both captures and display results
  const handleCaptures = (position) => {
    // Capture both images
    const screenImage = captureScreenImage(position);
    const webcamImage = captureWebcamImage();
    
    // Store captured images
    setCapturedImages({
      screen: screenImage,
      webcam: webcamImage
    });
    
    // In a real implementation, you might want to save these images or process them
    
    // Show the top bar again
    if (toggleTopBar) {
      setTimeout(() => {
        toggleTopBar(true); // Pass true to ensure it shows the top bar
      }, 500);
    }
    
    // Update status
    setTimeout(() => {
      setIsCapturing(false);
      onStatusUpdate({
        processStatus: 'Images captured successfully',
        isCapturing: false
      });
      
      // Show image previews
      setShowImagePreviews(true);
      
      // Clear status after a delay
      setTimeout(() => {
        onStatusUpdate({
          processStatus: ''
        });
      }, 3000);
    }, 800);
  };

  // Draw Random Dot and capture
  const handleRandomDot = () => {
    if (isCapturing) return;
    
    // Hide image previews if they were shown
    setShowImagePreviews(false);
    
    // Hide the top bar
    if (toggleTopBar) {
      toggleTopBar(false);
    }
    
    setIsCapturing(true);
    onStatusUpdate({
      processStatus: 'Preparing random dot...',
      isCapturing: true
    });
    
    // Generate random position and draw dot
    const position = getRandomPosition();
    const dotPosition = drawDot(position.x, position.y);
    
    // Start countdown and then capture
    startCountdown(3, () => {
      handleCaptures(dotPosition);
    });
  };

  // Component for displaying image previews
  const ImagePreviews = () => {
    if (!showImagePreviews || !capturedImages.screen) return null;
    
    return (
      <div className="image-previews" style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        gap: '10px',
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
      }}>
        <div className="preview-item">
          <div style={{ color: 'white', fontSize: '12px', marginBottom: '4px' }}>Screen</div>
          <img 
            src={capturedImages.screen} 
            alt="Screen Capture" 
            style={{ maxWidth: '150px', maxHeight: '100px', border: '1px solid #ccc' }}
          />
        </div>
        
        {capturedImages.webcam && (
          <div className="preview-item">
            <div style={{ color: 'white', fontSize: '12px', marginBottom: '4px' }}>Webcam</div>
            <img 
              src={capturedImages.webcam} 
              alt="Webcam Capture" 
              style={{ maxWidth: '150px', maxHeight: '100px', border: '1px solid #ccc' }}
            />
          </div>
        )}
        
        <button 
          onClick={() => setShowImagePreviews(false)} 
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
      </div>
    );
  };

  return {
    component: (
      <>
        <button
          onClick={handleRandomDot}
          disabled={isCapturing}
          className="app-button w-full"
          style={{
            backgroundColor: '#7CFFDA',
            border: '1px solid #000',
            padding: '3px 10px',
            cursor: isCapturing ? 'not-allowed' : 'pointer',
            opacity: isCapturing ? 0.6 : 1
          }}
        >
          Random Dot
        </button>
        <ImagePreviews />
      </>
    ),
    isCapturing,
    drawDot,
    getRandomPosition,
    startCountdown,
    handleAction: handleRandomDot
  };
};

export default RandomDotAction;