// components/SetCalibrateButton.js
import React, { useState, useEffect } from 'react';
import CaptureHandler from './CaptureHandler';

const SetCalibrateButton = ({ 
  canvasRef, 
  setOutputText, 
  triggerCameraAccess, 
  toggleTopBar 
}) => {
  // State for calibration
  const [isCapturing, setIsCapturing] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const [currentCalibrationIndex, setCurrentCalibrationIndex] = useState(0);
  const [remainingCaptures, setRemainingCaptures] = useState(0);
  const [countdownValue, setCountdownValue] = useState(null);
  const [captureCounter, setCaptureCounter] = useState(1);
  const [processStatus, setProcessStatus] = useState('');

  // Initialize CaptureHandler
  const [captureHandler] = useState(() => new CaptureHandler(
    saveImageToServer,
    setCaptureCounter,
    setProcessStatus,
    toggleTopBar
  ));

  // Function to save images to server via API
  async function saveImageToServer(imageData, filename, type, folder) {
    try {
      const response = await fetch('/api/save-capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageData,
          filename,
          type,
          folder
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();
      console.log(`Saved ${type} image:`, result);
      return result;
    } catch (error) {
      console.error(`Error saving ${type} image:`, error);
      throw error;
    }
  }

  // Generate calibration points based on canvas dimensions
  const generateCalibrationPoints = () => {
    if (!canvasRef.current) {
      console.error("Canvas reference is null");
      return [];
    }
    
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    
    // Helper function to handle conditional rounding from Python code
    const conditionalRound = (dimension, percentage) => {
      const result = dimension * percentage;
      const check = (result * 10) % 2 === 0;
      return check ? Math.round(result) : Math.floor(result);
    };
    
    const firstFramePercentage = 0.12;
    const secondFramePercentage = 0.26;
    
    // Calculate points as in the Python code
    const xLeftFirst = conditionalRound(width, firstFramePercentage);
    const xRightFirst = width - conditionalRound(width, firstFramePercentage);
    const yTopFirst = conditionalRound(height, firstFramePercentage);
    const yBottomFirst = height - conditionalRound(height, firstFramePercentage);
    
    const xLeftSecond = conditionalRound(width, secondFramePercentage);
    const xRightSecond = width - conditionalRound(width, secondFramePercentage);
    const yTopSecond = conditionalRound(height, secondFramePercentage);
    const yBottomSecond = height - conditionalRound(height, secondFramePercentage);
    
    // Return array of points with exact same order as Python code
    return [
      // First frame - outer points
      { x: xLeftFirst, y: yTopFirst },           // dot1
      { x: Math.floor(width / 2), y: yTopFirst }, // dot2
      { x: xRightFirst, y: yTopFirst },          // dot3
      { x: xLeftFirst, y: Math.floor(height / 2) }, // dot4
      { x: xRightFirst, y: Math.floor(height / 2) }, // dot5
      { x: xLeftFirst, y: yBottomFirst },        // dot6
      { x: Math.floor(width / 2), y: yBottomFirst }, // dot7
      { x: xRightFirst, y: yBottomFirst },       // dot8
      
      // Second frame - inner points
      { x: xLeftSecond, y: yTopSecond },         // dot9
      { x: Math.floor(width / 2), y: yTopSecond }, // dot10
      { x: xRightSecond, y: yTopSecond },        // dot11
      { x: xLeftSecond, y: Math.floor(height / 2) }, // dot12
      { x: xRightSecond, y: Math.floor(height / 2) }, // dot13
      { x: xLeftSecond, y: yBottomSecond },      // dot14
      { x: Math.floor(width / 2), y: yBottomSecond }, // dot15
      { x: xRightSecond, y: yBottomSecond }      // dot16
    ];
  };

  // Draw a dot on the canvas
  const drawDot = (x, y, color = 'red', radius = 8) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("Canvas reference is null in drawDot");
      return null;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw dot with glow effect
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Add glow effect
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    return { x, y };
  };

  // Start countdown timer
  const startCountdown = (count, onComplete) => {
    setCountdownValue(count);
    setIsCapturing(true);
    
    // Update status
    setProcessStatus(`Calibration countdown: ${count}`);
    if (setOutputText) {
      setOutputText(`Calibration countdown: ${count}`);
    }
    
    const timer = setTimeout(() => {
      if (count > 1) {
        startCountdown(count - 1, onComplete);
      } else {
        // Final countdown step
        setCountdownValue(null);
        setProcessStatus('Capturing...');
        
        // Execute completion callback
        if (onComplete) {
          onComplete();
        }
      }
    }, 800);
    
    return () => clearTimeout(timer);
  };

  // Move to next calibration point
  const moveToNextCalibrationPoint = () => {
    const nextIndex = currentCalibrationIndex + 1;
    
    // Check if we've completed all points
    if (nextIndex >= calibrationPoints.length) {
      // Finish calibration
      setProcessStatus('Calibration completed');
      setRemainingCaptures(0);
      setIsCapturing(false);
      
      if (setOutputText) {
        setOutputText('Calibration sequence completed successfully');
      }
      
      // Show TopBar again
      if (toggleTopBar) {
        toggleTopBar(true);
      }
      
      return;
    }
    
    // Update state
    setCurrentCalibrationIndex(nextIndex);
    
    // Update progress indicators
    setProcessStatus(`Calibration Progress: ${nextIndex + 1}/${calibrationPoints.length}`);
    setRemainingCaptures(calibrationPoints.length - nextIndex);
    
    if (setOutputText) {
      setOutputText(`Calibration point ${nextIndex + 1} of ${calibrationPoints.length}`);
    }
    
    // Draw next point
    const nextPoint = calibrationPoints[nextIndex];
    const dotPosition = drawDot(nextPoint.x, nextPoint.y);
    
    // Start countdown for this point
    startCountdown(3, () => {
      // Capture images using CaptureHandler
      captureHandler.captureAndShowPreview(captureCounter, canvasRef, dotPosition);
      
      // Wait for preview duration plus a small buffer before moving to next point
      setTimeout(() => moveToNextCalibrationPoint(), 2300);
    });
  };

  // Set Calibrate Button - Start calibration sequence
  const handleSetCalibrate = () => {
    if (isCapturing) return;
    
    // Hide the TopBar before starting calibration
    if (toggleTopBar) {
      toggleTopBar(false);
    }
    
    setIsCapturing(true);
    
    // Generate calibration points
    const points = generateCalibrationPoints();
    setCalibrationPoints(points);
    setCurrentCalibrationIndex(0);
    
    if (points.length === 0) {
      console.error("Failed to generate calibration points");
      setIsCapturing(false);
      
      if (setOutputText) {
        setOutputText("Error: Failed to generate calibration points");
      }
      
      return;
    }
    
    // Start calibration sequence with first point
    setProcessStatus(`Calibration Progress: 1/${points.length}`);
    setRemainingCaptures(points.length);
    
    if (setOutputText) {
      setOutputText(`Starting calibration sequence with ${points.length} points`);
    }
    
    // Draw first calibration point
    const firstPoint = points[0];
    const dotPosition = drawDot(firstPoint.x, firstPoint.y);
    
    // Make sure we have camera access before starting
    if (triggerCameraAccess) {
      triggerCameraAccess(true);
    }
    
    // Start countdown for first point
    startCountdown(3, () => {
      // Capture images using CaptureHandler
      captureHandler.captureAndShowPreview(captureCounter, canvasRef, dotPosition);
      
      // Wait for preview duration plus a small buffer before moving to next point
      setTimeout(() => moveToNextCalibrationPoint(), 2300);
    });
  };
  
  // Create a countdown overlay if countdown is active
  const renderCountdownOverlay = () => {
    if (countdownValue === null || !canvasRef.current) return null;
    
    // Check if we have a current calibration point
    const currentPoint = calibrationPoints[currentCalibrationIndex];
    if (!currentPoint) return null;
    
    return (
      <div
        className="calibration-countdown"
        style={{
          position: 'absolute',
          left: `${currentPoint.x}px`,
          top: `${currentPoint.y - 60}px`,
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          color: 'red',
          fontSize: '36px',
          fontWeight: 'bold',
          padding: '5px 15px',
          borderRadius: '50%',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.3)',
          zIndex: 9999
        }}
      >
        {countdownValue}
      </div>
    );
  };

  // Use style similar to the ActionButton component
  return (
    <div className="set-calibrate-container">
      <button
        onClick={handleSetCalibrate}
        className="transition-colors py-2 px-4 rounded-md text-sm font-medium"
        style={{ 
          backgroundColor: isCapturing 
            ? 'rgba(200, 200, 200, 0.5)' 
            : 'rgba(124, 255, 218, 0.5)', 
          color: 'black',
          borderRadius: '7px',
          cursor: isCapturing ? 'not-allowed' : 'pointer',
          width: '100%'
        }}
        disabled={isCapturing}
      >
        Set Calibrate
      </button>
      
      {/* Display calibration status */}
      {(processStatus || remainingCaptures > 0) && (
        <div className="status-display mt-2 p-2 bg-blue-50 rounded-md">
          {processStatus && (
            <div className="text-sm font-medium text-blue-800">{processStatus}</div>
          )}
          {remainingCaptures > 0 && (
            <div className="text-sm font-medium text-yellow-600">
              Remaining points: {remainingCaptures}
            </div>
          )}
        </div>
      )}
      
      {/* Render countdown overlay */}
      {renderCountdownOverlay()}
    </div>
  );
};

export default SetCalibrateButton;