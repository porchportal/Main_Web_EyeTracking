import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { generateCalibrationPoints } from '../../../components/collected-dataset-customized/Action/CalibratePoints';
import { 
  showCapturePreview, 
  drawRedDot, 
  getRandomPosition,
  createCountdownElement,
  runCountdown
} from '../../../components/collected-dataset-customized/Action/countSave';
import { captureImagesAtPoint } from '../../../components/collected-dataset-customized/Helper/savefile';
import { useRouter } from 'next/router';
import { useAdminSettings } from './adminSettings';

// Add deep comparison utility
const isEqual = (obj1, obj2) => {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
  if (obj1 === null || obj2 === null) return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  return keys1.every(key => 
    keys2.includes(key) && isEqual(obj1[key], obj2[key])
  );
};

// Create a basic ActionButton component with optimization
const ActionButton = ({ text, abbreviatedText, onClick, customClass = '', disabled = false, active = false }) => {
  const [isAbbreviated, setIsAbbreviated] = useState(false);
  const { settings } = useAdminSettings();
  const [currentUserId, setCurrentUserId] = useState('default');
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureCounter, setCaptureCounter] = useState(1);
  const [processStatus, setProcessStatus] = useState('');

  // Memoize button props to prevent unnecessary re-renders
  const buttonProps = useMemo(() => ({
    className: `action-button ${customClass} ${isAbbreviated ? 'abbreviated' : ''} ${active ? 'active' : ''}`,
    onClick,
    disabled,
    title: text
  }), [customClass, isAbbreviated, active, onClick, disabled, text]);

  // Check window size and set abbreviated mode with debounce
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const width = window.innerWidth;
        setIsAbbreviated(width < 768);
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Add effect to listen for user ID changes with optimization
  useEffect(() => {
    const handleUserIdChange = (event) => {
      if (event.detail && event.detail.type === 'userIdChange') {
        const newUserId = event.detail.userId;
        if (newUserId !== currentUserId) {
          setCurrentUserId(newUserId);
        }
      }
    };

    window.addEventListener('userIdChange', handleUserIdChange);
    return () => {
      window.removeEventListener('userIdChange', handleUserIdChange);
    };
  }, [currentUserId]);

  return (
    <button {...buttonProps}>
      {isAbbreviated ? abbreviatedText : text}
      {processStatus && (
        <div className="process-status">
          {processStatus}
        </div>
      )}
    </button>
  );
};

// Create the ActionButtonGroup component with client-side only rendering and optimization
const ActionButtonGroupInner = forwardRef(({ triggerCameraAccess, isCompactMode, onActionClick }, ref) => {
  const router = useRouter();
  const { settings, updateSettings } = useAdminSettings(ref);
  
  // State for button actions
  const [randomTimes, setRandomTimes] = useState(1);
  const [delaySeconds, setDelaySeconds] = useState(3);
  const canvasRef = useRef(null);
  const [processStatus, setProcessStatus] = useState('');
  const [countdownValue, setCountdownValue] = useState(null);
  const [currentDot, setCurrentDot] = useState(null);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
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
  const [currentUserId, setCurrentUserId] = useState('default');

  // Add cache for settings
  const settingsCache = useRef(new Map());
  const lastSettingsUpdate = useRef(new Map());

  
  // Optimize settings updates
  useEffect(() => {
    if (settings && currentUserId && settings[currentUserId]) {
      const userSettings = settings[currentUserId];
      const cachedSettings = settingsCache.current.get(currentUserId);
      
      if (!isEqual(cachedSettings, userSettings)) {
        setRandomTimes(Number(userSettings.times_set_random) || 1);
        setDelaySeconds(Number(userSettings.delay_set_random) || 3);
        settingsCache.current.set(currentUserId, userSettings);
        lastSettingsUpdate.current.set(currentUserId, Date.now());
      }
    }
  }, [settings, currentUserId]);

  // Listen for user ID changes
  useEffect(() => {
    const handleUserIdChange = (event) => {
      if (event.detail && event.detail.type === 'userIdChange') {
        const newUserId = event.detail.userId;
        setCurrentUserId(newUserId);
        // Update settings for new user
        if (settings && settings[newUserId]) {
          const userSettings = settings[newUserId];
          setRandomTimes(Number(userSettings.times_set_random) || 1);
          setDelaySeconds(Number(userSettings.delay_set_random) || 3);
        }
      }
    };
    window.addEventListener('userIdChange', handleUserIdChange);
    return () => {
      window.removeEventListener('userIdChange', handleUserIdChange);
    };
  }, [settings]);

  // Listen for settings updates
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      if (event.detail && event.detail.type === 'captureSettings') {
        const { userId, times_set_random, delay_set_random } = event.detail;
        if (userId === currentUserId) {
          if (times_set_random !== undefined) {
            const newTimes = Number(times_set_random) || 1;
            setRandomTimes(newTimes);
          }
          if (delay_set_random !== undefined) {
            const newDelay = Number(delay_set_random) || 3;
            setDelaySeconds(newDelay);
          }
        }
      }
    };
    window.addEventListener('captureSettingsUpdate', handleSettingsUpdate);
    return () => {
      window.removeEventListener('captureSettingsUpdate', handleSettingsUpdate);
    };
  }, [currentUserId]);

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
    // Only initialize if canvas doesn't exist
    if (!document.querySelector('#tracking-canvas')) {
      const canvas = getMainCanvas();
      console.log('Canvas initialized:', canvas ? 'success' : 'failed');
    }
    
    // Cleanup function
    return () => {
      // Don't remove canvas on cleanup to prevent recreation issues
      console.log('ActionButton cleanup - canvas preserved');
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
          console.log('Updating randomTimes to:', timeValue);
          setRandomTimes(timeValue);
        }
      }
      
      // Get the delay input element
      const delayInput = document.querySelector('.control-input-field[data-control="delay"]');
      if (delayInput) {
        const delayValue = parseInt(delayInput.value, 10);
        if (!isNaN(delayValue) && delayValue > 0) {
          console.log('Updating delaySeconds to:', delayValue);
          setDelaySeconds(delayValue);
        }
      }
    };
    
    // Add event listeners to the control inputs
    const timeInput = document.querySelector('.control-input-field[data-control="time"]');
    const delayInput = document.querySelector('.control-input-field[data-control="delay"]');
    
    if (timeInput) {
      timeInput.addEventListener('change', updateControlValues);
      timeInput.addEventListener('input', updateControlValues); // Also listen for input events
    }
    
    if (delayInput) {
      delayInput.addEventListener('change', updateControlValues);
      delayInput.addEventListener('input', updateControlValues); // Also listen for input events
    }
    
    // Initial update
    updateControlValues();
    
    // Cleanup event listeners
    return () => {
      if (timeInput) {
        timeInput.removeEventListener('change', updateControlValues);
        timeInput.removeEventListener('input', updateControlValues);
      }
      
      if (delayInput) {
        delayInput.removeEventListener('change', updateControlValues);
        delayInput.removeEventListener('input', updateControlValues);
      }
    };
  }, []);

  // Initialize canvas on component mount
  useEffect(() => {
    const initializeCanvas = () => {
      // Remove any existing canvas
      const existingCanvas = document.querySelector('.tracking-canvas');
      if (existingCanvas) {
        existingCanvas.remove();
      }

      // Create new canvas
      const canvas = document.createElement('canvas');
      canvas.className = 'tracking-canvas';
      canvas.id = 'tracking-canvas';
      canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        opacity: 0;
        pointer-events: none;
        z-index: 5;
      `;

      // Set canvas dimensions
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Add canvas to body
      document.body.appendChild(canvas);

      // Store reference
      canvasRef.current = canvas;
      if (typeof window !== 'undefined') {
        window.whiteScreenCanvas = canvas;
      }

      // Initialize with white background
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add resize handler
      const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
      };
    };

    const cleanup = initializeCanvas();
    return cleanup;
  }, []);

  // Helper function to get the main canvas - improved to be more reliable
  const getMainCanvas = () => {
    // First check if we have a valid canvas reference
    if (canvasRef.current && document.contains(canvasRef.current)) {
      return canvasRef.current;
    }
    
    // Try to find existing canvas in DOM
    let existingCanvas = document.querySelector('#tracking-canvas');
    
    if (existingCanvas && document.contains(existingCanvas)) {
      canvasRef.current = existingCanvas;
      window.whiteScreenCanvas = existingCanvas;
      return existingCanvas;
    }

    // Create new canvas only if none exists
    console.log('Creating new canvas...');
    const canvas = document.createElement('canvas');
    canvas.className = 'tracking-canvas';
    canvas.id = 'tracking-canvas';
    
    // Set initial dimensions and style
    canvas.width = 800;
    canvas.height = 400;
    canvas.style.cssText = `
      position: relative;
      width: 100%;
      height: 400px;
      background-color: white;
      border: 1px solid #ccc;
      display: block;
    `;
    
    // Initialize with white background
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Find container and append
    const container = document.querySelector('.canvas-container') || 
                      document.querySelector('.main-content') ||
                      document.body;
    
    container.appendChild(canvas);
    
    // Store references
    canvasRef.current = canvas;
    window.whiteScreenCanvas = canvas;
    
    return canvas;
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
  const restoreCanvas = (canvas) => {
    if (!canvas || !canvas._originalState) return;
    
    const original = canvas._originalState;
    
    try {
      // Restore to original parent
      if (original.parent && document.contains(original.parent)) {
        original.parent.appendChild(canvas);
      } else {
        // Fallback to a container if original parent is gone
        const container = document.querySelector('.canvas-container') || 
                        document.querySelector('.main-content') ||
                        document.body;
        container.appendChild(canvas);
      }
      
      // Restore styles
      canvas.style.position = original.position || 'relative';
      canvas.style.top = original.top || '';
      canvas.style.left = original.left || '';
      canvas.style.width = original.width || '100%';
      canvas.style.height = original.height || '400px';
      canvas.style.zIndex = original.zIndex || '';
      canvas.style.backgroundColor = 'white';
      
      // Restore dimensions
      canvas.width = original.canvasWidth || 800;
      canvas.height = original.canvasHeight || 400;
      
      // Clear with white background
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Clear the saved state
      delete canvas._originalState;
      
    } catch (error) {
      console.error('Error restoring canvas:', error);
      // Fallback: just clear the canvas
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
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

  const ensureCanvasExists = () => {
    let canvas = document.querySelector('#tracking-canvas');
    
    if (!canvas) {
      // Create new canvas
      canvas = document.createElement('canvas');
      canvas.className = 'tracking-canvas';
      canvas.id = 'tracking-canvas';
      
      // Function to update canvas to current window size
      const updateCanvasSize = () => {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Set canvas internal dimensions to EXACT window size
        canvas.width = windowWidth;
        canvas.height = windowHeight;
        
        // Set CSS to match exactly (100% of window)
        canvas.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          max-width: 100vw;
          max-height: 100vh;
          background-color: white;
          border: none;
          display: block;
          z-index: 99999;
          opacity: 1;
          pointer-events: auto;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        `;
        
        console.log(`Canvas updated to window size: ${windowWidth}x${windowHeight}`);
        return { width: windowWidth, height: windowHeight };
      };
      
      // Initial size setup
      const initialSize = updateCanvasSize();
      
      // Initialize with white background
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, initialSize.width, initialSize.height);
      
      // Hide other UI elements when canvas goes fullscreen
      const hideUIElements = () => {
        const elementsToHide = [
          '.topbar',
          '.canvas-container', 
          '.main-content',
          '.metrics-panel',
          '.display-metrics',
          'nav',
          'header',
          '.button-groups',
          '.control-buttons'
        ];
        
        elementsToHide.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            el.style.display = 'none';
            el.setAttribute('data-hidden-by-canvas', 'true');
          });
        });
      };
      
      hideUIElements();
      
      // Append to body for fullscreen
      document.body.appendChild(canvas);
      window.whiteScreenCanvas = canvas;
      
      // Resize handler that maintains 100% window coverage
      const handleResize = () => {
        const newSize = updateCanvasSize();
        
        // Redraw white background after resize
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, newSize.width, newSize.height);
      };
      
      // Add resize listener
      window.addEventListener('resize', handleResize);
      canvas._resizeHandler = handleResize;
      
      // Store update function for external use
      canvas._updateSize = updateCanvasSize;
      
      console.log(`Dynamic canvas created with initial size: ${initialSize.width}x${initialSize.height}`);
      
    } else {
      // Canvas already exists - ensure it's properly sized to current window
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      // Check if canvas needs resizing
      if (canvas.width !== windowWidth || canvas.height !== windowHeight) {
        canvas.width = windowWidth;
        canvas.height = windowHeight;
        
        // Update CSS to ensure 100% coverage
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '99999';
        
        // Redraw white background
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, windowWidth, windowHeight);
        
        console.log(`Existing canvas resized to current window: ${windowWidth}x${windowHeight}`);
      }
    }
    
    return canvas;
  };
  // Cleanup function to remove canvas and its properties
  const cleanupCanvas = () => {
    const canvas = document.querySelector('#tracking-canvas');
    if (canvas) {
      // Remove resize event listener if it exists
      if (canvas._resizeHandler) {
        window.removeEventListener('resize', canvas._resizeHandler);
        delete canvas._resizeHandler;
      }
      
      // Remove canvas from DOM
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      
      // Clear global references
      if (window.whiteScreenCanvas === canvas) {
        delete window.whiteScreenCanvas;
      }
      
      console.log('Canvas cleaned up and removed');
    }
  };

  // Modified canvas restore function for temporary operations
  const restoreCanvasToContainer = (canvas) => {
    if (!canvas) return;
    
    // Remove resize handler
    if (canvas._resizeHandler) {
      window.removeEventListener('resize', canvas._resizeHandler);
      delete canvas._resizeHandler;
    }
    
    // Show all previously hidden UI elements
    const hiddenElements = document.querySelectorAll('[data-hidden-by-canvas="true"]');
    hiddenElements.forEach(el => {
      el.style.display = '';
      el.removeAttribute('data-hidden-by-canvas');
    });
    
    // Find appropriate container
    const container = document.querySelector('.canvas-container') || 
                      document.querySelector('.main-content') ||
                      document.body;
    
    // Move canvas to container
    container.appendChild(canvas);
    
    // Reset to container-friendly dimensions
    const containerWidth = container.clientWidth || 800;
    const containerHeight = 400;
    
    canvas.width = containerWidth;
    canvas.height = containerHeight;
    
    // Reset CSS for container mode
    canvas.style.cssText = `
      position: relative;
      width: 100%;
      height: 400px;
      background-color: white;
      border: 1px solid #ccc;
      display: block;
      z-index: auto;
      opacity: 1;
      pointer-events: auto;
    `;
    
    // Clear and redraw white background
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    console.log(`Canvas restored to container mode: ${containerWidth}x${containerHeight}`);
  };
  
  // Modified handleDotProcess function with improved dot and countdown alignment
  // Complete handleDotProcess function with proper canvas management
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
    
    let canvas = null;
    let keepDotVisibleInterval = null;
    let countdownElement = null;
    
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
      
      // Use ensureCanvasExists to get or create canvas
      canvas = ensureCanvasExists();
      if (!canvas) {
        throw new Error("Failed to create or find canvas");
      }
      
      // Canvas is already set to fullscreen by ensureCanvasExists
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // Get context and clear canvas with white background
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
      keepDotVisibleInterval = setInterval(() => {
        drawRedDot(ctx, dotPosition.x, dotPosition.y, dotRadius, false);
      }, 50);  // More frequent updates for reliability
      
      // Remove any existing countdown elements
      const existingCountdowns = document.querySelectorAll('.dot-countdown, .calibrate-countdown');
      existingCountdowns.forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      
      // Create a countdown element directly on top of the dot
      countdownElement = document.createElement('div');
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
        if (countdownElement && countdownElement.parentNode) {
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
      
      // Update status
      onStatusUpdate?.({
        processStatus: 'Capture completed',
        isCapturing: false
      });
      
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
      
      return {
        success: false,
        error: error.message
      };
      
    } finally {
      // Clear redraw interval first
      if (keepDotVisibleInterval) {
        clearInterval(keepDotVisibleInterval);
        keepDotVisibleInterval = null;
      }
      
      // Remove countdown element if it still exists
      if (countdownElement && countdownElement.parentNode) {
        countdownElement.parentNode.removeChild(countdownElement);
      }
      
      // Remove any remaining countdown elements
      const remainingCountdowns = document.querySelectorAll('.dot-countdown, .calibrate-countdown');
      remainingCountdowns.forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      
      // Use restoreCanvasToContainer to properly restore canvas
      if (canvas) {
        restoreCanvasToContainer(canvas);
      }
      
      // Show TopBar again after a delay
      setTimeout(() => {
        if (typeof toggleTopBar === 'function') {
          toggleTopBar(true);
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
      canvas = ensureCanvasExists();
      if (!canvas) {
        console.error('Failed to create canvas for calibration');
        return;
      }
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
      
      console.log(`Canvas set to fullscreen: ${canvasWidth}x${canvasHeight}`);
      
      // Get context
      const ctx = canvas.getContext('2d');
      
      // Clear canvas with white background
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Generate calibration points based on the canvas size
      const { generateCalibrationPoints } = await import('../../../components/collected-dataset-customized/Action/CalibratePoints');
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
          console.log(`Capturing calibration point ${i+1}/${points.length} at (${point.x}, ${point.y})`);
          
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
      
      setIsCapturing(false);
      setTimeout(() => {
        cleanupCanvas();
      }, 3000);
      if (canvas) {
        restoreCanvasToContainer(canvas);
      }
      
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

  const handleSetRandom = async () => {
    if (isCapturing) return;
    
    try {
      const canvas = ensureCanvasExists();
      if (!canvas) {
        console.error('Failed to create canvas for set random');
        return;
      }
      // Always get the latest settings from context for the current user
      const userSettings = settings && settings[currentUserId] ? settings[currentUserId] : {};
      const times = Number(userSettings.times_set_random) || Number(randomTimes) || 1;
      const delay = Number(userSettings.delay_set_random) || Number(delaySeconds) || 3;

      // Log current settings before starting
      console.log('Starting Set Random with settings:', {
        randomTimes,
        delaySeconds,
        currentUserId,
        settings,
        userSettings,
        times,
        delay
      });

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
        
        console.log(`Starting capture ${currentIndex} of ${times}`);
        
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
          console.log(`Successfully completed capture ${currentIndex}`);
        } else {
          console.warn(`Capture ${currentIndex} may have failed:`, result);
        }
        
        // Wait between captures - but only if there are more captures to go
        if (currentIndex < times) {
          setProcessStatus(`Waiting ${delay}s before next capture...`);
          console.log(`Waiting ${delay}s before next capture...`);
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
      }

      // Completion notification
      setProcessStatus(`Random capture sequence completed: ${successCount}/${times} captures successful`);
      setRemainingCaptures(0);
      console.log(`Completed all captures: ${successCount}/${times} successful`);

    } catch (error) {
      console.error("Random sequence error:", error);
      setProcessStatus(`Random sequence failed: ${error.message}`);
    } finally {
      setIsCapturing(false);
      setTimeout(() => {
        cleanupCanvas();
      }, 3000);
      const canvas = document.querySelector('#tracking-canvas');
      if (canvas) {
        restoreCanvasToContainer(canvas);
      }
      
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

    try {
      const canvas = ensureCanvasExists();
      if (!canvas) {
        console.error('Failed to create canvas for random dot');
        return;
      }
      
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
    } catch (error) {
    console.error('Random dot error:', error);
    } finally {
      // Clean up canvas after process completes
      setTimeout(() => {
        cleanupCanvas();
      }, 2000); // Wait 2 seconds before cleanup
    }
    
  };
  const makeCanvasFullscreen = (canvas) => {
    if (!canvas) return null;
    
    // Save original state if not already saved
    if (!canvas._originalState) {
      canvas._originalState = {
        parent: canvas.parentElement,
        position: canvas.style.position,
        top: canvas.style.top,
        left: canvas.style.left,
        width: canvas.style.width,
        height: canvas.style.height,
        zIndex: canvas.style.zIndex,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
      };
    }
    
    // Move to body and make fullscreen
    document.body.appendChild(canvas);
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '10';
    canvas.style.backgroundColor = 'white';
    
    // Set canvas dimensions to match window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Clear with white background
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    return canvas;
  };
  

  // Load calibration setup
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setupCalibration = async () => {
      try {
        const { default: CalibrateHandler } = await import('../../../components/collected-dataset-customized/Action/CalibrateHandler');
    
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
    // Clear canvas content
    const canvas = document.querySelector('#tracking-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Restore canvas to container mode
      restoreCanvasToContainer(canvas);
    }
    
    // Reset states
    setProcessStatus('');
    setRemainingCaptures(0);
    setIsCapturing(false);
    setCountdownValue(null);
    setShowCanvas(true);
    setCurrentDot(null);
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

  // Mobile layout - 2x5 grid
  return (
    <div>
      {isCompactMode ? (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div></div>
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
const ActionButtonGroup = dynamic(() => Promise.resolve(
  forwardRef((props, ref) => <ActionButtonGroupInner {...props} ref={ref} />)
), { ssr: false });
// Create a client-only version of ActionButtonGroup
// const ActionButtonGroup = dynamic(() => Promise.resolve(ActionButtonGroupInner), { ssr: false });

// Add default export component
export default function ActionButtonPage() {
  return null; // This is a utility file, so we don't need to render anything
}

export { ActionButton, ActionButtonGroup };