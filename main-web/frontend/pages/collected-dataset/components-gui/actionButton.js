// Modified ActionButton.js - Fixing canvas reference issues
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import { generateCalibrationPoints } from './Action/CalibratePoints';
import { 
  showCapturePreview, 
  drawRedDot, 
  getRandomPosition,
  createCountdownElement,
  runCountdown
} from './Action/countSave';
import { captureImagesAtPoint } from './Helper/savefile';

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
const ActionButtonGroupInner = forwardRef(({ triggerCameraAccess, isCompactMode, onActionClick }, ref) => {
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
  useImperativeHandle(ref, () => ({
    handleRandomDot,  
    handleSetRandom,
    handleSetCalibrate,
    handleClearAll
  }), []);
  
    // Make initializeCanvas available globally
  // useEffect(() => {
  //   // Skip during SSR
  //   if (typeof window === 'undefined') return;
    
  //   // Make initializeCanvas available to other components through the window object
  //   window.initializeCanvas = initializeCanvas;
    
  //   return () => {
  //     // Clean up
  //     delete window.initializeCanvas;
  //   };
  // }, []);

  useEffect(() => {
    // Make functions globally accessible as a fallback
    if (typeof window !== 'undefined') {
      window.actionButtonFunctions = {
        handleRandomDot,
        handleSetRandom,
        handleSetCalibrate,
        handleClearAll
      };
      console.log('Action button functions exposed to window.actionButtonFunctions');
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.actionButtonFunctions;
      }
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
  const startCountdown = (count, onComplete, directPosition = null) => {
    setIsCapturing(true);
    setCountdownValue(count);
    
    // Use the canvas and current dot to run countdown
    const canvas = getMainCanvas();
    
    // Use either currentDot from state or directPosition parameter
    const dotPosition = directPosition || currentDot;
    
    if (!canvas || !dotPosition) {
      console.error("Canvas or dot position not available for countdown", {
        canvas: !!canvas,
        dotPosition,
        currentDot
      });
      setIsCapturing(false);
      if (typeof onActionClick === 'function') {
        onActionClick('toggleTopBar', true);
      }
      setProcessStatus("Error: Could not start countdown");
      return;
    }
    
    // Use runCountdown from countSave.js
    runCountdown(
      dotPosition, 
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

  // Add this function to actionButton.js

  /**
   * Consolidated function that handles the entire dot process: drawing, countdown, capture, and preview
   * @param {Object} options - Configuration options
   * @param {Object} options.position - {x, y} coordinates where to draw the dot
   * @param {Function} options.onStatusUpdate - Callback for status updates
   * @param {Function} options.toggleTopBar - Function to toggle top bar visibility
   * @param {Function} options.triggerCameraAccess - Function to ensure camera is available
   * @param {Function} options.setIsCapturing - Function to update capturing state
   * @param {Number} options.captureCount - Current capture counter
   * @param {Function} options.setCaptureCount - Function to update the capture counter
   * @param {Boolean} options.useRandomPosition - Whether to generate a random position
   * @returns {Promise<Object>} - Result object with capture data
   */
  const handleDotProcess = async (options) => {
    const {
      position,
      onStatusUpdate,
      toggleTopBar,
      triggerCameraAccess,
      setIsCapturing,
      captureCount,
      setCaptureCount,
      useRandomPosition = false,
      postCountdownDelay = 500 // Default value if not provided
    } = options;
    
    try {
      // Hide the TopBar before showing the dot
      if (typeof toggleTopBar === 'function') {
        toggleTopBar(false);
      } else if (typeof window !== 'undefined' && window.toggleTopBar) {
        window.toggleTopBar(false);
      }
      
      // Set capturing state
      setIsCapturing(true);
      
      // Update status
      onStatusUpdate?.({
        processStatus: useRandomPosition ? 'Generating random dot...' : 'Starting dot process...',
        isCapturing: true
      });
      
      // Wait for UI updates to take effect
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get canvas reference
      const canvas = getMainCanvas();
      if (!canvas) {
        throw new Error("Canvas not available for dot process");
      }
      
      // Ensure canvas dimensions are proper
      if (canvas.width <= 0 || canvas.height <= 0) {
        const parent = canvas.parentElement;
        if (parent) {
          // canvas.width = parent.clientWidth || 800;
          // canvas.height = parent.clientHeight || 600;
          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;
        } 
        // else {
        //   canvas.width = 800;
        //   canvas.height = 600;
        // }
      }
      
      // Clear canvas and prepare for drawing
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Get position for the dot - either use provided position or generate random one
      const dotPosition = useRandomPosition 
        ? getRandomPosition(canvas, 20) 
        : position;
      
      if (!dotPosition || typeof dotPosition.x !== 'number' || typeof dotPosition.y !== 'number') {
        throw new Error("Invalid dot position");
      }
      
      // Draw the dot
      const dotRadius = 12;
      drawRedDot(ctx, dotPosition.x, dotPosition.y, dotRadius, true);
      
      // Create a redraw interval to ensure dot stays visible
      let keepDotVisibleInterval = setInterval(() => {
        drawRedDot(ctx, dotPosition.x, dotPosition.y, dotRadius, false);
      }, 100);
      
      // Set a flag for tracking if we've shown the previews
      let previewsShown = false;
      
      // Run countdown with dot position
      await new Promise((resolve, reject) => {
        try {
          runCountdown(
            dotPosition,
            canvas,
            (status) => {
              // Update UI based on status
              if (status.processStatus) {
                onStatusUpdate?.(status);
              }
            },
            resolve // This will be called when countdown completes
          );
        } catch (error) {
          clearInterval(keepDotVisibleInterval);
          reject(error);
        }
      });
      
      // After countdown completes, update the status
      onStatusUpdate?.({
        processStatus: 'Countdown complete, preparing capture...',
        isCapturing: true
      });
      
      // Ensure the dot is still visible after countdown
      drawRedDot(ctx, dotPosition.x, dotPosition.y, dotRadius, false);
      
      // Add additional delay after countdown to keep dot visible longer
      await new Promise(resolve => setTimeout(resolve, postCountdownDelay));
      
      // Access webcam before capture
      if (triggerCameraAccess) {
        triggerCameraAccess(true);
      }
      
      // Ensure the dot is still visible after additional delay
      drawRedDot(ctx, dotPosition.x, dotPosition.y, dotRadius, false);
      
      // Wait briefly for camera to initialize, but continue showing the dot
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Use a function wrapper to handle original preview reference
      const originalShowCapturePreview = window.showCapturePreview || showCapturePreview;
      
      // Create a modified preview function that knows when previews are shown
      const previewTracker = (screenImage, webcamImage, point) => {
        // Mark previews as shown
        previewsShown = true;
        
        // Stop redrawing the dot once previews are shown
        clearInterval(keepDotVisibleInterval);
        
        // Call the original preview function
        originalShowCapturePreview(screenImage, webcamImage, point);
        
        // Update status
        onStatusUpdate?.({
          processStatus: 'Images captured and saved',
          isCapturing: false
        });
      };
      
      // Override the preview function temporarily
      if (typeof window !== 'undefined') {
        window.showCapturePreview = previewTracker;
      }
      
      // Capture images at the dot position
      const captureResult = await captureImagesAtPoint({
        point: dotPosition,
        captureCount: captureCount,
        canvasRef: { current: canvas },
        setCaptureCount: setCaptureCount,
        showCapturePreview: previewTracker
      });
      
      // Increment capture counter
      setCaptureCount(prev => prev + 1);
      
      // Set a safety timeout to clear the interval if previews weren't shown
      setTimeout(() => {
        if (!previewsShown) {
          clearInterval(keepDotVisibleInterval);
          
          // Restore original preview function
          if (typeof window !== 'undefined') {
            window.showCapturePreview = originalShowCapturePreview;
          }
        }
      }, 3000);
      
      // Schedule TopBar to return
      setTimeout(() => {
        if (typeof toggleTopBar === 'function') {
          toggleTopBar(true);
        } else if (typeof window !== 'undefined' && window.toggleTopBar) {
          window.toggleTopBar(true);
        }
        setIsCapturing(false);
      }, 2500);
      
      return {
        success: true,
        position: dotPosition,
        captureResult
      };
      
    } catch (error) {
      console.error("Error in handleDotProcess:", error);
      
      onStatusUpdate?.({
        processStatus: `Error: ${error.message}`,
        isCapturing: false
      });
      
      // Clean up
      setIsCapturing(false);
      
      // Restore any overridden functions
      if (typeof window !== 'undefined' && window.originalShowCapturePreview) {
        window.showCapturePreview = window.originalShowCapturePreview;
      }
      
      // Make sure TopBar returns if there's an error
      setTimeout(() => {
        if (typeof toggleTopBar === 'function') {
          toggleTopBar(true);
        } else if (typeof window !== 'undefined' && window.toggleTopBar) {
          window.toggleTopBar(true);
        }
      }, 1000);
      
      return {
        success: false,
        error: error.message
      };
    }
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
  // This partial file shows only the fixed handleSetRandom function

  // Refactored handleSetRandom function using handleDotProcess
  // Improved handleSetRandom function using handleDotProcess
  const handleSetRandom = async () => {
    if (isCapturing) return;
    
    try {
      // Read values from TopBar inputs
      const timeInput = document.querySelector('.control-input-field');
      const delayInput = document.querySelectorAll('.control-input-field')[1];
      
      // Default values if inputs can't be found
      let times = randomTimes || 1; // Use state as backup
      let delay = delaySeconds || 3; // Use state as backup
      
      // Parse input values if available
      if (timeInput) {
        const parsedTime = parseInt(timeInput.value, 10);
        if (!isNaN(parsedTime) && parsedTime > 0) {
          times = parsedTime;
          // Also update state
          setRandomTimes(times);
        }
      }
      
      if (delayInput) {
        const parsedDelay = parseInt(delayInput.value, 10);
        if (!isNaN(parsedDelay) && parsedDelay > 0) {
          delay = parsedDelay;
          // Also update state
          setDelaySeconds(delay);
        }
      }
      
      // Validate inputs
      if (times <= 0) {
        setProcessStatus('Error: Number of times must be greater than 0');
        return;
      }
      
      if (delay <= 0) {
        setProcessStatus('Error: Delay must be greater than 0 seconds');
        return;
      }
      
      // Hide TopBar initially
      if (typeof onActionClick === 'function') {
        onActionClick('toggleTopBar', false);
      } else if (typeof window !== 'undefined' && window.toggleTopBar) {
        window.toggleTopBar(false);
      }
      
      // Show canvas if not already visible
      setShowCanvas(true);
      setIsCapturing(true);
      
      // Update status
      setRemainingCaptures(times);
      setProcessStatus(`Starting ${times} random captures with ${delay}s delay...`);
      
      // Process all random captures sequentially
      let remainingCaptures = times;
      let currentIndex = 1;
      let successCount = 0;
      
      while (remainingCaptures > 0) {
        setProcessStatus(`Capture ${currentIndex} of ${times}`);
        setRemainingCaptures(remainingCaptures);
        
        // Use the consolidated handleDotProcess function for each random dot
        const result = await handleDotProcess({
          useRandomPosition: true,
          onStatusUpdate: (status) => {
            if (status.processStatus) {
              setProcessStatus(`Capture ${currentIndex}/${times}: ${status.processStatus}`);
            }
            if (status.isCapturing !== undefined) {
              setIsCapturing(status.isCapturing);
            }
          },
          toggleTopBar: (show) => {
            // Don't show the TopBar between captures, only at the end
            if (show && remainingCaptures > 1) return;
            
            if (typeof onActionClick === 'function') {
              onActionClick('toggleTopBar', show);
            } else if (typeof window !== 'undefined' && window.toggleTopBar) {
              window.toggleTopBar(show);
            }
          },
          triggerCameraAccess,
          setIsCapturing,
          captureCount,
          setCaptureCount: setCaptureCount,
          postCountdownDelay: 500
        });
        
        // Check for success
        if (!result.success) {
          setProcessStatus(`Error during capture ${currentIndex}: ${result.error}`);
          break;
        } else if (result.captureResult && 
                (result.captureResult.screenImage || result.captureResult.success)) {
          successCount++;
        }
        
        remainingCaptures--;
        currentIndex++;
        
        // Wait for the specified delay before next capture (if any remain)
        if (remainingCaptures > 0) {
          setProcessStatus(`Waiting ${delay}s before next capture...`);
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
      }
      
      // Signal completion
      setProcessStatus(`Random capture sequence completed: ${successCount}/${times} captures successful`);
      setRemainingCaptures(0);
      
      // Make sure TopBar is shown at the end
      if (typeof onActionClick === 'function') {
        onActionClick('toggleTopBar', true);
      } else if (typeof window !== 'undefined' && window.toggleTopBar) {
        window.toggleTopBar(true);
      }
      
    } catch (error) {
      console.error("Random sequence error:", error);
      setProcessStatus(`Random sequence failed: ${error.message}`);
      
      // Reset capturing state
      setIsCapturing(false);
      
      // Show TopBar again on error
      if (typeof onActionClick === 'function') {
        onActionClick('toggleTopBar', true);
      } else if (typeof window !== 'undefined' && window.toggleTopBar) {
        window.toggleTopBar(true);
      }
    }
  };

  // Refactored handleSetCalibrate function using handleDotProcess
  // Improved handleSetCalibrate function for actionButton.js
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
      setShowCanvas(true);
      setProcessStatus("Starting calibration sequence...");
      
      // Wait for UI updates to take effect
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Get canvas reference - using the fullscreen approach
      const canvas = getMainCanvas();
      if (!canvas) {
        throw new Error("Canvas not available for calibration");
      }
      
      // ---------- CRITICAL FIX: PROPER CANVAS SIZING ----------
      // Get window dimensions for fullscreen calibration
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      // Force the canvas to be fullscreen
      canvas.width = windowWidth;
      canvas.height = windowHeight;
      
      // Ensure canvas appears above other elements
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.zIndex = '1000';
      
      // Clear to white background
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      console.log(`Canvas set to fullscreen: ${canvas.width}x${canvas.height}`);
      
      // Import required functions
      const { generateCalibrationPoints } = await import('./Action/CalibratePoints');
      const { drawRedDot, runCountdown, showCapturePreview } = await import('./Action/countSave');
      const { captureImagesAtPoint } = await import('./Helper/savefile');
      
      // Generate calibration points based on the full canvas size
      const points = generateCalibrationPoints(canvas.width, canvas.height);
      
      if (!points || points.length === 0) {
        throw new Error("Failed to generate calibration points");
      }
      
      // Create a status indicator
      const statusIndicator = document.createElement('div');
      statusIndicator.className = 'calibrate-status-indicator';
      statusIndicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: rgba(0, 102, 204, 0.9);
        color: white;
        font-size: 16px;
        font-weight: bold;
        padding: 10px 15px;
        border-radius: 8px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      `;
      statusIndicator.textContent = 'Calibration: Initializing...';
      document.body.appendChild(statusIndicator);
      
      // Access webcam before starting calibration if available
      // if (triggerCameraAccess) {
      //   triggerCameraAccess(true);
      //   await new Promise(resolve => setTimeout(resolve, 800));
      // }
      
      // Process each calibration point
      let successCount = 0;
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        
        statusIndicator.textContent = `Calibration: Point ${i + 1}/${points.length}`;
        setProcessStatus(`Processing calibration point ${i + 1}/${points.length}`);
        
        // ---------- IMPORTANT: Redraw entire canvas for each point ----------
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the dot - using direct drawing rather than a helper function
        // to ensure we have complete control
        drawRedDot(ctx, point.x, point.y, 15, true);
        
        // Create a redraw interval to keep dot visible during the entire process
        let redrawInterval = setInterval(() => {
          drawRedDot(ctx, point.x, point.y, 15, false);
        }, 100);
        
        try {
          // Run countdown
          await new Promise((resolve, reject) => {
            try {
              runCountdown(
                point,
                canvas,
                (status) => {
                  // Update UI based on status
                  if (status.processStatus) {
                    setProcessStatus(`Point ${i+1}/${points.length}: ${status.processStatus}`);
                  }
                },
                resolve // This resolves when countdown completes
              );
            } catch (error) {
              reject(error);
            }
          });
          
          // Ensure the dot is still visible after countdown
          drawRedDot(ctx, point.x, point.y, 15, false);
          
          // Wait a moment for visual consistency
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Explicitly trigger camera access again before capture
          // if (triggerCameraAccess) {
          //   triggerCameraAccess(true);
          //   await new Promise(resolve => setTimeout(resolve, 300));
          // }
          
          // Capture images at this point
          const captureResult = await captureImagesAtPoint({
            point: point,
            captureCount: captureCount,
            canvasRef: { current: canvas },
            setCaptureCount: setCaptureCount,
            showCapturePreview
          });
          
          // Clear the redraw interval once capture is complete
          clearInterval(redrawInterval);
          
          if (captureResult && (captureResult.screenImage || captureResult.success)) {
            successCount++;
          }
          
          // Increment counter
          setCaptureCount(prev => prev + 1);
          
          // Wait between points
          await new Promise(resolve => setTimeout(resolve, 1200));
          
        } catch (error) {
          console.error(`Error processing calibration point ${i+1}:`, error);
          clearInterval(redrawInterval);
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
      
      // ---------- IMPORTANT: Reset canvas styling ----------
      // Return canvas to normal styling after calibration
      canvas.style.position = '';
      canvas.style.top = '';
      canvas.style.left = '';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = '';
      
      // Redraw canvas at original size with parent container
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth || 800;
        canvas.height = parent.clientHeight || 600;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
    } catch (error) {
      console.error("Calibration error:", error);
      setProcessStatus(`Calibration error: ${error.message}`);
    } finally {
      setIsCapturing(false);
      
      // Show TopBar again
      setTimeout(() => {
        if (typeof onActionClick === 'function') {
          onActionClick('toggleTopBar', true);
        } else if (typeof window !== 'undefined' && window.toggleTopBar) {
          window.toggleTopBar(true);
        }
      }, 1000);
    }
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
  const handleRandomDot = async () => {
    if (isCapturing) return;
    
    // Use the consolidated function with random position
    await handleDotProcess({
      useRandomPosition: true,
      onStatusUpdate: (status) => {
        if (status.processStatus) setProcessStatus(status.processStatus);
        if (status.isCapturing !== undefined) setIsCapturing(status.isCapturing);
      },
      toggleTopBar: (show) => {
        if (typeof onActionClick === 'function') {
          onActionClick('toggleTopBar', show);
        }
      },
      triggerCameraAccess,
      setIsCapturing,
      captureCount,
      setCaptureCount: setCaptureCount,
      postCountdownDelay: 1000
    });
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
});
const ActionButtonGroup = dynamic(() => Promise.resolve(
  forwardRef((props, ref) => <ActionButtonGroupInner {...props} ref={ref} />)
), { ssr: false });
// Create a client-only version of ActionButtonGroup
// const ActionButtonGroup = dynamic(() => Promise.resolve(ActionButtonGroupInner), { ssr: false });

export { ActionButton, ActionButtonGroup };