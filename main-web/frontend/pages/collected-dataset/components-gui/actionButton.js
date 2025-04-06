// Modified ActionButton.js - Fixing canvas reference issues
import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { generateCalibrationPoints } from './Action/CalibratePoints';
import { 
  captureImagesAtPoint, 
  showCapturePreview, 
  drawRedDot, 
  getRandomPosition,
  createCountdownElement,
  runCountdown
} from './Action/countSave';

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
  const [calibrationHandler, setCalibrationHandler] = useState(null);
  const [captureCount, setCaptureCount] = useState(1);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Toggle states
  const [showHeadPose, setShowHeadPose] = useState(false);
  const [showBoundingBox, setShowBoundingBox] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [showParameters, setShowParameters] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);


  const [showPermissionPopup, setShowPermissionPopup] = useState(false);

    // Make initializeCanvas available globally
  useEffect(() => {
    // Skip during SSR
    if (typeof window === 'undefined') return;
    
    // Make initializeCanvas available to other components through the window object
    window.initializeCanvas = initializeCanvas;
    
    return () => {
      // Clean up
      delete window.initializeCanvas;
    };
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Function to get control values from TopBar
    const updateControlValues = () => {
      // Get the time input element
      const timeInput = document.querySelector('.control-input-field[data-control="time"]');
      if (timeInput) {
        const timeValue = parseInt(timeInput.value, 10);
        if (!isNaN(timeValue) && timeValue > 0) {
          setRandomTimes(timeValue);
        }
      }
      
      // Get the delay input element
      const delayInput = document.querySelector('.control-input-field[data-control="delay"]');
      if (delayInput) {
        const delayValue = parseInt(delayInput.value, 10);
        if (!isNaN(delayValue) && delayValue > 0) {
          setDelaySeconds(delayValue);
        }
      }
    };
    
    // Add event listeners to the control inputs
    const timeInput = document.querySelector('.control-input-field[data-control="time"]');
    const delayInput = document.querySelector('.control-input-field[data-control="delay"]');
    
    if (timeInput) {
      timeInput.addEventListener('change', updateControlValues);
    }
    
    if (delayInput) {
      delayInput.addEventListener('change', updateControlValues);
    }
    
    // Initial update
    updateControlValues();
    
    // Cleanup event listeners
    return () => {
      if (timeInput) {
        timeInput.removeEventListener('change', updateControlValues);
      }
      
      if (delayInput) {
        delayInput.removeEventListener('change', updateControlValues);
      }
    };
  }, []);

  const initializeCanvas = (canvas, parent) => {
    if (!canvas || !parent) {
      console.warn('[initializeCanvas] Canvas or parent is null', { canvas, parent });
      return false;
    }
    
    try {
      // Set canvas dimensions to match parent
      canvas.width = parent.clientWidth || 800;
      canvas.height = parent.clientHeight || 600;
      
      // Clear canvas and set white background
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      console.log(`Canvas initialized with dimensions: ${canvas.width}x${canvas.height}`);
      return true;
    } catch (error) {
      console.error('[initializeCanvas] Error initializing canvas:', error);
      return false;
    }
  };

  // Helper function to get the main canvas - improved to be more reliable
  const getMainCanvas = () => {
    // Try multiple methods to find the canvas
    
    // Method 1: Check if we have a direct reference
    if (canvasRef.current) {
      console.log("Using direct canvasRef.current reference");
      return canvasRef.current;
    }
    
    // Method 2: Try to get global reference
    if (typeof window !== 'undefined' && window.whiteScreenCanvas) {
      console.log("Using global whiteScreenCanvas reference");
      canvasRef.current = window.whiteScreenCanvas; // Update our ref
      return window.whiteScreenCanvas;
    }
    
    // Method 3: Try to find via DOM
    if (typeof document !== 'undefined') {
      const canvasElement = document.querySelector('.tracking-canvas');
      if (canvasElement) {
        console.log("Found canvas via DOM selector");
        canvasRef.current = canvasElement; // Update our ref
        if (typeof window !== 'undefined') {
          window.whiteScreenCanvas = canvasElement; // Update global ref too
        }
        return canvasElement;
      }
    }
    
    console.warn("No canvas found via any method");
    return null;
  };

  const handlePermissionAccepted = () => {
    setShowPermissionPopup(false);
    if (triggerCameraAccess) {
      triggerCameraAccess(true); // Force enable camera access
    }
  };

  // Handler to cancel permission popup
  const handlePermissionDenied = () => {
    setShowPermissionPopup(false);
  };



  // Draw a dot on the canvas
  const drawDot = (x, y, color = 'red', radius = 5) => {
    const canvas = getMainCanvas();
    if (!canvas) {
      console.error("No canvas found for drawing dot");
      setProcessStatus("Error: Canvas not available");
      return null;
    }
    
    const parent = canvas.parentElement;
    if (parent) {
      initializeCanvas(canvas, parent);
    }
    
    const ctx = canvas.getContext('2d');
    
    // Clear previous dot if any
    clearCanvas();
    
    // Use drawRedDot from countSave.js
    drawRedDot(ctx, x, y, radius, false);
    
    // Save current dot position
    setCurrentDot({ x, y });
    
    return { x, y };
  };

  // Clear the canvas
  const clearCanvas = () => {
    const canvas = getMainCanvas();
    if (!canvas) {
      console.warn("No canvas found for clearing");
      return;
    }
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setCurrentDot(null);
  };

  // Generate a random position using getRandomPosition from countSave.js
  const getRandomDotPosition = () => {
    const canvas = getMainCanvas();
    if (!canvas) {
      console.warn("No canvas found for generating random position");
      return { x: 100, y: 100 }; // Default fallback
    }
    
    // Use getRandomPosition from countSave.js
    return getRandomPosition(canvas, 20); // 20px padding from edges
  };

  // Countdown timer function
  const startCountdown = (count, onComplete) => {
    setIsCapturing(true);
    setCountdownValue(count);
    
    // Use the canvas and current dot to run countdown
    const canvas = getMainCanvas();
    if (!canvas || !currentDot) {
      console.warn("Canvas or dot position not available for countdown");
      setIsCapturing(false);
      return;
    }
    
    // Use runCountdown from countSave.js
    runCountdown(
      currentDot, 
      canvas, 
      (status) => {
        // Update UI based on countdown status
        if (status.countdownValue) {
          setCountdownValue(status.countdownValue);
        }
        if (status.processStatus) {
          setProcessStatus(status.processStatus);
        }
        setIsCapturing(status.isCapturing !== false);
      }, 
      onComplete
    );
  };

  // Function to capture images at the current dot position
  const captureImagesFunc = (x, y) => {
    const canvas = getMainCanvas();
    if (!canvas) {
      console.error("No canvas found for image capture");
      setProcessStatus("Error: Canvas not available");
      setIsCapturing(false);
      return;
    }

    // Create a working canvasRef object to pass to captureImagesAtPoint
    const tempCanvasRef = { current: canvas };
    
    // Use captureImagesAtPoint from countSave.js
    captureImagesAtPoint({
      point: { x, y },
      captureCount: captureCount,
      canvasRef: tempCanvasRef,
      setCaptureCount: setCaptureCount,
      showCapturePreview: (screenImage, webcamImage, point) => {
        // Use imported showCapturePreview from countSave.js
        if (!screenImage) {
          console.warn("No screen image found. Using canvas as fallback.");
          // Create a fallback image from canvas
          if (canvas) {
            const fallbackImage = canvas.toDataURL('image/png');
            showCapturePreview(fallbackImage, webcamImage, point);
          } else {
            throw new Error("Canvas not available for fallback image");
          }
        } else {
          showCapturePreview(screenImage, webcamImage, point);
        }
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
      }
    }).then(() => {
      // Increment the capture counter
      setCaptureCount(prevCount => prevCount + 1);
    }).catch(err => {
      console.error('Error during image capture:', err);
      setIsCapturing(false);
      setProcessStatus(`Error: ${err.message}`);
    });
  };

  // Handle Set Random button
  const handleSetRandom = () => {
    if (isCapturing) return;
    
    // Read values from state (which are synced with the TopBar inputs)
    const times = randomTimes;
    const delay = delaySeconds;
    
    // Validate inputs
    if (times <= 0) {
      setProcessStatus('Error: Number of times must be greater than 0');
      return;
    }
    
    if (delay <= 0) {
      setProcessStatus('Error: Delay must be greater than 0 seconds');
      return;
    }
    
    // Show canvas if not already visible
    setShowCanvas(true);
    
    // Update status
    setRemainingCaptures(times);
    setProcessStatus(`Starting ${times} random captures with ${delay}s delay...`);
    
    // Schedule a small delay to ensure canvas is visible and ready
    setTimeout(() => {
      // Start the sequence with first capture
      scheduleNextRandomCapture(times, delay);
    }, 100);
  };

  // Schedule next random capture in sequence
  const scheduleNextRandomCapture = (remaining, delay) => {
    if (remaining <= 0) {
      setProcessStatus('Random capture sequence completed');
      setRemainingCaptures(0);
      return;
    }
    
    setProcessStatus(`Capture ${randomTimes - remaining + 1} of ${randomTimes}`);
    setRemainingCaptures(remaining);
    
    // Generate random position and draw dot
    const position = getRandomPosition();
    const drawnPosition = drawDot(position.x, position.y);
    
    if (!drawnPosition) {
      console.error("Failed to draw dot");
      setProcessStatus("Error: Failed to draw dot");
      setIsCapturing(false);
      return;
    }
    
    // Start countdown and then capture
    startCountdown(3, () => {
      captureImagesFunc(position.x, position.y);
      
      // Schedule next capture after specified delay
      setTimeout(() => {
        scheduleNextRandomCapture(remaining - 1, delay);
      }, delay * 1000);
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
      const position = getRandomDotPosition();
      if (typeof onActionClick === 'function') {
        onActionClick('toggleTopBar', false);
      }
      
      // Get a reference to main canvas and initialize it
      const canvas = getMainCanvas();
      if (!canvas) {
        console.error("Main canvas not found when handling random dot click");
        setProcessStatus("Error: Canvas not available");
        if (typeof onActionClick === 'function') {
          onActionClick('toggleTopBar', true); // Show TopBar again
        }
        return;
      }
      
      const parent = canvas.parentElement;
      if (parent) {
        initializeCanvas(canvas, parent);
      }
      
      // Draw dot
      const drawnPosition = drawDot(position.x, position.y);
      
      if (!drawnPosition) {
        console.error("Failed to draw dot");
        setProcessStatus("Error: Failed to draw dot");
        if (typeof onActionClick === 'function') {
          onActionClick('toggleTopBar', true); // Show TopBar again
        }
        return;
      }
      
      // Start countdown and then capture
      startCountdown(3, () => {
        // Access the webcam
        // triggerCameraAccess(true);
        
        // Wait briefly for camera to initialize
        setTimeout(() => {
          captureImagesFunc(position.x, position.y);
        }, 500);
      });
    }, 100);
  };

  // Load calibration setup
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setupCalibration = async () => {
      try {
        const { default: CalibrateHandler } = await import('./Action/CalibrateHandler');
    
        const canvas = getMainCanvas();
        if (!canvas) {
          console.warn("Canvas not available during setupCalibration");
          return;
        }
    
        console.log('Canvas size:', canvas.width, canvas.height);
        const points = generateCalibrationPoints(canvas.width, canvas.height);
        console.log('Generated calibration points:', points);
        setCalibrationPoints(points);
    
        const calibrateHandler = new CalibrateHandler({
          canvasRef: { current: canvas },
          calibrationPoints: points,
          toggleTopBar: (show) => onActionClick?.('toggleTopBar', show),
          setOutputText: (status) => {
            setProcessStatus(status);
          },
          captureCounter: captureCount,
          setCaptureCounter: (newCounter) => {
            if (typeof newCounter === 'function') {
              setCaptureCount(prev => newCounter(prev));
            } else {
              setCaptureCount(newCounter);
            }
          },
          captureFolder: 'eye_tracking_captures',
          onComplete: () => {
            setIsCapturing(false);
            setProcessStatus('Calibration completed');
          }
        });
    
        setCalibrationHandler({
          handleAction: async () => {
            setIsCapturing(true);
            setProcessStatus('Starting calibration...');
            await calibrateHandler.startCalibration();
            setIsCapturing(false);
          }
        });
    
      } catch (err) {
        console.error('Error initializing calibration:', err);
      }
    };

    setupCalibration();
  }, [captureCount, onActionClick]);

  // Wait for canvas to be ready
  const waitForCanvasReady = async (checkVisible, maxTries = 15, interval = 100) => {
    for (let i = 0; i < maxTries; i++) {
      const canvas = getMainCanvas();
      if (canvas && canvas.width > 0 && canvas.height > 0 && checkVisible()) {
        return canvas;
      }
      await new Promise(res => setTimeout(res, interval));
    }
    throw new Error("Canvas is not ready after multiple attempts");
  };

  // Calibration handler
  // Fixed handleSetCalibrate function for actionButton.js
  const handleSetCalibrate = async () => {
    if (isCapturing) return;
    
    try {
      // Hide TopBar
      if (typeof onActionClick === 'function') {
        onActionClick('toggleTopBar', false);
      } else if (typeof window !== 'undefined' && window.toggleTopBar) {
        window.toggleTopBar(false);
      }

      setIsCapturing(true);
      setProcessStatus("Starting calibration sequence...");
      
      // Show canvas if not already visible
      setShowCanvas(true);
      
      // Wait for canvas to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get canvas reference
      const canvas = getMainCanvas();
      if (!canvas) {
        throw new Error("Canvas not available for calibration");
      }
      
      // Initialize canvas dimensions
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth || 800;
        canvas.height = parent.clientHeight || 600;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        console.log(`Canvas initialized: ${canvas.width}x${canvas.height}`);
      }
      
      // Import required functions from CalibratePoints.js
      const { generateCalibrationPoints } = await import('./Action/CalibratePoints');
      const points = generateCalibrationPoints(canvas.width, canvas.height);
      
      if (!points || points.length === 0) {
        throw new Error("Failed to generate calibration points");
      }
      
      // Import functions from countSave.js
      const { 
        drawRedDot, 
        createCountdownElement,
        runCountdown,
        showCapturePreview
      } = await import('./Action/countSave');
      
      // Import captureImagesAtPoint from savefile.js
      const { captureImagesAtPoint } = await import('./Helper/savefile');
      
      // Start the calibration process
      // First, create a status indicator
      const statusIndicator = document.createElement('div');
      statusIndicator.className = 'calibrate-status-indicator';
      statusIndicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background-color: rgba(0, 102, 204, 0.9);
        color: white;
        font-size: 14px;
        font-weight: bold;
        padding: 8px 12px;
        border-radius: 6px;
        z-index: 9999;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      `;
      statusIndicator.textContent = 'Calibration: Initializing...';
      document.body.appendChild(statusIndicator);
      
      // Access webcam before starting calibration
      triggerCameraAccess(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Process each calibration point
      let successCount = 0;
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        
        statusIndicator.textContent = `Calibration: Point ${i + 1}/${points.length}`;
        setProcessStatus(`Calibration point ${i + 1}/${points.length}`);
        
        // Clear the canvas for each new point
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the dot
        drawRedDot(ctx, point.x, point.y);
        
        // Wait briefly to ensure the dot is visible
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Start countdown and capture - using same pattern as Random Dot
        try {
          // Run the countdown similar to how Random Dot does
          await new Promise(resolve => {
            runCountdown(
              point,
              canvas,
              (status) => {
                // Update UI based on status
                if (status.processStatus) {
                  setProcessStatus(status.processStatus);
                }
                if (status.countdownValue) {
                  // Update any countdown display if needed
                }
              },
              resolve // Resolve the Promise when countdown completes
            );
          });
          
          // Now capture the image at this point
          const captureResult = await captureImagesAtPoint({
            point: point,
            captureCount: captureCount,
            canvasRef: { current: canvas },
            setCaptureCount: setCaptureCount,
            showCapturePreview: showCapturePreview
          });
          
          // Increment counter
          setCaptureCount(prev => prev + 1);
          
          if (captureResult && (captureResult.screenImage || captureResult.success)) {
            successCount++;
          }
          
          // Small wait between points
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error processing calibration point ${i + 1}:`, error);
        }
      }
      
      // Calibration complete
      statusIndicator.textContent = `Calibration complete: ${successCount}/${points.length} points`;
      setProcessStatus(`Calibration completed: ${successCount}/${points.length} points captured`);
      
      // Remove the status indicator after a delay
      setTimeout(() => {
        if (statusIndicator.parentNode) {
          statusIndicator.parentNode.removeChild(statusIndicator);
        }
      }, 3000);
      
    } catch (error) {
      console.error("Calibration error:", error);
      setProcessStatus(`Calibration error: ${error.message}`);
    } finally {
      setIsCapturing(false);
      
      // Show TopBar again
      if (typeof onActionClick === 'function') {
        onActionClick('toggleTopBar', true);
      } else if (typeof window !== 'undefined' && window.toggleTopBar) {
        window.toggleTopBar(true);
      }
    }
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
      setShowPermissionPopup(true);
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
      onClick: () => {
        // If camera permission is needed but not granted, show popup
        if (!isCameraActive && !triggerCameraAccess(true)) {
          setShowPermissionPopup(true);
        } else {
          handleToggleCamera();
        }
      },
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
        <div 
          className="canvas-container mt-4" 
          style={{ 
            position: 'relative', 
            width: '100%', 
            height: '40vh', 
            minHeight: '300px', 
            border: '1px solid #e0e0e0', 
            backgroundColor: 'white', 
            borderRadius: '4px', 
            overflow: 'hidden' 
          }}
        >
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
      
      {/* Camera Permission Popup */}
      {showPermissionPopup && (
        <div 
          className="camera-permission-popup" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000
          }}
        >
          <div 
            className="camera-permission-dialog" 
            style={{
              width: '400px',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
            }}
          >
            <h3 
              className="camera-permission-title" 
              style={{
                margin: '0 0 15px',
                fontSize: '18px',
                fontWeight: 'bold'
              }}
            >
              Camera Access Required
            </h3>
            <p 
              className="camera-permission-message" 
              style={{
                margin: '0 0 20px',
                fontSize: '14px',
                lineHeight: '1.4'
              }}
            >
              This application needs access to your camera to function properly. When prompted by your browser, please click "Allow" to grant camera access.
            </p>
            <div 
              className="camera-permission-buttons" 
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
              }}
            >
              <button 
                onClick={handlePermissionDenied}
                className="camera-btn"
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f0f0f0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handlePermissionAccepted}
                className="camera-btn"
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#0066cc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Create a client-only version of ActionButtonGroup
const ActionButtonGroup = dynamic(() => Promise.resolve(ActionButtonGroupInner), { ssr: false });

export { ActionButton, ActionButtonGroup };