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

  // Global canvas manager instance - initialize only once
  const canvasManager = useMemo(() => new CanvasManager(), []);

  // Replace the complex canvas functions with simplified versions
  const getMainCanvas = () => {
    return canvasManager.getCanvas() || canvasManager.createCanvas();
  };

  const ensureCanvasExists = () => {
    return canvasManager.createCanvas();
  };

  const restoreCanvasToContainer = (canvas) => {
    canvasManager.exitFullscreen();
  };

  const cleanupCanvas = () => {
    canvasManager.destroy();
  };

  const clearCanvas = () => {
    canvasManager.clear();
  };

  // Utility function to easily manage canvas operations
  const canvasUtils = useMemo(() => ({
    // Get or create canvas
    getCanvas: () => canvasManager.getCanvas() || canvasManager.createCanvas(),
    
    // Enter fullscreen mode
    enterFullscreen: () => {
      canvasManager.enterFullscreen();
      return canvasManager.getCanvas();
    },
    
    // Exit fullscreen mode
    exitFullscreen: () => {
      canvasManager.exitFullscreen();
      return canvasManager.getCanvas();
    },
    
    // Clear canvas
    clear: () => {
      canvasManager.clear();
    },
    
    // Draw dot at position
    drawDot: (x, y, radius = 12) => {
      const canvas = canvasManager.getCanvas();
      if (!canvas) return false;
      
      const ctx = canvas.getContext('2d');
      drawRedDot(ctx, x, y, radius, false);
      return true;
    },
    
    // Get canvas dimensions
    getDimensions: () => {
      const canvas = canvasManager.getCanvas();
      if (!canvas) return { width: 0, height: 0 };
      
      return {
        width: canvas.width,
        height: canvas.height
      };
    },
    
    // Check if canvas is in fullscreen
    isFullscreen: () => canvasManager.isInFullscreen(),
    
    // Update canvas size to match container
    resizeToContainer: (container) => {
      const canvas = canvasManager.getCanvas();
      if (!canvas || !container) return false;
      
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width || container.clientWidth || 800;
      canvas.height = rect.height || container.clientHeight || 600;
      
      // Clear and redraw white background
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      return true;
    }
  }), []);

  // Make canvas utilities globally available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.canvasUtils = canvasUtils;
      window.canvasManager = canvasManager;
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.canvasUtils;
        delete window.canvasManager;
      }
    };
  }, [canvasUtils, canvasManager]);

  
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
    // Canvas is now managed by CanvasManager
    const canvas = getMainCanvas();
    console.log('Canvas initialized:', canvas ? 'success' : 'failed');
    
    return () => {
      // Cleanup is handled by CanvasManager
      console.log('ActionButton cleanup - canvas preserved');
    };
  }, []);

  // Canvas Manager - Simplified and centralized
  class CanvasManager {
    constructor() {
      this.canvas = null;
      this.originalState = null;
      this.resizeObserver = null;
      this.isFullscreen = false;
    }

    // Create or get canvas with automatic sizing
    createCanvas(container = null) {
      // Try to find existing canvas first
      let canvas = document.querySelector('#tracking-canvas');
      
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'tracking-canvas';
        canvas.id = 'tracking-canvas';
      }

      // Determine container
      const targetContainer = container || 
                             document.querySelector('.canvas-container') || 
                             document.querySelector('.main-content') ||
                             document.body;

      // Set initial dimensions based on container
      this.updateCanvasSize(canvas, targetContainer);
      
      // Initialize with white background
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add to container if not already there
      if (!canvas.parentNode) {
        targetContainer.appendChild(canvas);
      }

      // Store reference
      this.canvas = canvas;
      window.whiteScreenCanvas = canvas;

      // Set up responsive behavior
      this.setupResponsiveCanvas(canvas, targetContainer);

      console.log(`Canvas created/updated: ${canvas.width}x${canvas.height}`);
      return canvas;
    }

    // Update canvas size to match container
    updateCanvasSize(canvas, container) {
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const width = rect.width || container.clientWidth || 800;
      const height = rect.height || container.clientHeight || 600;

      canvas.width = width;
      canvas.height = height;

      // Update CSS to match
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      canvas.style.backgroundColor = 'white';
    }

    // Set up responsive canvas that adapts to container size
    setupResponsiveCanvas(canvas, container) {
      if (!canvas || !container) return;

      // Remove existing resize observer
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }

      // Create new resize observer
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === container) {
            this.updateCanvasSize(canvas, container);
            // Redraw white background after resize
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
      });

      // Observe container for size changes
      this.resizeObserver.observe(container);

      // Also listen for window resize as fallback
      const handleWindowResize = () => {
        this.updateCanvasSize(canvas, container);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };

      window.addEventListener('resize', handleWindowResize);
      canvas._windowResizeHandler = handleWindowResize;
    }

    // Switch to fullscreen mode
    enterFullscreen() {
      if (!this.canvas) {
        this.canvas = this.createCanvas();
      }

      // Save original state
      this.originalState = {
        parent: this.canvas.parentElement,
        position: this.canvas.style.position,
        top: this.canvas.style.top,
        left: this.canvas.style.left,
        width: this.canvas.style.width,
        height: this.canvas.style.height,
        zIndex: this.canvas.style.zIndex
      };

      // Move to body and make fullscreen
      document.body.appendChild(this.canvas);
      
      // Set fullscreen styles
      this.canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 99999;
        background-color: white;
        border: none;
        display: block;
        opacity: 1;
        pointer-events: auto;
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      `;

      // Set canvas dimensions to window size
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;

      // Clear with white background
      const ctx = this.canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Hide UI elements
      this.hideUIElements();

      this.isFullscreen = true;
      console.log('Canvas entered fullscreen mode');
    }

    // Exit fullscreen mode
    exitFullscreen() {
      if (!this.canvas || !this.originalState) return;

      // Show UI elements
      this.showUIElements();

      // Find appropriate container
      const container = document.querySelector('.canvas-container') || 
                        document.querySelector('.main-content') ||
                        document.body;

      // Move canvas back to container
      container.appendChild(this.canvas);

      // Restore original styles
      this.canvas.style.position = 'relative';
      this.canvas.style.top = '';
      this.canvas.style.left = '';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.zIndex = '';
      this.canvas.style.backgroundColor = 'white';

      // Update size to match container
      this.updateCanvasSize(this.canvas, container);

      // Clear with white background
      const ctx = this.canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Clear original state
      this.originalState = null;
      this.isFullscreen = false;

      console.log('Canvas exited fullscreen mode');
    }

    // Hide UI elements during fullscreen
    hideUIElements() {
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
    }

    // Show UI elements after fullscreen
    showUIElements() {
      const hiddenElements = document.querySelectorAll('[data-hidden-by-canvas="true"]');
      hiddenElements.forEach(el => {
        el.style.display = '';
        el.removeAttribute('data-hidden-by-canvas');
      });
    }

    // Clear canvas content
    clear() {
      if (!this.canvas) return;
      
      const ctx = this.canvas.getContext('2d');
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Cleanup
    destroy() {
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }

      if (this.canvas && this.canvas._windowResizeHandler) {
        window.removeEventListener('resize', this.canvas._windowResizeHandler);
      }

      if (this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }

      if (window.whiteScreenCanvas === this.canvas) {
        delete window.whiteScreenCanvas;
      }

      this.canvas = null;
      this.originalState = null;
      this.isFullscreen = false;
    }

    // Get current canvas
    getCanvas() {
      return this.canvas;
    }

    // Check if canvas is in fullscreen mode
    isInFullscreen() {
      return this.isFullscreen;
    }
  }


  
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
    
    try {
      // Import and use SetCalibrateAction
      const { default: SetCalibrateAction } = await import('../../../components/collected-dataset-customized/Action/SetCalibrateAction.jsx');
      
      const setCalibrateAction = new SetCalibrateAction({
        canvasRef,
        toggleTopBar: (show) => {
          if (typeof onActionClick === 'function') {
            onActionClick('toggleTopBar', show);
          }
        },
        setIsCapturing,
        setProcessStatus,
        setCurrentDot,
        triggerCameraAccess,
        onStatusUpdate: (status) => {
          if (status.processStatus) setProcessStatus(status.processStatus);
          if (status.isCapturing !== undefined) setIsCapturing(status.isCapturing);
        },
        saveImageToServer: true,
        setCaptureCounter,
        captureCounter: captureCount
      });
      
      await setCalibrateAction.handleSetCalibrate();
    } catch (error) {
      console.error("Calibration error:", error);
      setProcessStatus(`Calibration error: ${error.message}`);
      setIsCapturing(false);
    }
  };

  const handleSetRandom = async () => {
    if (isCapturing) return;
    
    try {
      // Import and use SetRandomAction
      const { default: SetRandomAction } = await import('../../../components/collected-dataset-customized/Action/SetRandomAction.jsx');
      
      const setRandomAction = new SetRandomAction({
        canvasRef,
        onStatusUpdate: (status) => {
          if (status.processStatus) setProcessStatus(status.processStatus);
          if (status.isCapturing !== undefined) setIsCapturing(status.isCapturing);
          if (status.remainingCaptures !== undefined) setRemainingCaptures(status.remainingCaptures);
        },
        setCaptureCounter,
        toggleTopBar: (show) => {
          if (typeof onActionClick === 'function') {
            onActionClick('toggleTopBar', show);
          }
        },
        captureCounter: captureCount,
        triggerCameraAccess
      });
      
      await setRandomAction.handleAction();
    } catch (error) {
      console.error("Random sequence error:", error);
      setProcessStatus(`Random sequence failed: ${error.message}`);
      setIsCapturing(false);
    }
  };

  const handleRandomDot = async () => {
    if (isCapturing) return;

    try {
      // Import and use RandomDotAction
      const { default: RandomDotAction } = await import('../../../components/collected-dataset-customized/Action/RandomDotAction.jsx');
      
      const randomDotAction = new RandomDotAction({
        canvasRef,
        toggleTopBar: (show) => {
          if (typeof onActionClick === 'function') {
            onActionClick('toggleTopBar', show);
          }
        },
        setIsCapturing,
        setProcessStatus,
        setCurrentDot,
        triggerCameraAccess,
        onStatusUpdate: (status) => {
          if (status.processStatus) setProcessStatus(status.processStatus);
          if (status.isCapturing !== undefined) setIsCapturing(status.isCapturing);
        },
        saveImageToServer: true,
        setCaptureCounter,
        captureCounter: captureCount
      });
      
      await randomDotAction.handleRandomDot();
    } catch (error) {
      console.error('Random dot error:', error);
      setProcessStatus(`Error: ${error.message}`);
      setIsCapturing(false);
    }
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

  // Camera permission handlers
  const handlePermissionAccepted = () => {
    setShowPermissionPopup(false);
    if (triggerCameraAccess) {
      triggerCameraAccess(true);
    }
  };

  const handlePermissionDenied = () => {
    setShowPermissionPopup(false);
    setProcessStatus('Camera access denied');
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