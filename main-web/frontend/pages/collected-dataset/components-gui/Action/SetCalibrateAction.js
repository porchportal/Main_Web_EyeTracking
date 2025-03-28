// components/Action/SetCalibrateAction.js
import React, { useState } from 'react';
import { showImagePreview } from './DotCaptureUtil';
import ImageProcessor from './ImageProcessor';

const SetCalibrateAction = ({ canvasRef, onStatusUpdate, triggerCameraAccess }) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const [currentCalibrationIndex, setCurrentCalibrationIndex] = useState(0);
  const [imageProcessor] = useState(() => new ImageProcessor());
  const [captureCounter, setCaptureCounter] = useState(1);

  // Generate calibration points based on canvas dimensions
  const generateCalibrationPoints = () => {
    if (!canvasRef.current) return [];
    
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    
    // Helper function to handle conditional rounding
    const conditionalRound = (dimension, percentage) => {
      const result = dimension * percentage;
      return Math.round(result);
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
    
    // Return array of points
    return [
      // First frame - outer points
      { x: xLeftFirst, y: yTopFirst },
      { x: Math.floor(width / 2), y: yTopFirst },
      { x: xRightFirst, y: yTopFirst },
      { x: xLeftFirst, y: Math.floor(height / 2) },
      { x: xRightFirst, y: Math.floor(height / 2) },
      { x: xLeftFirst, y: yBottomFirst },
      { x: Math.floor(width / 2), y: yBottomFirst },
      { x: xRightFirst, y: yBottomFirst },
      
      // Second frame - inner points
      { x: xLeftSecond, y: yTopSecond },
      { x: Math.floor(width / 2), y: yTopSecond },
      { x: xRightSecond, y: yTopSecond },
      { x: xLeftSecond, y: Math.floor(height / 2) },
      { x: xRightSecond, y: Math.floor(height / 2) },
      { x: xLeftSecond, y: yBottomSecond },
      { x: Math.floor(width / 2), y: yBottomSecond },
      { x: xRightSecond, y: yBottomSecond }
    ];
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
    // Check for dot position to determine if we should show countdown below instead of above
    const canvas = canvasRef.current;
    const dot = canvas ? document.querySelector('.calibration-dot') : null;
    const dotRect = dot ? dot.getBoundingClientRect() : null;
    const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
    
    // Calculate if dot is near the top of the screen
    const isNearTop = dotRect && canvasRect 
      ? (dotRect.top - canvasRect.top) < (canvas.height * 0.2)
      : false;
    
    // Update status with countdown
    onStatusUpdate({
      countdownValue: {
        value: count,
        isNearTop: isNearTop
      },
      isCapturing: true
    });
    
    const timer = setTimeout(() => {
      if (count > 1) {
        startCountdown(count - 1, onComplete);
      } else {
        // When count is 1, immediately clear countdown and execute callback
        onStatusUpdate({
          countdownValue: null
        });
        
        // Execute completion callback
        if (onComplete) onComplete();
      }
    }, 800);
    
    return () => clearTimeout(timer);
  };

  // Capture images and show preview
  const captureImages = async (position) => {
    try {
      // Trigger camera access if needed
      if (triggerCameraAccess) {
        await triggerCameraAccess();
        // Small delay to ensure camera is initialized
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Format counter for filenames
      const counter = String(captureCounter).padStart(3, '0');
      const screenFilename = `cal_screen_${counter}.jpg`;
      const webcamFilename = `cal_webcam_${counter}.jpg`;
      
      // Capture screen image from canvas
      const screenImage = await imageProcessor.captureScreenImage(
        canvasRef, 
        screenFilename
      );
      
      // Capture webcam image
      const webcamImage = await imageProcessor.captureWebcamImage(
        webcamFilename
      );
      
      // Increment counter for next capture
      setCaptureCounter(prev => prev + 1);
      
      // Show preview for exactly 2 seconds using showImagePreview utility
      if (screenImage || webcamImage) {
        const previewElement = showImagePreview(screenImage, webcamImage, position);
        
        // Wait exactly 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Remove preview
        if (previewElement && previewElement.parentNode) {
          // Add fade-out animation
          previewElement.style.transition = 'opacity 0.3s ease';
          previewElement.style.opacity = '0';
          
          // Remove after animation completes
          setTimeout(() => {
            previewElement.remove();
          }, 300);
        }
      }
      
      // Stop the webcam to free resources
      imageProcessor.stopWebcam();
      
    } catch (error) {
      console.error('Error capturing calibration point:', error);
      onStatusUpdate({
        processStatus: `Error: ${error.message}`
      });
    }
  };

  // Move to next calibration point
  const moveToNextCalibrationPoint = () => {
    const nextIndex = currentCalibrationIndex + 1;
    
    // Check if we've completed all points
    if (nextIndex >= calibrationPoints.length) {
      // Finish calibration
      onStatusUpdate({
        processStatus: 'Calibration completed',
        remainingCaptures: 0,
        isCapturing: false
      });
      
      setIsCapturing(false);
      
      // Clear status after a delay
      setTimeout(() => {
        onStatusUpdate({
          processStatus: ''
        });
      }, 2000);
      
      return;
    }
    
    // Update state
    setCurrentCalibrationIndex(nextIndex);
    
    // Update progress indicators
    onStatusUpdate({
      processStatus: `Calibration Progress: ${nextIndex + 1}/${calibrationPoints.length}`,
      remainingCaptures: calibrationPoints.length - nextIndex
    });
    
    // Draw next point
    const nextPoint = calibrationPoints[nextIndex];
    const dotPosition = drawDot(nextPoint.x, nextPoint.y);
    
    // Start countdown for this point
    startCountdown(3, () => {
      captureImages(dotPosition);
      setTimeout(() => moveToNextCalibrationPoint(), 2300); // Wait for preview duration plus a small buffer
    });
  };

  // Set Calibrate Button - Start calibration sequence
  const handleSetCalibrate = () => {
    if (isCapturing) return;
    
    setIsCapturing(true);
    
    // Generate calibration points
    const points = generateCalibrationPoints();
    setCalibrationPoints(points);
    setCurrentCalibrationIndex(0);
    
    if (points.length === 0) {
      console.error("Failed to generate calibration points");
      setIsCapturing(false);
      return;
    }
    
    // Start calibration sequence with first point
    onStatusUpdate({
      processStatus: `Calibration Progress: 1/${points.length}`,
      remainingCaptures: points.length,
      isCapturing: true
    });
    
    // Draw first calibration point
    const firstPoint = points[0];
    const dotPosition = drawDot(firstPoint.x, firstPoint.y);
    
    // Start countdown for first point
    startCountdown(3, () => {
      captureImages(dotPosition);
      setTimeout(() => moveToNextCalibrationPoint(), 2300); // Wait for preview duration plus a small buffer
    });
  };

  return {
    component: (
      <button
        onClick={handleSetCalibrate}
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
        Set Calibrate
      </button>
    ),
    isCapturing,
    drawDot,
    calibrationPoints,
    currentCalibrationIndex,
    handleAction: handleSetCalibrate
  };
};

export default SetCalibrateAction;