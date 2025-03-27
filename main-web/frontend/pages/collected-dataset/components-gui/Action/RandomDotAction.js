// components/Action/RandomDotAction.js
import React, { useState, useRef, useEffect } from 'react';

const RandomDotAction = ({ canvasRef, onStatusUpdate, triggerCameraAccess, toggleTopBar }) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState({ screen: null, webcam: null });
  const [captureCounter, setCaptureCounter] = useState(1); // Track number of captures
  const [captureFolder, setCaptureFolder] = useState(''); // Store capture folder name
  const [currentDot, setCurrentDot] = useState(null);
  const [countdownValue, setCountdownValue] = useState(null);
  
  // Reference to store webcam video element
  const webcamRef = useRef(null);

  // Create a folder for the capture session if it doesn't exist
  useEffect(() => {
    if (!captureFolder) {
      // Generate a folder name based on current timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const folderName = `captures_${timestamp}`;
      setCaptureFolder(folderName);
      
      // In a real implementation, you would create the folder here
      console.log(`Created capture folder: ${folderName}`);
    }
  }, [captureFolder]);

  // Generate a random position on the canvas
  const getRandomPosition = () => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    
    // Ensure we're not too close to the edges
    const padding = 20;
    return {
      x: Math.floor(Math.random() * (width - 2 * padding)) + padding,
      y: Math.floor(Math.random() * (height - 2 * padding)) + padding
    };
  };

  // Draw a dot on the canvas
  const drawDot = (x, y, color = 'red', radius = 8) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear previous dot
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw new dot with glow effect
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Add glow effect
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Store current dot position
    setCurrentDot({ x, y });
    
    return { x, y }; // Return the position for reference
  };
  
  // Start enhanced countdown timer that adapts to dot position
  const startCountdown = (count, onComplete) => {
    // Check if dot is near the top of the screen
    const canvas = canvasRef.current;
    const isNearTop = currentDot && canvas ? (currentDot.y < canvas.height * 0.2) : false;
    
    // Update status with countdown and position info
    onStatusUpdate({
      countdownValue: {
        value: count,
        isNearTop
      },
      isCapturing: true
    });
    
    const timer = setTimeout(() => {
      if (count > 1) {
        startCountdown(count - 1, onComplete);
      } else {
        // When count reaches 1, immediately hide the countdown and execute the callback
        onStatusUpdate({
          countdownValue: null
        });
        
        // Execute completion callback immediately
        if (onComplete) onComplete();
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  };

  // Capture screen image (canvas content)
  const captureScreenImage = (position) => {
    console.log('Capturing screen at dot position:', position);
    
    // Capture the current canvas as an image
    const canvas = canvasRef.current;
    if (canvas) {
      const screenImage = canvas.toDataURL('image/png');
      
      // In a real implementation, you would save the image to the filesystem
      // For example using a backend API endpoint:
      const filename = `screen_${String(captureCounter).padStart(3, '0')}.jpg`;
      console.log(`Saving screen capture to: ${captureFolder}/${filename}`);
      
      // Simulate saving image data
      saveImageToServer(screenImage, `${captureFolder}/${filename}`, 'screen');
      
      return { 
        data: screenImage,
        filename: filename
      };
    }
    return null;
  };

  // Capture webcam image
  const captureWebcamImage = () => {
    console.log('Capturing webcam image');
    
    // In a real implementation, this would access the webcam
    // For example with getUserMedia or a webcam library
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
      
      // Save the webcam image
      const filename = `webcam_${String(captureCounter).padStart(3, '0')}.jpg`;
      console.log(`Saving webcam capture to: ${captureFolder}/${filename}`);
      
      // Simulate saving image data
      saveImageToServer(webcamImage, `${captureFolder}/${filename}`, 'webcam');
      
      return { 
        data: webcamImage,
        filename: filename
      };
    }
    
    // Fallback message if webcam isn't available
    console.error('Webcam not available');
    return null;
  };

  // Simulate saving image to server
  const saveImageToServer = (imageData, filename, type) => {
    // In a real implementation, this would be an API call to save the image
    // For example using fetch or axios:
    if (typeof fetch === 'function') {
      fetch('/api/save-capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageData: imageData,
          filename: filename,
          type: type,
          folder: captureFolder
        })
      })
      .then(response => response.json())
      .then(data => {
        console.log(`Successfully saved ${type} image:`, data);
      })
      .catch(error => {
        console.error(`Error saving ${type} image:`, error);
      });
    } else {
      // For now, we'll just log it
      console.log(`Saving ${type} image as ${filename}`);
    }
  };

  // Handle both captures and display results
  const handleCaptures = (position) => {
    // Trigger camera access if it's not already active
    if (triggerCameraAccess) {
      triggerCameraAccess(true); // Force camera to be on
    }
    
    // Wait a moment for camera to initialize
    setTimeout(() => {
      // Capture both images
      const screenCapture = captureScreenImage(position);
      const webcamCapture = captureWebcamImage();
      
      // Store captured images
      setCapturedImages({
        screen: screenCapture,
        webcam: webcamCapture
      });
      
      // Increment the counter for next capture
      setCaptureCounter(prev => prev + 1);
      
      // Update status
      setIsCapturing(false);
      onStatusUpdate({
        processStatus: 'Images captured and saved successfully',
        isCapturing: false
      });
      
      // Show the top bar again after a brief delay
      setTimeout(() => {
        if (toggleTopBar) {
          toggleTopBar(true); // Show top bar again
        }
      }, 1000);
      
      // Clear status after a delay
      setTimeout(() => {
        onStatusUpdate({
          processStatus: ''
        });
      }, 3000);
    }, 500);
  };

  // Draw Random Dot and capture
  const handleRandomDot = () => {
    if (isCapturing) return;
    
    console.log("RandomDotAction: Random Dot button clicked"); // Debug logging
    
    // Hide the top bar during capture
    if (toggleTopBar) {
      toggleTopBar(false);
    }
    
    setIsCapturing(true);
    onStatusUpdate({
      processStatus: 'Preparing random dot...',
      isCapturing: true
    });
    
    // Ensure canvas is properly setup before drawing
    setTimeout(() => {
      // Make sure canvas dimensions are properly set
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error("Canvas reference is null");
        setIsCapturing(false);
        onStatusUpdate({
          processStatus: 'Error: Canvas not found',
          isCapturing: false
        });
        return;
      }
      
      // Get the parent container dimensions
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
      
      console.log("Canvas dimensions:", canvas.width, "x", canvas.height);
      
      // Generate random position and draw
      const position = getRandomPosition();
      console.log("Drawing dot at position:", position); // Debug logging
      
      // Draw dot directly on canvas
      const dotInfo = drawDot(position.x, position.y);
      
      // Start countdown and then capture
      // The countdown will automatically adjust based on dot position
      startCountdown(3, () => {
        handleCaptures(dotInfo);
      });
    }, 200);
  };


  // Component that renders countdown overlay for dot
  const CountdownOverlay = () => {
    if (!countdownValue || !currentDot) return null;
    
    // Check if this is a simple number or an object with position info
    let count, isNearTop;
    if (typeof countdownValue === 'object') {
      count = countdownValue.value;
      isNearTop = countdownValue.isNearTop;
    } else {
      count = countdownValue;
      // Default positioning based on dot position (if available)
      const canvas = canvasRef.current;
      isNearTop = currentDot && canvas ? (currentDot.y < canvas.height * 0.2) : false;
    }
    
    // Only render if we have a valid count
    if (count === null || count === undefined) return null;
    
    return (
      <div 
        className="dot-countdown-overlay"
        style={{
          position: 'absolute',
          left: `${currentDot.x - 15}px`,
          // If near top, show below the dot, otherwise show above
          top: isNearTop ? `${currentDot.y + 30}px` : `${currentDot.y - 50}px`,
          color: 'red',
          fontSize: '32px',
          fontWeight: 'bold',
          textShadow: '0 0 5px white, 0 0 10px white',
          zIndex: 1000,
          textAlign: 'center',
          width: '40px',
          height: '40px',
          lineHeight: '40px'
        }}
      >
        {count}
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
        <CountdownOverlay />
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