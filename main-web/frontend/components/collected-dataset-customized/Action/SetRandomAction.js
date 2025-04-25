// components/Action/SetRandomAction.js
import React, { useState } from 'react';

const SetRandomAction = ({ canvasRef, onStatusUpdate }) => {
  const [randomTimes, setRandomTimes] = useState(1);
  const [delaySeconds, setDelaySeconds] = useState(3);
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
      processStatus: "Countdown",
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
    
    // In a real implementation, this would access the webcam and save
    setTimeout(() => {
      onStatusUpdate({
        isCapturing: false
      });
    }, 800);
  };

  // Generate multiple random dots
  const scheduleMultipleCaptures = (remaining, times, delay) => {
    if (remaining <= 0) {
      onStatusUpdate({
        processStatus: 'Random capture sequence completed',
        remainingCaptures: 0,
        isCapturing: false
      });
      return;
    }
    
    onStatusUpdate({
      processStatus: `Capture ${times - remaining + 1} of ${times}`,
      remainingCaptures: remaining
    });
    
    // Generate random position and draw dot
    const position = getRandomPosition();
    const dotPosition = drawDot(position.x, position.y);
    
    // Start countdown and then capture
    startCountdown(3, () => {
      captureImage(dotPosition);
      
      // Schedule next capture after delay
      setTimeout(() => {
        scheduleMultipleCaptures(remaining - 1, times, delay);
      }, delay * 1000);
    });
  };

  // Main handler for Set Random button
  const handleSetRandom = () => {
    if (isCapturing) return;
    
    // Parse input values
    const times = parseInt(randomTimes);
    const delay = parseInt(delaySeconds);
    
    if (isNaN(times) || times <= 0 || isNaN(delay) || delay <= 0) {
      alert("Please enter positive numbers for Times and Delay");
      return;
    }
    
    setIsCapturing(true);
    
    // Update UI status
    onStatusUpdate({
      processStatus: `Starting ${times} random captures...`,
      remainingCaptures: times,
      isCapturing: true
    });
    
    // Start capture sequence after a small delay
    setTimeout(() => {
      scheduleMultipleCaptures(times, times, delay);
    }, 100);
  };

  return {
    component: (
      <div className="set-random-action">
        <div className="input-controls flex mb-2">
          <div className="input-group mr-4">
            <label className="block text-sm mb-1">Times:</label>
            <input
              type="number"
              value={randomTimes}
              onChange={(e) => setRandomTimes(e.target.value)}
              className="w-16 bg-mint-green p-1 border border-gray-300 rounded"
              min="1"
              disabled={isCapturing}
            />
          </div>
          
          <div className="input-group">
            <label className="block text-sm mb-1">Delay(s):</label>
            <input
              type="number"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(e.target.value)}
              className="w-16 bg-mint-green p-1 border border-gray-300 rounded"
              min="1"
              disabled={isCapturing}
            />
          </div>
        </div>
        
        <button
          onClick={handleSetRandom}
          disabled={isCapturing}
          className="app-button w-full"
          style={{
            backgroundColor: '#7CFFDA',
            border: '1px solid #000',
            padding: '3px 10px',
            marginBottom: '5px',
            cursor: isCapturing ? 'not-allowed' : 'pointer',
            opacity: isCapturing ? 0.6 : 1
          }}
        >
          Set Random
        </button>
      </div>
    ),
    isCapturing,
    drawDot,
    getRandomPosition,
    startCountdown,
    handleAction: handleSetRandom
  };
};

export default SetRandomAction;