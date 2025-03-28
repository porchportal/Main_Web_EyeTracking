import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

// Create a basic ActionButton component
const ActionButton = ({ text, abbreviatedText, onClick, customClass = '', disabled = false, active = false }) => {
  const [isAbbreviated, setIsAbbreviated] = useState(false);
  
  // Check window size and set abbreviated mode
  useEffect(() => {
    // Skip during SSR
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      const width = window.innerWidth;
      setIsAbbreviated(width < 768);
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <button
      onClick={onClick}
      className={`transition-colors py-2 px-2 md:px-4 rounded-md text-xs md:text-sm font-medium ${customClass} ${active ? 'active-button' : ''}`}
      style={{ 
        backgroundColor: active 
          ? 'rgba(0, 102, 204, 0.7)' 
          : disabled 
            ? 'rgba(200, 200, 200, 0.5)' 
            : 'rgba(124, 255, 218, 0.5)', 
        color: active ? 'white' : 'black',
        borderRadius: '7px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: active ? 'bold' : 'normal',
        boxShadow: active ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
      }}
      disabled={disabled}
    >
      {isAbbreviated ? abbreviatedText : text}
    </button>
  );
};

// Create the ActionButtonGroup component with client-side only rendering
const ActionButtonGroupInner = ({ triggerCameraAccess, isCompactMode, onActionClick }) => {
  // State for button actions
  const [isCapturing, setIsCapturing] = useState(false);
  const [randomTimes, setRandomTimes] = useState(1);
  const [delaySeconds, setDelaySeconds] = useState(3);
  const canvasRef = useRef(null);
  const [processStatus, setProcessStatus] = useState('');
  const [countdownValue, setCountdownValue] = useState(null);
  const [currentDot, setCurrentDot] = useState(null);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const [currentCalibrationIndex, setCurrentCalibrationIndex] = useState(0);
  const [remainingCaptures, setRemainingCaptures] = useState(0);
  const [showCanvas, setShowCanvas] = useState(false);
  
  // Track the capture count
  const [captureCount, setCaptureCount] = useState(1);
  
  // Toggle states
  const [showHeadPose, setShowHeadPose] = useState(false);
  const [showBoundingBox, setShowBoundingBox] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [showParameters, setShowParameters] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Update canvas dimensions when the component mounts or window resizes
  useEffect(() => {
    // Skip during SSR
    if (typeof window === 'undefined') return;
    
    const updateCanvasDimensions = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Set canvas dimensions to match its display size
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    
    if (canvasRef.current) {
      updateCanvasDimensions();
    }
    
    const handleResize = () => {
      if (canvasRef.current) {
        updateCanvasDimensions();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [showCanvas]);

  // Draw a dot on the canvas
  const drawDot = (x, y, color = 'red', radius = 5) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear previous dot if any
    clearCanvas();
    
    // Draw new dot
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Save current dot position
    setCurrentDot({ x, y });
  };

  // Clear the canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setCurrentDot(null);
  };

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

  // Countdown timer function
  const startCountdown = (count, onComplete) => {
    setIsCapturing(true);
    setCountdownValue(count);
    
    const countdownInterval = setInterval(() => {
      setCountdownValue(prev => {
        const newCount = prev - 1;
        
        if (newCount <= 0) {
          clearInterval(countdownInterval);
          setTimeout(() => {
            setCountdownValue('Capturing...');
            setTimeout(() => {
              setCountdownValue(null);
              if (onComplete) onComplete();
            }, 1000);
          }, 100);
          return 'Capturing...';
        }
        
        return newCount;
      });
    }, 800);
  };

  // Function to capture both screen and webcam images
  const captureImages = (x, y) => {
    // Generate filenames with zero-padded numbers
    const counter = String(captureCount).padStart(3, '0');
    const screenFilename = `screen_${counter}.jpg`;
    const webcamFilename = `webcam_${counter}.jpg`;
    
    // Capture the screen (canvas with the dot)
    const canvas = canvasRef.current;
    if (canvas) {
      const screenImage = canvas.toDataURL('image/png');
      console.log(`Saving screen capture as ${screenFilename}`);
      
      // In a real implementation, you would send this to a server endpoint
      if (typeof fetch === 'function') {
        fetch('/api/save-capture', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageData: screenImage,
            filename: screenFilename,
            type: 'screen',
            folder: `session_${new Date().toISOString().replace(/[:\.]/g, '-')}`
          })
        })
        .then(response => response.json())
        .then(data => {
          console.log('Screen save result:', data);
        })
        .catch(err => {
          console.error('Error saving screen image:', err);
        });
      }
    }
    
    // Capture the webcam frame
    if (window.videoElement) {
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      tempCanvas.width = window.videoElement.videoWidth;
      tempCanvas.height = window.videoElement.videoHeight;
      ctx.drawImage(window.videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
      const webcamImage = tempCanvas.toDataURL('image/png');
      
      console.log(`Saving webcam capture as ${webcamFilename}`);
      // In a real implementation, you would send this to a server endpoint
      if (typeof fetch === 'function') {
        fetch('/api/save-capture', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageData: webcamImage,
            filename: webcamFilename,
            type: 'webcam',
            folder: `session_${new Date().toISOString().replace(/[:\.]/g, '-')}`
          })
        })
        .then(response => response.json())
        .then(data => {
          console.log('Webcam save result:', data);
        })
        .catch(err => {
          console.error('Error saving webcam image:', err);
        });
      }
    }
    
    // Increment the capture counter
    setCaptureCount(prevCount => prevCount + 1);
    
    // Update status
    setProcessStatus('Images captured and saved');
    
    // Show TopBar again after a brief delay
    setTimeout(() => {
      if (typeof onActionClick === 'function') {
        // Signal to parent to show the TopBar again
        onActionClick('toggleTopBar', true);
      }
    }, 1000);
    
    // Reset capturing state
    setIsCapturing(false);
  };

  // Handle Set Random button
  const handleSetRandom = () => {
    if (isCapturing) return;
    
    // Show canvas if not already visible
    setShowCanvas(true);
    
    // Get how many captures to do
    if (randomTimes <= 0) return;
    
    setRemainingCaptures(randomTimes);
    setProcessStatus(`Starting ${randomTimes} random captures...`);
    
    // Schedule a small delay to ensure canvas is visible and ready
    setTimeout(() => {
      // Start the sequence with first capture
      scheduleNextRandomCapture(randomTimes);
    }, 100);
  };

  // Schedule next random capture in sequence
  const scheduleNextRandomCapture = (remaining) => {
    if (remaining <= 0) {
      setProcessStatus('Random capture sequence completed');
      setRemainingCaptures(0);
      return;
    }
    
    setProcessStatus(`Capture ${randomTimes - remaining + 1} of ${randomTimes}`);
    setRemainingCaptures(remaining);
    
    // Generate random position and draw dot
    const { x, y } = getRandomPosition();
    drawDot(x, y);
    
    // Start countdown and then capture
    startCountdown(3, () => {
      captureImages(x, y);
      
      // Schedule next capture after delay
      setTimeout(() => {
        scheduleNextRandomCapture(remaining - 1);
      }, delaySeconds * 1000);
    });
  };

  // Random Dot Button - Draw a random dot and capture
  const handleRandomDot = () => {
    if (isCapturing) return;
    
    // Hide the TopBar before showing the dot
    if (typeof onActionClick === 'function') {
      onActionClick('toggleTopBar', false);
    }
    
    // Show canvas if not already visible
    setShowCanvas(true);
    
    // Schedule a small delay to ensure canvas is visible and ready
    setTimeout(() => {
      // Generate random position and draw dot
      const { x, y } = getRandomPosition();
      drawDot(x, y);
      
      // Start countdown and then capture
      startCountdown(3, () => {
        // Access the webcam
        triggerCameraAccess(true);
        
        // Wait briefly for camera to initialize
        setTimeout(() => {
          captureImages(x, y);
        }, 500);
      });
    }, 100);
  };

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
    
    // Calculate points
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

  // Set Calibrate Button - Start calibration sequence
  const handleSetCalibrate = () => {
    if (isCapturing) return;
    
    // Show canvas if not already visible
    setShowCanvas(true);
    
    // Schedule a small delay to ensure canvas is visible and ready
    setTimeout(() => {
      // Generate calibration points based on current canvas size
      const points = generateCalibrationPoints();
      setCalibrationPoints(points);
      setCurrentCalibrationIndex(0);
      
      // Start calibration sequence with first point
      setProcessStatus(`Calibration 1/${points.length}`);
      setRemainingCaptures(points.length);
      
      // Draw first calibration point
      drawDot(points[0].x, points[0].y);
      
      // Start countdown for first point
      startCountdown(3, () => {
        captureImages(points[0].x, points[0].y);
        setTimeout(() => moveToNextCalibrationPoint(), 1000);
      });
    }, 100);
  };

  // Move to next calibration point
  const moveToNextCalibrationPoint = () => {
    const nextIndex = currentCalibrationIndex + 1;
    
    // Check if we've completed all points
    if (nextIndex >= calibrationPoints.length) {
      setProcessStatus('Calibration completed');
      setRemainingCaptures(0);
      return;
    }
    
    // Update state
    setCurrentCalibrationIndex(nextIndex);
    setProcessStatus(`Calibration ${nextIndex + 1}/${calibrationPoints.length}`);
    setRemainingCaptures(calibrationPoints.length - nextIndex);
    
    // Draw next point
    const nextPoint = calibrationPoints[nextIndex];
    drawDot(nextPoint.x, nextPoint.y);
    
    // Start countdown for this point
    startCountdown(3, () => {
      captureImages(nextPoint.x, nextPoint.y);
      setTimeout(() => moveToNextCalibrationPoint(), 1000);
    });
  };

  // Clear All Button - Reset everything
  const handleClearAll = () => {
    clearCanvas();
    setProcessStatus('');
    setRemainingCaptures(0);
    setIsCapturing(false);
    setCountdownValue(null);
    setShowCanvas(false);
  };

  // Toggle Head Pose visualization
  const handleToggleHeadPose = () => {
    const newHeadPoseState = !showHeadPose;
    setShowHeadPose(newHeadPoseState);
    setProcessStatus(`Head pose visualization ${newHeadPoseState ? 'enabled' : 'disabled'}`);
    
    // Call the parent handler to update processor options
    if (onActionClick) {
      onActionClick('headPose');
    }
    
    // Update videoProcessor options directly if available
    if (typeof window !== 'undefined' && window.videoProcessor) {
      window.videoProcessor.updateOptions({
        showHeadPose: newHeadPoseState
      });
      console.log(`Updated backend head pose: ${newHeadPoseState}`);
    }
  };

  // Toggle Bounding Box visualization
  const handleToggleBoundingBox = () => {
    const newBoundingBoxState = !showBoundingBox;
    setShowBoundingBox(newBoundingBoxState);
    setProcessStatus(`Bounding box ${newBoundingBoxState ? 'shown' : 'hidden'}`);
    
    // Call the parent handler to update processor options
    if (onActionClick) {
      onActionClick('boundingBox');
    }
    
    // Update videoProcessor options directly if available
    if (typeof window !== 'undefined' && window.videoProcessor) {
      window.videoProcessor.updateOptions({
        showBoundingBox: newBoundingBoxState
      });
      console.log(`Updated backend bounding box: ${newBoundingBoxState}`);
    }
  };

  // Toggle Mask visualization
  const handleToggleMask = () => {
    const newMaskState = !showMask;
    setShowMask(newMaskState);
    setProcessStatus(`Mask ${newMaskState ? 'shown' : 'hidden'}`);
    
    // Call the parent handler to update processor options
    if (onActionClick) {
      onActionClick('mask');
    }
    
    // Update videoProcessor options directly if available
    if (typeof window !== 'undefined' && window.videoProcessor) {
      window.videoProcessor.updateOptions({
        showMask: newMaskState
      });
      console.log(`Updated backend mask: ${newMaskState}`);
    }
  };

  // Toggle Parameters display
  const handleToggleParameters = () => {
    const newParametersState = !showParameters;
    setShowParameters(newParametersState);
    setProcessStatus(`Parameters ${newParametersState ? 'shown' : 'hidden'}`);
    
    // Call the parent handler to update processor options
    if (onActionClick) {
      onActionClick('parameters');
    }
    
    // Update videoProcessor options directly if available
    if (typeof window !== 'undefined' && window.videoProcessor) {
      window.videoProcessor.updateOptions({
        showParameters: newParametersState
      });
      console.log(`Updated backend parameters: ${newParametersState}`);
    }
  };

  // Toggle camera preview
  const handleToggleCamera = () => {
    const newCameraState = !isCameraActive;
    setIsCameraActive(newCameraState);
    
    // Call the parent handler with 'preview' action
    if (onActionClick) {
      onActionClick('preview');
    } else {
      // Fallback to direct trigger if no action handler
      triggerCameraAccess();
    }
    
    // If turning on camera, ensure we apply current visualization settings
    if (newCameraState && typeof window !== 'undefined' && window.videoProcessor) {
      window.videoProcessor.updateOptions({
        showHeadPose,
        showBoundingBox,
        showMask,
        showParameters
      });
      console.log("Applied visualization settings to camera");
    }
  };

  // Button configurations with both full and abbreviated text
  const buttons = [
    { 
      text: "Set Random", 
      abbreviatedText: "SRandom", 
      onClick: handleSetRandom,
      disabled: isCapturing
    },
    { 
      text: "Random Dot", 
      abbreviatedText: "Random", 
      onClick: handleRandomDot,
      disabled: isCapturing 
    },
    { 
      text: "Set Calibrate", 
      abbreviatedText: "Calibrate", 
      onClick: handleSetCalibrate,
      disabled: isCapturing 
    },
    { 
      text: "Clear All", 
      abbreviatedText: "Clear", 
      onClick: handleClearAll
    },
    { divider: true },
    { 
      text: "Draw Head pose", 
      abbreviatedText: "Head pose", 
      onClick: handleToggleHeadPose,
      active: showHeadPose
    },
    { 
      text: "Show Bounding Box", 
      abbreviatedText: "☐ Box", 
      onClick: handleToggleBoundingBox,
      active: showBoundingBox
    },
    { 
      text: isCameraActive ? "Stop Camera" : "Show Preview", 
      abbreviatedText: isCameraActive ? "Stop" : "Preview", 
      onClick: handleToggleCamera,
      active: isCameraActive
    },
    { 
      text: "😷 Show Mask", 
      abbreviatedText: "😷 Mask", 
      onClick: handleToggleMask,
      active: showMask
    },
    { 
      text: "Parameters", 
      abbreviatedText: "Values", 
      onClick: handleToggleParameters,
      active: showParameters
    }
  ];

  // Mobile layout - 2x5 grid
  return (
    <div>
      {isCompactMode ? (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {buttons.filter(b => !b.divider).map((button, index) => (
            <ActionButton 
              key={index}
              text={button.text}
              abbreviatedText={button.abbreviatedText}
              onClick={button.onClick}
              disabled={button.disabled}
              active={button.active}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <ActionButton 
              text="Set Random"
              abbreviatedText="SRandom" 
              onClick={handleSetRandom}
              disabled={isCapturing}
            />
            <ActionButton 
              text="Random Dot"
              abbreviatedText="Random" 
              onClick={handleRandomDot}
              disabled={isCapturing}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton 
              text="Set Calibrate"
              abbreviatedText="Calibrate" 
              onClick={handleSetCalibrate}
              disabled={isCapturing}
            />
            <ActionButton 
              text="Clear All"
              abbreviatedText="Clear" 
              onClick={handleClearAll}
            />
          </div>
          
          <hr className="my-3 border-gray-200" />
          
          <div className="grid grid-cols-2 gap-2">
            <ActionButton 
              text="Draw Head pose"
              abbreviatedText="Head pose" 
              onClick={handleToggleHeadPose}
              active={showHeadPose}
            />
            <ActionButton 
              text="Show Bounding Box"
              abbreviatedText="☐ Box" 
              onClick={handleToggleBoundingBox}
              active={showBoundingBox}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton 
              text={isCameraActive ? "Stop Camera" : "Show Preview"}
              abbreviatedText={isCameraActive ? "Stop" : "Preview"}
              onClick={handleToggleCamera}
              active={isCameraActive}
            />
            <ActionButton 
              text="😷 Show Mask"
              abbreviatedText="😷 Mask" 
              onClick={handleToggleMask}
              active={showMask}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton 
              text="Parameters"
              abbreviatedText="Values" 
              onClick={handleToggleParameters}
              active={showParameters}
            />
            <div></div> {/* Empty space for alignment */}
          </div>
        </div>
      )}
      
      {/* Status display for calibration and random sequence */}
      {(processStatus || remainingCaptures > 0 || countdownValue) && (
        <div className="status-display mt-4 p-2 bg-blue-50 rounded-md">
          {processStatus && (
            <div className="text-sm font-medium text-blue-800">{processStatus}</div>
          )}
          {remainingCaptures > 0 && (
            <div className="text-sm font-medium text-yellow-600">Remaining: {remainingCaptures}</div>
          )}
          {countdownValue && (
            <div className="text-2xl font-bold text-red-600">{countdownValue}</div>
          )}
        </div>
      )}
      
      {/* Canvas for drawing dots */}
      {showCanvas && (
        <div className="canvas-container mt-4" style={{ position: 'relative', width: '100%', height: '40vh', minHeight: '300px', border: '1px solid #e0e0e0', backgroundColor: 'white', borderRadius: '4px', overflow: 'hidden' }}>
          <canvas 
            ref={canvasRef}
            className="tracking-canvas"
            style={{ width: '100%', height: '100%' }}
          />
          
          {/* Overlay for countdown on dot */}
          {countdownValue && currentDot && (
            <div 
              className="dot-countdown"
              style={{
                position: 'absolute',
                left: `${currentDot.x - 15}px`,
                top: `${currentDot.y - 40}px`,
                color: 'red',
                fontSize: '28px',
                fontWeight: 'bold'
              }}
            >
              {countdownValue}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Create a client-only version of ActionButtonGroup
const ActionButtonGroup = dynamic(() => Promise.resolve(ActionButtonGroupInner), { ssr: false });

export { ActionButton, ActionButtonGroup };