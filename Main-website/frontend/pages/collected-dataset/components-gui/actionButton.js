import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import { generateCalibrationPoints } from '../../../components/collected-dataset/Action/CalibratePoints.jsx';
import { 
  showCapturePreview, 
  drawRedDot, 
  getRandomPosition,
  createCountdownElement,
  runCountdown
} from '../../../components/collected-dataset/Action/countSave';
import { captureImagesAtPoint } from '../../../components/collected-dataset/Helper/savefile';
import { useRouter } from 'next/router';

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
  const router = useRouter();
  
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
  const [showCanvas, setShowCanvas] = useState(true);
  
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

  useEffect(() => {
    // Make functions globally accessible as a fallback
    if (typeof window !== 'undefined') {
      window.actionButtonFunctions = {
        handleRandomDot,
        handleSetRandom,
        handleSetCalibrate,
        handleClearAll
      };
      // console.log('Action button functions exposed to window.actionButtonFunctions');
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
      // console.warn('[initializeCanvas] Canvas or parent is null', { canvas, parent });
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
      
      // console.log(`Canvas initialized with dimensions: ${canvas.width}x${canvas.height}`);
      return true;
    } catch (error) {
      console.error('[initializeCanvas] Error initializing canvas:', error);
      return false;
    }
  };

  // Helper function to get the main canvas - improved to be more reliable
  const getMainCanvas = () => {
    // Try multiple methods to find the canvas
    
    if (canvasRef.current) {
      // console.log("Using direct canvasRef.current reference");
      return canvasRef.current;
    }
    
    if (typeof window !== 'undefined' && window.whiteScreenCanvas) {
      // console.log("Using global whiteScreenCanvas reference");
      canvasRef.current = window.whiteScreenCanvas; // Update our ref
      return window.whiteScreenCanvas;
    }

    if (typeof document !== 'undefined') {
      const canvasElement = document.querySelector('.tracking-canvas');
      if (canvasElement) {
        // console.log("Found canvas via DOM selector");
        canvasRef.current = canvasElement; // Update our ref
        if (typeof window !== 'undefined') {
          window.whiteScreenCanvas = canvasElement; // Update global ref too
        }
        return canvasElement;
      }
    }
    
    return null;
  };
  const makeCanvasFullscreen = (canvas) => {
    // First initialize with parent dimensions
    const parent = canvas.parentElement || document.body;
    initializeCanvas(canvas, parent);
    
    // Then force fullscreen styling
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '5';
    
    // Force dimensions to match window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Clear and prepare canvas again
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
  };
  const restoreCanvasSize = (canvas) => {
    // Restore original canvas styling
    canvas.style.position = '';
    canvas.style.top = '';
    canvas.style.left = '';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '';
    
    // Restore original dimensions
    if (canvas.parentElement) {
      initializeCanvas(canvas, canvas.parentElement);
    }
  };

  const handlePermissionAccepted = () => {
    setShowPermissionPopup(false);
    if (triggerCameraAccess) {
      triggerCameraAccess(true);
    }
  };

  // Handler to cancel permission popup
  const handlePermissionDenied = () => {
    setShowPermissionPopup(false);
  };

  // Helper function to restore the canvas to its original parent and styling
  const restoreCanvas = (canvas, originalParent, originalStyle) => {
    if (!canvas || !originalParent) return;

    // Append the canvas back to its original parent if needed
    if (canvas.parentElement !== originalParent) {
      originalParent.appendChild(canvas);
    }
    
    // Restore the inline styles saved earlier
    canvas.style.position = originalStyle.position;
    canvas.style.top = originalStyle.top;
    canvas.style.left = originalStyle.left;
    canvas.style.width = originalStyle.width;
    canvas.style.height = originalStyle.height;
    canvas.style.zIndex = originalStyle.zIndex;
    
    // Reset the dimensions based on the parent element's size or fallback defaults
    canvas.width = originalParent.clientWidth || 800;
    canvas.height = originalParent.clientHeight || 600;
    
    // Clear the canvas and fill with a white background
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
  // Modified handleDotProcess function with improved dot and countdown alignment
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
      postCountdownDelay = 500 
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
      
      // Save original state for restoration
      const originalParent = canvas.parentElement;
      const originalStyle = {
        position: canvas.style.position,
        top: canvas.style.top,
        left: canvas.style.left,
        width: canvas.style.width,
        height: canvas.style.height,
        zIndex: canvas.style.zIndex
      };

      // Prepare canvas for fullscreen display
      document.body.appendChild(canvas);
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.zIndex = '10';
      
      // Set dimensions to match window exactly
      const canvasWidth = window.innerWidth;
      const canvasHeight = window.innerHeight;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      // Clear canvas with white background
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      // Get position for the dot - either use provided position or generate random one
      const dotPosition = useRandomPosition 
        ? getRandomPosition(canvas, 20) 
        : position;
      
      if (!dotPosition || typeof dotPosition.x !== 'number' || typeof dotPosition.y !== 'number') {
        throw new Error("Invalid dot position");
      }
      
      // Draw the dot
      const dotRadius = 12;
      drawRedDot(ctx, dotPosition.x, dotPosition.y, dotRadius, false);
      
      // Create a redraw interval to ensure dot stays visible
      let keepDotVisibleInterval = setInterval(() => {
        drawRedDot(ctx, dotPosition.x, dotPosition.y, dotRadius, false);
      }, 50);  // More frequent updates for reliability
      
      // Remove any existing countdown elements
      const existingCountdowns = document.querySelectorAll('.dot-countdown, .calibrate-countdown');
      existingCountdowns.forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      
      // Create a countdown element directly on top of the dot
      // Important: Position the countdown centered directly over the dot
      const countdownElement = document.createElement('div');
      countdownElement.className = 'dot-countdown';
      countdownElement.style.cssText = `
        position: fixed;
        left: ${dotPosition.x}px;
        top: ${dotPosition.y}px;
        transform: translate(-50%, -50%);
        color: red;
        font-size: 36px;
        font-weight: bold;
        text-shadow: 0 0 10px white, 0 0 20px white;
        z-index: 10000;
        background-color: rgba(255, 255, 255, 0.8);
        border: 2px solid red;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
      `;
      document.body.appendChild(countdownElement);
      
      // Manual countdown
      for (let count = 3; count > 0; count--) {
        countdownElement.textContent = count;
        
        onStatusUpdate?.({
          processStatus: `Countdown: ${count}`,
          countdownValue: count,
          isCapturing: true
        });
        
        // Redraw the dot for reliability
        drawRedDot(ctx, dotPosition.x, dotPosition.y, dotRadius, false);
        
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Additional redraw during countdown to ensure visibility
        drawRedDot(ctx, dotPosition.x, dotPosition.y, dotRadius, false);
      }
      
      // Show checkmark
      countdownElement.textContent = "✓";
      
      // Make sure dot is still visible
      drawRedDot(ctx, dotPosition.x, dotPosition.y, dotRadius, false);
      
      // Remove countdown element after delay
      setTimeout(() => {
        if (countdownElement.parentNode) {
          countdownElement.parentNode.removeChild(countdownElement);
        }
      }, 300);
      
      // Wait after countdown completes
      await new Promise(resolve => setTimeout(resolve, postCountdownDelay));
      
      // Ensure the dot is still visible
      drawRedDot(ctx, dotPosition.x, dotPosition.y, dotRadius, false);
      
      // Capture images at this point
      const captureResult = await captureImagesAtPoint({
        point: dotPosition,
        captureCount: captureCount,
        canvasRef: { current: canvas },
        setCaptureCount: setCaptureCount,
        showCapturePreview
      });
      
      // Clear redraw interval
      clearInterval(keepDotVisibleInterval);
      
      // Restore canvas to original state
      if (originalParent && canvas.parentElement !== originalParent) {
        originalParent.appendChild(canvas);
      }
      
      canvas.style.position = originalStyle.position || '';
      canvas.style.top = originalStyle.top || '';
      canvas.style.left = originalStyle.left || '';
      canvas.style.width = originalStyle.width || '100%';
      canvas.style.height = originalStyle.height || '100%';
      canvas.style.zIndex = originalStyle.zIndex || '';
      
      // Reset dimensions
      if (originalParent) {
        canvas.width = originalParent.clientWidth || 800;
        canvas.height = originalParent.clientHeight || 600;
      }
      
      // Clear canvas
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update status
      onStatusUpdate?.({
        processStatus: 'Capture completed',
        isCapturing: false
      });
      
      // Show TopBar again after a delay
      setTimeout(() => {
        if (typeof toggleTopBar === 'function') {
          toggleTopBar(true);
        } else if (typeof window !== 'undefined' && window.toggleTopBar) {
          window.toggleTopBar(true);
        }
      }, 2000);
      
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
      
      // Show TopBar again if there's an error
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
  
  // This partial file shows only the fixed handleSetRandom function
  // Fixed handleSetRandom function using handleDotProcess
  const handleSetRandom = async () => {
    if (isCapturing) return;
    
    try {
      // Read values from TopBar inputs
      const timeInput = document.querySelector('.control-input-field');
      const delayInput = document.querySelectorAll('.control-input-field')[1];
      let times = randomTimes || 1;
      let delay = delaySeconds || 3;
      
      // Parse input values if available
      if (timeInput) {
        const parsedTime = parseInt(timeInput.value, 10);
        if (!isNaN(parsedTime) && parsedTime > 0) {
          times = parsedTime;
          setRandomTimes(times);
        }
      }

      if (delayInput) {
        const parsedDelay = parseInt(delayInput.value, 10);
        if (!isNaN(parsedDelay) && parsedDelay > 0) {
          delay = parsedDelay;
          setDelaySeconds(delay);
        }
      }

      // Hide TopBar
      if (typeof onActionClick === 'function') {
        onActionClick('toggleTopBar', false);
      } else if (typeof window !== 'undefined' && window.toggleTopBar) {
        window.toggleTopBar(false);
      }

      setIsCapturing(true);
      setRemainingCaptures(times);
      setProcessStatus(`Starting ${times} random captures with ${delay}s delay...`);

      // Process all captures in sequence
      let successCount = 0;
      
      for (let currentIndex = 1; currentIndex <= times; currentIndex++) {
        // Update status for current capture
        setProcessStatus(`Capture ${currentIndex} of ${times}`);
        setRemainingCaptures(times - currentIndex + 1);
        
        // Use handleDotProcess for each capture
        const result = await handleDotProcess({
          useRandomPosition: true,
          onStatusUpdate: (status) => {
            if (status.processStatus) {
              setProcessStatus(`Capture ${currentIndex}/${times}: ${status.processStatus}`);
            }
          },
          toggleTopBar: (show) => {
            // Only show TopBar after the last capture
            if (show && currentIndex < times) {
              return; // Don't show yet for intermediate captures
            }
            
            if (typeof onActionClick === 'function') {
              onActionClick('toggleTopBar', show);
            } else if (typeof window !== 'undefined' && window.toggleTopBar) {
              window.toggleTopBar(show);
            }
          },
          triggerCameraAccess,
          setIsCapturing: (capturing) => {
            // Only set capturing to false after all captures
            if (!capturing && currentIndex < times) {
              return; // Stay in capturing state between dots
            }
            setIsCapturing(capturing);
          },
          captureCount,
          setCaptureCount,
          postCountdownDelay: 800
        });
        
        if (result && result.success) {
          successCount++;
        }
        
        // Wait between captures - but only if there are more captures to go
        if (currentIndex < times) {
          setProcessStatus(`Waiting ${delay}s before next capture...`);
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
      }

      // Completion notification
      setProcessStatus(`Random capture sequence completed: ${successCount}/${times} captures successful`);
      setRemainingCaptures(0);

    } catch (error) {
      console.error("Random sequence error:", error);
      setProcessStatus(`Random sequence failed: ${error.message}`);
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

  const handleSetCalibrate = async () => {
    if (isCapturing) return;
    
    // Declare these variables OUTSIDE the try block
    let canvas = null;
    let originalCanvasParent = null;
    let originalCanvasStyle = {};
    let statusIndicator = null;
    let currentRedrawInterval = null;

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
      
      // Get canvas reference
      canvas = getMainCanvas();
      if (!canvas) {
        setProcessStatus("Error: Canvas not found");
        setIsCapturing(false);
        if (typeof onActionClick === 'function') {
          onActionClick('toggleTopBar', true);
        }
        return;
      }
      
      // Save original parent and style
      originalCanvasParent = canvas.parentElement;
      originalCanvasStyle = {
        position: canvas.style.position,
        top: canvas.style.top,
        left: canvas.style.left,
        width: canvas.style.width,
        height: canvas.style.height,
        zIndex: canvas.style.zIndex
      };
      
      // Move canvas to body for maximum reliability
      document.body.appendChild(canvas);
      
      // Make canvas fullscreen with fixed positioning
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.zIndex = '10';
      
      // Set dimensions to match window exactly
      const canvasWidth = window.innerWidth;
      const canvasHeight = window.innerHeight;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      
      // Get context
      const ctx = canvas.getContext('2d');
      
      // Clear canvas with white background
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Generate calibration points based on the canvas size
      const { generateCalibrationPoints } = await import('../../../components/collected-dataset/Action/CalibratePoints.jsx');
      const points = generateCalibrationPoints(canvasWidth, canvasHeight);
      
      if (!points || points.length === 0) {
        throw new Error("Failed to generate calibration points");
      }
      
      // Create a status indicator
      statusIndicator = document.createElement('div');
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
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      `;
      statusIndicator.textContent = 'Calibration: Initializing...';
      document.body.appendChild(statusIndicator);
      
      // Process each calibration point
      let successCount = 0;
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        
        // Clear any existing redraw interval
        if (currentRedrawInterval) {
          clearInterval(currentRedrawInterval);
          currentRedrawInterval = null;
        }
        
        // Update status displays
        statusIndicator.textContent = `Calibration: Point ${i + 1}/${points.length}`;
        setProcessStatus(`Processing calibration point ${i + 1}/${points.length}`);
        
        // Reset canvas if dimensions changed
        if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
          console.warn(`Canvas dimensions changed. Resetting to ${canvasWidth}x${canvasHeight}`);
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
        }
        
        // Make sure canvas is still attached to body and in fullscreen mode
        if (canvas.parentElement !== document.body) {
          document.body.appendChild(canvas);
          canvas.style.position = 'fixed';
          canvas.style.top = '0';
          canvas.style.left = '0';
          canvas.style.width = '100vw';
          canvas.style.height = '100vh';
          canvas.style.zIndex = '10';
        }
        
        // Clear canvas with white background
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Draw the calibration point
        const radius = 14; // Slightly larger for better visibility
        drawRedDot(ctx, point.x, point.y, radius, false);
        
        // Create redraw function for this point
        const redrawCurrentDot = () => {
          // Verify canvas dimensions and parent
          if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          }
          
          // Make sure canvas is still attached to body
          if (canvas.parentElement !== document.body) {
            document.body.appendChild(canvas);
          }
          
          // Redraw dot without clearing
          drawRedDot(ctx, point.x, point.y, radius, false);
        };
        
        // Start redraw interval - more frequent updates for reliable dot visibility
        currentRedrawInterval = setInterval(redrawCurrentDot, 50);
        
        // Remove any existing countdown elements
        const existingCountdowns = document.querySelectorAll('.dot-countdown, .calibrate-countdown');
        existingCountdowns.forEach(el => {
          if (el.parentNode) el.parentNode.removeChild(el);
        });
        
        // Create custom countdown element
        const countdownElement = document.createElement('div');
        countdownElement.className = 'dot-countdown'; // Consistent class name
        countdownElement.style.cssText = `
          position: fixed;
          left: ${point.x}px;
          top: ${point.y - 60}px;
          transform: translateX(-50%);
          color: red;
          font-size: 36px;
          font-weight: bold;
          text-shadow: 0 0 10px white, 0 0 20px white;
          z-index: 10000;
          background-color: rgba(255, 255, 255, 0.8);
          border: 2px solid red;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          display: flex;
          justify-content: center;
          align-items: center;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
        `;
        document.body.appendChild(countdownElement);
        
        try {
          // Manual countdown
          for (let count = 3; count > 0; count--) {
            countdownElement.textContent = count;
            setProcessStatus(`Point ${i+1}/${points.length}: Countdown ${count}`);
            
            // Force redraw multiple times during countdown to ensure visibility
            redrawCurrentDot();
            
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Redraw again halfway through the wait to ensure dot stays visible
            redrawCurrentDot();
          }
          
          // Show checkmark
          countdownElement.textContent = "✓";
          redrawCurrentDot();
          
          // Remove countdown element after delay
          setTimeout(() => {
            if (countdownElement.parentNode) {
              countdownElement.parentNode.removeChild(countdownElement);
            }
          }, 300);
          
          // Make sure dot is still visible
          redrawCurrentDot();
          
          // Capture images at this point
          
          // Manual force redraw one more time just before capture
          drawRedDot(ctx, point.x, point.y, radius, false);
          
          const captureResult = await captureImagesAtPoint({
            point: point,
            captureCount: captureCount,
            canvasRef: { current: canvas },
            setCaptureCount: setCaptureCount,
            showCapturePreview
          });
          
          if (captureResult && (captureResult.screenImage || captureResult.success)) {
            successCount++;
          }
          
          // Wait between points
          await new Promise(resolve => setTimeout(resolve, 1200));
          
        } catch (error) {
          console.error(`Error processing calibration point ${i+1}:`, error);
        } finally {
          // Clean up countdown if it still exists
          if (countdownElement.parentNode) {
            countdownElement.parentNode.removeChild(countdownElement);
          }
          
          // Clear redraw interval
          if (currentRedrawInterval) {
            clearInterval(currentRedrawInterval);
            currentRedrawInterval = null;
          }
        }
      }
      
      // Calibration complete
      if (statusIndicator) {
        statusIndicator.textContent = `Calibration complete: ${successCount}/${points.length} points`;
      }
      setProcessStatus(`Calibration completed: ${successCount}/${points.length} points captured`);
      
    } catch (error) {
      console.error("Calibration error:", error);
      setProcessStatus(`Calibration error: ${error.message}`);
      
      // Clean up redraw interval
      if (currentRedrawInterval) {
        clearInterval(currentRedrawInterval);
      }
    } finally {
      // Remove status indicator if it exists
      if (statusIndicator && statusIndicator.parentNode) {
        setTimeout(() => {
          statusIndicator.parentNode.removeChild(statusIndicator);
        }, 3000);
      }
      
      // Restore canvas to original parent and styling - Only if canvas was successfully initialized
      if (canvas) {
        try {
          // Try to find original parent
          if (originalCanvasParent && canvas.parentElement !== originalCanvasParent) {
            originalCanvasParent.appendChild(canvas);
          } else if (!originalCanvasParent) {
            // Fallback to looking for a container element
            const possibleParent = document.querySelector('.canvas-container');
            if (possibleParent && canvas.parentElement !== possibleParent) {
              possibleParent.appendChild(canvas);
            }
          }
          
          // Restore styling
          canvas.style.position = originalCanvasStyle.position || '';
          canvas.style.top = originalCanvasStyle.top || '';
          canvas.style.left = originalCanvasStyle.left || '';
          canvas.style.width = originalCanvasStyle.width || '100%';
          canvas.style.height = originalCanvasStyle.height || '100%';
          canvas.style.zIndex = originalCanvasStyle.zIndex || '';
          
          // Reset dimensions based on parent
          const parent = canvas.parentElement;
          if (parent) {
            canvas.width = parent.clientWidth || 800;
            canvas.height = parent.clientHeight || 600;
          } else {
            canvas.width = 800;
            canvas.height = 600;
          }
          
          // Clear canvas with white background
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
        } catch (e) {
          console.error("Error restoring canvas:", e);
        }
      }
      
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
        const { default: CalibrateHandler } = await import('../../../components/collected-dataset/Action/CalibrateHandler');
    
        const canvas = getMainCanvas();
        if (!canvas) {
          console.warn("Canvas not available during setupCalibration");
          return;
        }
        if (canvas) {
          makeCanvasFullscreen(canvas);
        }
    
        // console.log('Canvas size:', canvas.width, canvas.height);
        const points = generateCalibrationPoints(canvas.width, canvas.height);
        // console.log('Generated calibration points:', points);
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
        if (canvas) {
          restoreCanvasSize(canvas);
        }
    
      } catch (err) {
        console.error('Error initializing calibration:', err);
      }
    };

    setupCalibration();
  }, [captureCount, onActionClick]);
  
  // Clear All Button - Reset everything
  const handleClearAll = () => {
    clearCanvas();
    setProcessStatus('');
    setRemainingCaptures(0);
    setIsCapturing(false);
    setCountdownValue(null);
    setShowCanvas(true);
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
      // console.log(`Updated backend head pose: ${newHeadPoseState}`);
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
      // console.log(`Updated backend bounding box: ${newBoundingBoxState}`);
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
      // console.log(`Updated backend mask: ${newMaskState}`);
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
      // console.log(`Updated backend parameters: ${newParametersState}`);
    }
  };

  // Toggle camera preview
  const handleToggleCamera = () => {
    const newCameraState = !isCameraActive;
    setIsCameraActive(newCameraState);
    
    // Call the parent handler with 'preview' action
    if (onActionClick) {
      onActionClick('preview', newCameraState); // Pass the new state
    } else {
      // Fallback to direct trigger if no action handler
      setShowPermissionPopup(true);
    }
    
    // If turning on camera, ensure we apply current visualization settings
    if (newCameraState && typeof window !== 'undefined' && window.videoProcessor) {
      // Wait a short moment to ensure the video element is ready
      setTimeout(() => {
        if (window.videoProcessor) {
          window.videoProcessor.updateOptions({
            showHeadPose,
            showBoundingBox,
            showMask,
            showParameters
          });
        }
      }, 100);
    }
  };

  // Add back button handler
  const handleGoBack = () => {
    router.push('/');
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
      active: isCameraActive,
      disabled: isCapturing // Disable camera toggle while capturing
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
          <div className="grid grid-cols-3 gap-2">
            <ActionButton 
              text="Set Random"
              abbreviatedText="SRandom" 
              onClick={handleSetRandom}
              disabled={isCapturing}
            />
            <ActionButton 
              text="Go back"
              abbreviatedText="← Back" 
              onClick={handleGoBack}
              customClass="bg-gray-200 hover:bg-gray-300"
            />
            <ActionButton 
              text="Set Calibrate"
              abbreviatedText="Calibrate" 
              onClick={handleSetCalibrate}
              disabled={isCapturing}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton 
              text="Random Dot"
              abbreviatedText="Random" 
              onClick={handleRandomDot}
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
            zIndex: 15
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
const ActionButtonGroup = dynamic(() => Promise.resolve(ActionButtonGroupInner), {
  ssr: false
});

// Create the actual page component
export default function ActionButtonPage() {
  const actionButtonRef = useRef();
  const [cameraAccess, setCameraAccess] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsCompact(window.innerWidth < 768);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      handleResize();
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  const handleActionClick = (action) => {
    if (actionButtonRef.current) {
      switch (action) {
        case 'random':
          actionButtonRef.current.handleRandomDot();
          break;
        case 'setRandom':
          actionButtonRef.current.handleSetRandom();
          break;
        case 'calibrate':
          actionButtonRef.current.handleSetCalibrate();
          break;
        case 'clear':
          actionButtonRef.current.handleClearAll();
          break;
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <main className="flex-grow p-4">
        <ActionButtonGroup
          ref={actionButtonRef}
          triggerCameraAccess={setCameraAccess}
          isCompactMode={isCompact}
          onActionClick={handleActionClick}
        />
      </main>
    </div>
  );
}

export { ActionButton, ActionButtonGroup };