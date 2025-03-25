// components/Action/RandomDotAction.js
import React, { useState } from 'react';

const RandomDotAction = ({ canvasRef, onStatusUpdate, triggerCameraAccess }) => {
  const [isCapturing, setIsCapturing] = useState(false);

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

  // Simulate capturing an image
  const captureImage = (position) => {
    console.log('Capturing image at dot position:', position);
    
    // Trigger camera access if needed
    if (triggerCameraAccess) {
      triggerCameraAccess();
    }
    
    // In a real implementation, this would save the image
    setTimeout(() => {
      setIsCapturing(false);
      onStatusUpdate({
        processStatus: 'Random dot captured',
        isCapturing: false
      });
      
      // Clear status after a delay
      setTimeout(() => {
        onStatusUpdate({
          processStatus: ''
        });
      }, 2000);
    }, 800);
  };

  // Draw Random Dot and capture
  const handleRandomDot = () => {
    if (isCapturing) return;
    
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
      captureImage(dotPosition);
    });
  };

  return {
    component: (
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
    ),
    isCapturing,
    drawDot,
    getRandomPosition,
    startCountdown,
    handleAction: handleRandomDot
  };
};

export default RandomDotAction;