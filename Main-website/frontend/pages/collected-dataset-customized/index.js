import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import TopBar from './components-gui/topBar';
import DisplayResponse from './components-gui/displayResponse';
import { showCapturePreview, drawRedDot, getRandomPosition, createCountdownElement, runCountdown } from '../../components/collected-dataset-customized/Action/countSave.jsx';
import { captureImagesAtPoint } from '../../components/collected-dataset-customized/Helper/savefile';
import { generateCalibrationPoints } from '../../components/collected-dataset-customized/Action/CalibratePoints.jsx';
import { useConsent } from '../../components/consent_ui/ConsentContext';
import { useRouter } from 'next/router';
import { useAdminSettings } from './components-gui/adminSettings';

// Dynamically import the camera component with SSR disabled
const DynamicCameraAccess = dynamic(
  () => import('./components-gui/cameraAccess'),
  { 
    ssr: false,
    loading: () => (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '480px',
        height: '360px',
        backgroundColor: '#f0f8ff',
        border: '2px solid #0066cc',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        zIndex: 999
      }}>
        <div style={{ fontSize: '48px', marginBottom: '15px' }}>📷</div>
        <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#0066cc' }}>
          Loading camera...
        </p>
      </div>
    )
  }
);

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

// Global Canvas Manager - Single source of truth for canvas operations
class GlobalCanvasManager {
  constructor() {
    this.canvas = null;
    this.originalState = null;
    this.resizeObserver = null;
    this.isFullscreen = false;
    this.isInitialized = false;
  }

  // Get or create the single main canvas
  getCanvas() {
    // Always try to find existing canvas first
    let canvas = document.querySelector('#tracking-canvas');
    
    if (canvas) {
      // If we found an existing canvas, use it
      this.canvas = canvas;
      return canvas;
    }
    
    // Only create new canvas if none exists
    if (!this.canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'tracking-canvas';
      canvas.id = 'tracking-canvas';
      this.canvas = canvas;
    }
    
    return this.canvas;
  }

  // Initialize the main canvas
  initializeCanvas(container = null) {
    // Remove any existing canvases first to prevent duplicates
    const existingCanvases = document.querySelectorAll('#tracking-canvas');
    existingCanvases.forEach((existingCanvas, index) => {
      if (index > 0) { // Keep only the first one
        if (existingCanvas.parentNode) {
          existingCanvas.parentNode.removeChild(existingCanvas);
        }
      }
    });
    
    const canvas = this.getCanvas();
    if (!canvas) return null;
    
    // Determine container
    const targetContainer = container || 
                           document.querySelector('.canvas-container') || 
                           document.querySelector('.main-content') ||
                           document.body;

    // Set initial dimensions based on current window size
    this.updateCanvasSize(canvas, targetContainer);
    
    // Initialize with yellow background
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'yellow';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Also set CSS background color for consistency
    canvas.style.backgroundColor = 'yellow';

    // Add to container if not already there
    if (!canvas.parentNode) {
      targetContainer.appendChild(canvas);
    }

    // Store global reference
    window.whiteScreenCanvas = canvas;
    window.globalCanvasManager = this;

    // Set up responsive behavior
    this.setupResponsiveCanvas(canvas, targetContainer);

    this.isInitialized = true;
    return canvas;
  }

  // Update canvas size to match container and window size
  updateCanvasSize(canvas, container) {
    if (!canvas || !container) return;

    // Get current window dimensions
    const windowWidth = window.innerWidth || 800;
    const windowHeight = window.innerHeight || 600;
    
    // Get container dimensions
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width || container.clientWidth || windowWidth;
    const containerHeight = rect.height || container.clientHeight || windowHeight;

    // Set canvas size to match container and window
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Update CSS to match viewport units for fullscreen effect
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.display = 'block';
    canvas.style.backgroundColor = 'yellow';
    canvas.style.zIndex = '1';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.margin = '0';
    canvas.style.padding = '0';
    canvas.style.overflow = 'hidden';
    
    // Remove any other canvases to prevent overlapping
    this.linkWithOtherCanvases(canvas);
  }

  // Link this canvas with other canvases
  linkWithOtherCanvases(canvas) {
    // Find all other canvases on the page
    const allCanvases = document.querySelectorAll('canvas');
    
    allCanvases.forEach(otherCanvas => {
      if (otherCanvas !== canvas && otherCanvas.id !== 'tracking-canvas') {
        // Remove other canvases to prevent overlapping
        if (otherCanvas.parentNode) {
          otherCanvas.parentNode.removeChild(otherCanvas);
        }
      }
    });
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
          // Redraw yellow background after resize
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = 'yellow';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Remove any duplicate canvases that might have been created
          this.linkWithOtherCanvases(canvas);
        }
      }
    });

    // Observe container for size changes
    this.resizeObserver.observe(container);

    // Also listen for window resize as fallback
    const handleWindowResize = () => {
      this.updateCanvasSize(canvas, container);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'yellow';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Remove any duplicate canvases that might have been created
      this.linkWithOtherCanvases(canvas);
    };

    window.addEventListener('resize', handleWindowResize);
    canvas._windowResizeHandler = handleWindowResize;
  }

  // Switch to fullscreen mode
  enterFullscreen() {
    const canvas = this.getCanvas();
    if (!canvas) return null;

    // Save original state
    this.originalState = {
      parent: canvas.parentElement,
      position: canvas.style.position,
      top: canvas.style.top,
      left: canvas.style.left,
      width: canvas.style.width,
      height: canvas.style.height,
      zIndex: canvas.style.zIndex
    };

    // Remove canvas from current parent
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }

    // Move to body and make fullscreen
    document.body.appendChild(canvas);
    
    // Set fullscreen styles
    canvas.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 15;
      background-color: yellow !important;
      border: none !important;
      display: block !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      transform: none !important;
    `;

    // Set canvas dimensions to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Clear with yellow background
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'yellow';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Hide UI elements
    this.hideUIElements();

    this.isFullscreen = true;
    return canvas;
  }

  // Exit fullscreen mode
  exitFullscreen() {
    const canvas = this.getCanvas();
    if (!canvas || !this.originalState) return null;

    // Show UI elements
    this.showUIElements();

    // Find appropriate container
    const container = document.querySelector('.canvas-container') || 
                      document.querySelector('.main-content') ||
                      document.body;

    // Move canvas back to container
    container.appendChild(canvas);

    // Restore original styles
    canvas.style.position = 'relative';
    canvas.style.top = '';
    canvas.style.left = '';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '';
    canvas.style.backgroundColor = 'yellow';

    // Update size to match container
    this.updateCanvasSize(canvas, container);

    // Clear with yellow background
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'yellow';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear original state
    this.originalState = null;
    this.isFullscreen = false;

    return canvas;
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
      
              // Ensure TopBar has proper z-index
        if (el.classList.contains('topbar')) {
          el.style.zIndex = '12';
          el.style.position = 'relative';
        }
    });
    
            // Also ensure any other UI elements have proper z-index
        const topbar = document.querySelector('.topbar');
        if (topbar) {
          topbar.style.zIndex = '12';
          topbar.style.position = 'relative';
        }
  }

  // Clear canvas content
  clear() {
    const canvas = this.getCanvas();
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'yellow';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw dot at position
  drawDot(x, y, radius = 12) {
    const canvas = this.getCanvas();
    if (!canvas) return false;
    
    const ctx = canvas.getContext('2d');
    drawRedDot(ctx, x, y, radius, false);
    return true;
  }

  // Get canvas dimensions
  getDimensions() {
    const canvas = this.getCanvas();
    if (!canvas) return { width: 0, height: 0 };
    
    return {
      width: canvas.width,
      height: canvas.height
    };
  }

  // Check if canvas is in fullscreen mode
  isInFullscreen() {
    return this.isFullscreen;
  }

  // Cleanup
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.canvas && this.canvas._windowResizeHandler) {
      window.removeEventListener('resize', this.canvas._windowResizeHandler);
    }

    // Remove ALL canvases from DOM to prevent duplicates
    const allCanvases = document.querySelectorAll('canvas');
    allCanvases.forEach(canvas => {
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    });

    this.canvas = null;
    this.originalState = null;
    this.isFullscreen = false;
    this.isInitialized = false;
  }
}

// Main component that combines all functionality
const MainComponent = forwardRef(({ triggerCameraAccess, isCompactMode, onActionClick }, ref) => {
  const router = useRouter();
  const { userId: consentUserId } = useConsent();
  const { settings, updateSettings } = useAdminSettings(ref);
  
  // State management
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [showTopBar, setShowTopBar] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [outputText, setOutputText] = useState('');
  const [showMetrics, setShowMetrics] = useState(true);
  const [showPermissionPopup, setShowPermissionPopup] = useState(false);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showCameraPlaceholder, setShowCameraPlaceholder] = useState(false);
  const [showHeadPose, setShowHeadPose] = useState(false);
  const [showBoundingBox, setShowBoundingBox] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [showParameters, setShowParameters] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0, percentage: 100 });
  const [metrics, setMetrics] = useState({ width: '---', height: '---', distance: '---' });
  const [captureCounter, setCaptureCounter] = useState(1);
  const [captureFolder, setCaptureFolder] = useState('');
  const [currentUserId, setCurrentUserId] = useState('default');
  const [showSettings, setShowSettings] = useState(false);
  const [isPageActive, setIsPageActive] = useState(true);
  const [captureCount, setCaptureCount] = useState(1);
  
  // Camera state management
  const [isCameraActivated, setIsCameraActivated] = useState(false);
  const [showCameraNotification, setShowCameraNotification] = useState(false);
  const [cameraNotificationMessage, setCameraNotificationMessage] = useState('');
  
  // Button action states
  const [randomTimes, setRandomTimes] = useState(1);
  const [delaySeconds, setDelaySeconds] = useState(3);
  const [processStatus, setProcessStatus] = useState('');
  const [countdownValue, setCountdownValue] = useState(null);
  const [currentDot, setCurrentDot] = useState(null);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const [remainingCaptures, setRemainingCaptures] = useState(0);
  const [showCanvas, setShowCanvas] = useState(true);
  const [calibrationHandler, setCalibrationHandler] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Refs
  const previewAreaRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const actionButtonGroupRef = useRef(null);

  // Add cache for settings
  const settingsCache = useRef(new Map());
  const lastSettingsUpdate = useRef(new Map());
  
  // Camera state management functions
  const checkCameraActivation = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    // Always return false on page refresh/load to deactivate camera
    // Clear any existing camera activation data
    localStorage.removeItem('cameraActivated');
    localStorage.removeItem('cameraActivationTime');
    return false;
  }, []);

  const setCameraActivation = useCallback((activated) => {
    if (typeof window === 'undefined') return;
    
    if (activated) {
      // Don't persist camera activation to localStorage
      // This ensures camera deactivates on page refresh
      setIsCameraActivated(true);
      setShowCameraNotification(false);
      setCameraNotificationMessage('');
    } else {
      // Clear any existing activation data
      localStorage.removeItem('cameraActivated');
      localStorage.removeItem('cameraActivationTime');
      setIsCameraActivated(false);
    }
  }, []);

  const restoreCameraState = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    // Always deactivate camera on page load/refresh
    setIsCameraActivated(false);
    setIsCameraActive(false);
    setShowCamera(false);
    
    // Clear any existing camera activation data
    localStorage.removeItem('cameraActivated');
    localStorage.removeItem('cameraActivationTime');
  }, []);

  const showCameraRequiredNotification = useCallback((actionName) => {
    setCameraNotificationMessage(`Please activate camera first by clicking "Show Preview" button to use ${actionName} functionality.`);
    setShowCameraNotification(true);
    
    // Auto-hide notification after 5 seconds
    setTimeout(() => {
      setShowCameraNotification(false);
      setCameraNotificationMessage('');
    }, 5000);
  }, []);

  // Function to clear camera activation (for admin purposes)
  const clearCameraActivation = useCallback(() => {
    setCameraActivation(false);
    setIsCameraActive(false);
    setShowCamera(false);
    setProcessStatus('Camera activation cleared');
    // Clear any existing activation data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cameraActivated');
      localStorage.removeItem('cameraActivationTime');
    }
  }, [setCameraActivation]);

  // Function to fetch settings directly from MongoDB
  const fetchSettingsFromMongoDB = useCallback(async (userId) => {
    if (!userId) return null;
    
    try {
      const response = await fetch(`/api/data-center/settings/${userId}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status}`);
      }
      
      const result = await response.json();
      const userSettings = result.data || {};
      
      // Extract the specific fields we need
      const timesSetRandom = Number(userSettings.times_set_random) || 1;
      const delaySetRandom = Number(userSettings.delay_set_random) || 3;
      
      // Update local state
      setRandomTimes(timesSetRandom);
      setDelaySeconds(delaySetRandom);
      
      // Update settings cache
      settingsCache.current.set(userId, userSettings);
      lastSettingsUpdate.current.set(userId, Date.now());
      
      // Update the settings in the admin settings hook
      if (settings && typeof updateSettings === 'function') {
        await updateSettings(userSettings, userId);
      }
      
      return userSettings;
    } catch (error) {
      console.error(`[fetchSettingsFromMongoDB] Error fetching settings for user ${userId}:`, error);
      return null;
    }
  }, [settings, updateSettings]);
  
  // Function to save settings to MongoDB
  const saveSettingsToMongoDB = useCallback(async (userId, newSettings) => {
    if (!userId) return false;
    
    try {
      const response = await fetch(`/api/data-center/settings/${userId}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
        },
        body: JSON.stringify(newSettings)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Update local cache
      settingsCache.current.set(userId, newSettings);
      lastSettingsUpdate.current.set(userId, Date.now());
      
      return true;
    } catch (error) {
      console.error(`[saveSettingsToMongoDB] Error saving settings for user ${userId}:`, error);
      return false;
    }
  }, []);
  
  // Debug function to test MongoDB integration
  const debugMongoDBIntegration = useCallback(async () => {
    if (!currentUserId) {
      return;
    }
    
    // Test fetching settings
    const fetchedSettings = await fetchSettingsFromMongoDB(currentUserId);
    
    // Test saving settings
    const testSettings = {
      times_set_random: randomTimes + 1,
      delay_set_random: delaySeconds + 1
    };
    const saveResult = await saveSettingsToMongoDB(currentUserId, testSettings);
    
    // Fetch again to verify
    const verifySettings = await fetchSettingsFromMongoDB(currentUserId);
  }, [currentUserId, randomTimes, delaySeconds, fetchSettingsFromMongoDB, saveSettingsToMongoDB]);

  // Global canvas manager instance - initialize only once
  const canvasManager = useMemo(() => {
    // Create a singleton canvas manager
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager;
    }
    
    const manager = new GlobalCanvasManager();
    
    // Store globally for other components to use
    if (typeof window !== 'undefined') {
      window.globalCanvasManager = manager;
    }
    
    return manager;
  }, []);

  // Utility function to easily manage canvas operations
  const canvasUtils = useMemo(() => ({
    // Get or create canvas
    getCanvas: () => canvasManager.getCanvas(),
    
    // Enter fullscreen mode
    enterFullscreen: () => {
      return canvasManager.enterFullscreen();
    },
    
    // Exit fullscreen mode
    exitFullscreen: () => {
      return canvasManager.exitFullscreen();
    },
    
    // Clear canvas
    clear: () => {
      canvasManager.clear();
    },
    
    // Draw dot at position
    drawDot: (x, y, radius = 12) => {
      return canvasManager.drawDot(x, y, radius);
    },
    
    // Get canvas dimensions
    getDimensions: () => {
      return canvasManager.getDimensions();
    },
    
    // Check if canvas is in fullscreen
    isFullscreen: () => canvasManager.isInFullscreen(),
    
    // Update canvas size to match container and window
    resizeToContainer: (container) => {
      const canvas = canvasManager.getCanvas();
      if (!canvas || !container) return false;
      
      // Get current window dimensions
      const windowWidth = window.innerWidth || 800;
      const windowHeight = window.innerHeight || 600;
      
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width || container.clientWidth || windowWidth;
      canvas.height = rect.height || container.clientHeight || windowHeight;
      
      // Clear and redraw yellow background
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'yellow';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update CSS to use viewport units for fullscreen effect
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.margin = '0';
      canvas.style.padding = '0';
      canvas.style.overflow = 'hidden';
      
      // Remove any duplicate canvases
      canvasManager.linkWithOtherCanvases(canvas);
      
      return true;
    },
    
    // Link with other canvases
    linkWithOtherCanvases: (canvas) => {
      canvasManager.linkWithOtherCanvases(canvas);
    },
    
    // Ensure only one canvas exists
    ensureSingleCanvas: () => {
      const allCanvases = document.querySelectorAll('canvas');
      let mainCanvas = null;
      
      allCanvases.forEach((canvas, index) => {
        if (index === 0) {
          mainCanvas = canvas;
          canvas.id = 'tracking-canvas';
          canvas.className = 'tracking-canvas';
        } else {
          // Remove duplicate canvases
          if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
          }
        }
      });
      
      return mainCanvas;
    }
  }), [canvasManager]);

  // Make canvas utilities globally available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.canvasUtils = canvasUtils;
      window.canvasManager = canvasManager;
      
      // Add a function to sync all canvases
      window.syncAllCanvases = () => {
        if (canvasManager) {
          const canvas = canvasManager.getCanvas();
          if (canvas) {
            canvasManager.linkWithOtherCanvases(canvas);
          }
        }
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.canvasUtils;
        delete window.canvasManager;
        delete window.syncAllCanvases;
      }
    };
  }, [canvasUtils, canvasManager]);

  // Set hydrated state after mount and fetch initial settings
  useEffect(() => {
    setIsHydrated(true);
    
    // Always deactivate camera on page load/refresh
    setIsCameraActivated(false);
    setIsCameraActive(false);
    setShowCamera(false);
    
    // Clear any existing camera activation data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cameraActivated');
      localStorage.removeItem('cameraActivationTime');
    }
    
    // Restore camera state (which will deactivate camera)
    restoreCameraState();
    
    // Ensure only one canvas exists and prevent scrolling
    if (typeof window !== 'undefined') {
      // Prevent page scrolling
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      // Remove any existing canvases to prevent duplicates
      const existingCanvases = document.querySelectorAll('canvas');
      existingCanvases.forEach((canvas, index) => {
        if (index > 0) { // Keep only the first canvas
          if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
          }
        }
      });
      
      // Reset the main canvas if it exists
      const mainCanvas = document.querySelector('#tracking-canvas');
      if (mainCanvas) {
        mainCanvas.width = window.innerWidth;
        mainCanvas.height = window.innerHeight;
        mainCanvas.style.width = '100vw';
        mainCanvas.style.height = '100vh';
        mainCanvas.style.backgroundColor = 'yellow';
        mainCanvas.style.position = 'fixed';
        mainCanvas.style.top = '0';
        mainCanvas.style.left = '0';
        mainCanvas.style.margin = '0';
        mainCanvas.style.padding = '0';
        mainCanvas.style.overflow = 'hidden';
      }
    }
    
    // Fetch initial settings if we have a current user ID
    if (currentUserId && currentUserId !== 'default') {
      fetchSettingsFromMongoDB(currentUserId);
    }
    
    // Cleanup function to reset page state when navigating away
    return () => {
      // Reset any global styles or state that might affect other pages
      if (typeof window !== 'undefined') {
        // Remove any fixed positioning that might have been applied
        document.body.style.position = '';
        document.body.style.overflow = '';
        document.body.style.height = '';
        document.body.style.width = '';
        document.documentElement.style.overflow = '';
        
        // Remove all canvases
        const allCanvases = document.querySelectorAll('canvas');
        allCanvases.forEach(canvas => {
          if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
          }
        });
      }
    };
  }, [currentUserId, fetchSettingsFromMongoDB, checkCameraActivation, restoreCameraState]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Set page as inactive
        setIsPageActive(false);
        // Page is hidden, cleanup any resources
        cleanupPageStyles();
      } else {
        // Page is visible again, set as active
        setIsPageActive(true);
      }
    };

    const handleBeforeUnload = () => {
      // Set page as inactive
      setIsPageActive(false);
      // Cleanup when page is about to unload
      cleanupPageStyles();
      // Clear camera activation data on page unload
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cameraActivated');
        localStorage.removeItem('cameraActivationTime');
      }
    };

    const cleanupPageStyles = () => {
      if (typeof window !== 'undefined') {
        // Remove canvas completely from DOM
        const canvas = document.querySelector('#tracking-canvas');
        if (canvas && canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
        
        // Cleanup global canvas manager
        if (window.globalCanvasManager) {
          window.globalCanvasManager.destroy();
          delete window.globalCanvasManager;
        }
        
        // Cleanup canvas utilities
        if (window.canvasUtils) {
          delete window.canvasUtils;
        }
        
        // Reset any global styles that might have been applied
        document.body.style.position = '';
        document.body.style.overflow = '';
        document.body.style.height = '';
        document.body.style.width = '';
        document.body.style.margin = '';
        document.body.style.padding = '';
        document.documentElement.style.overflow = '';
        document.documentElement.style.position = '';
        document.documentElement.style.height = '';
        document.documentElement.style.width = '';
        
        // Remove any classes that might affect other pages
        document.body.classList.remove('collected-dataset-customized-page');
        document.documentElement.classList.remove('collected-dataset-customized-page');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Cleanup on unmount
      cleanupPageStyles();
    };
  }, []);

  // Handle router events for cleanup
  useEffect(() => {
    const handleRouteChangeStart = () => {
      // Set page as inactive
      setIsPageActive(false);
      
      // Cleanup when navigation starts
      if (typeof window !== 'undefined') {
        // Clear camera activation data when navigating away
        localStorage.removeItem('cameraActivated');
        localStorage.removeItem('cameraActivationTime');
        
        // Remove canvas completely from DOM
        const canvas = document.querySelector('#tracking-canvas');
        if (canvas && canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
        
        // Cleanup global canvas manager
        if (window.globalCanvasManager) {
          window.globalCanvasManager.destroy();
          delete window.globalCanvasManager;
        }
        
        // Cleanup canvas utilities
        if (window.canvasUtils) {
          delete window.canvasUtils;
        }
        
        // Reset any global styles that might have been applied
        document.body.style.position = '';
        document.body.style.overflow = '';
        document.body.style.height = '';
        document.body.style.width = '';
        document.body.style.margin = '';
        document.body.style.padding = '';
        document.documentElement.style.overflow = '';
        document.documentElement.style.position = '';
        document.documentElement.style.height = '';
        document.documentElement.style.width = '';
        
        // Remove any classes that might affect other pages
        document.body.classList.remove('collected-dataset-customized-page');
        document.documentElement.classList.remove('collected-dataset-customized-page');
      }
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
    };
  }, [router]);

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      if (!router.isReady) return;
      
      try {
        if (router.query.userData) {
          const parsedData = JSON.parse(router.query.userData);
          setUserData(parsedData);
          return;
        }

        if (router.query.userId) {
          const response = await fetch(`/api/user-preferences/${router.query.userId}`, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
            }
          });
          if (!response.ok) {
            throw new Error('Failed to fetch user data');
          }
          const data = await response.json();
          setUserData(data);
        }
      } catch (err) {
        console.error('Error loading user data:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [router.isReady, router.query]);

  // Check backend connection
  useEffect(() => {
    const checkBackendConnection = async () => {
      try {
        const response = await fetch('/api/check-backend-connection');
        const data = await response.json();
        setBackendStatus(data.connected ? 'connected' : 'disconnected');
      } catch (error) {
        console.error('Error checking backend connection:', error);
        setBackendStatus('disconnected');
      }
    };

    if (isHydrated) {
      checkBackendConnection();
    }
  }, [isHydrated]);

  // Update window size
  useEffect(() => {
    const updateDimensions = () => {
      if (previewAreaRef.current) {
        const width = previewAreaRef.current.offsetWidth;
        const height = previewAreaRef.current.offsetHeight;
        const screenPercentage = (window.innerWidth / window.screen.width) * 100;
        
        setMetrics(prev => ({ ...prev, width, height }));
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
          percentage: Math.round(screenPercentage)
        });
        
        // Update canvas size when window size changes
        if (canvasManager && isPageActive) {
          const canvas = canvasManager.getCanvas();
          if (canvas) {
            canvasManager.updateCanvasSize(canvas, previewAreaRef.current);
          }
        }
      }
    };

    if (isHydrated) {
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [isHydrated, canvasManager, isPageActive]);

  // Initialize canvas on component mount
  useEffect(() => {
    // Only initialize canvas if page is active
    if (!isPageActive) return;
    
    // Remove any existing canvases first to prevent duplicates
    if (typeof window !== 'undefined') {
      const existingCanvases = document.querySelectorAll('canvas');
      existingCanvases.forEach(canvas => {
        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
      });
    }
    
    // Initialize the global canvas manager
    const canvas = canvasManager.initializeCanvas();
    
    // Ensure canvas has yellow background
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'yellow';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Remove any duplicate canvases after initialization
      setTimeout(() => {
        canvasManager.linkWithOtherCanvases(canvas);
      }, 100);
    }
    
    return () => {
      // Cleanup canvas on component unmount
      if (typeof window !== 'undefined') {
        // Remove ALL canvases from DOM to prevent duplicates
        const allCanvases = document.querySelectorAll('canvas');
        allCanvases.forEach(canvas => {
          if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
          }
        });
        
        // Cleanup global canvas manager
        if (window.globalCanvasManager) {
          window.globalCanvasManager.destroy();
          delete window.globalCanvasManager;
        }
        
        // Cleanup canvas utilities
        if (window.canvasUtils) {
          delete window.canvasUtils;
        }
      }
    };
  }, [canvasManager, isPageActive]);

  // Optimize settings updates - properly handle MongoDB data
  useEffect(() => {
    if (settings && currentUserId && settings[currentUserId]) {
      const userSettings = settings[currentUserId];
      const cachedSettings = settingsCache.current.get(currentUserId);
      
      if (!isEqual(cachedSettings, userSettings)) {
        // Extract times_set_random and delay_set_random from MongoDB data
        const timesSetRandom = Number(userSettings.times_set_random) || 1;
        const delaySetRandom = Number(userSettings.delay_set_random) || 3;
        
        setRandomTimes(timesSetRandom);
        setDelaySeconds(delaySetRandom);
        settingsCache.current.set(currentUserId, userSettings);
        lastSettingsUpdate.current.set(currentUserId, Date.now());
        
        // Dispatch event to notify other components
        const event = new CustomEvent('settingsLoaded', {
          detail: {
            userId: currentUserId,
            times_set_random: timesSetRandom,
            delay_set_random: delaySetRandom,
            settings: userSettings
          }
        });
        window.dispatchEvent(event);
      }
    }
  }, [settings, currentUserId]);

  // Listen for user ID changes - properly handle MongoDB data
  useEffect(() => {
    const handleUserIdChange = (event) => {
      if (event.detail && event.detail.type === 'userIdChange') {
        const newUserId = event.detail.userId;
        setCurrentUserId(newUserId);
        
        // Fetch settings directly from MongoDB for the new user
        fetchSettingsFromMongoDB(newUserId);
        
        // Also check if we have cached settings
        if (settings && settings[newUserId]) {
          const userSettings = settings[newUserId];
          const timesSetRandom = Number(userSettings.times_set_random) || 1;
          const delaySetRandom = Number(userSettings.delay_set_random) || 3;
          
          setRandomTimes(timesSetRandom);
          setDelaySeconds(delaySetRandom);
          
          // Dispatch event to notify other components
          const event = new CustomEvent('userSettingsLoaded', {
            detail: {
              userId: newUserId,
              times_set_random: timesSetRandom,
              delay_set_random: delaySetRandom,
              settings: userSettings
            }
          });
          window.dispatchEvent(event);
        }
      }
    };
    window.addEventListener('userIdChange', handleUserIdChange);
    return () => {
      window.removeEventListener('userIdChange', handleUserIdChange);
    };
  }, [settings, fetchSettingsFromMongoDB]);

  // Listen for settings updates - properly handle MongoDB field names
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
          
          // Update the settings cache
          if (settings && settings[currentUserId]) {
            const updatedSettings = {
              ...settings[currentUserId],
              times_set_random: times_set_random !== undefined ? Number(times_set_random) : settings[currentUserId].times_set_random,
              delay_set_random: delay_set_random !== undefined ? Number(delay_set_random) : settings[currentUserId].delay_set_random
            };
            settingsCache.current.set(currentUserId, updatedSettings);
          }
        }
      }
    };
    window.addEventListener('captureSettingsUpdate', handleSettingsUpdate);
    return () => {
      window.removeEventListener('captureSettingsUpdate', handleSettingsUpdate);
    };
  }, [currentUserId, settings]);
  
  // Listen for TopBar settings loaded event
  useEffect(() => {
    const handleTopBarSettingsLoaded = (event) => {
      if (event.detail && event.detail.userId === currentUserId) {
        const { times_set_random, delay_set_random } = event.detail;
        console.log(`[TopBar Settings Loaded] User ${currentUserId}: times_set_random=${times_set_random}, delay_set_random=${delay_set_random}`);
        
        if (times_set_random !== undefined) {
          setRandomTimes(Number(times_set_random) || 1);
        }
        if (delay_set_random !== undefined) {
          setDelaySeconds(Number(delay_set_random) || 3);
        }
      }
    };
    window.addEventListener('topBarSettingsLoaded', handleTopBarSettingsLoaded);
    return () => {
      window.removeEventListener('topBarSettingsLoaded', handleTopBarSettingsLoaded);
    };
  }, [currentUserId]);

  // Make functions globally accessible
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.actionButtonFunctions = {
        handleRandomDot,
        handleSetRandom,
        handleSetCalibrate,
        handleClearAll
      };
      
      // Also make canvas manager globally accessible
      window.globalCanvasManager = canvasManager;
      window.canvasUtils = canvasUtils;
      
      // Make MongoDB settings functions globally accessible
      window.mongoDBSettings = {
        fetchSettings: fetchSettingsFromMongoDB,
        saveSettings: saveSettingsToMongoDB,
        debug: debugMongoDBIntegration,
        getCurrentSettings: () => ({
          times_set_random: randomTimes,
          delay_set_random: delaySeconds,
          currentUserId: currentUserId
        })
      };
      
      // Make camera state management globally accessible
      window.cameraStateManager = {
        isActivated: () => isCameraActivated,
        checkActivation: checkCameraActivation,
        setActivation: setCameraActivation,
        showNotification: showCameraRequiredNotification,
        clearActivation: clearCameraActivation
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.actionButtonFunctions;
        delete window.globalCanvasManager;
        delete window.canvasUtils;
        delete window.mongoDBSettings;
        delete window.cameraStateManager;
      }
    };
  }, [canvasManager, canvasUtils, fetchSettingsFromMongoDB, saveSettingsToMongoDB, debugMongoDBIntegration, randomTimes, delaySeconds, currentUserId, isCameraActivated, checkCameraActivation, setCameraActivation, showCameraRequiredNotification, clearCameraActivation]);

  // Make toggleTopBar function available globally
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.toggleTopBar = (show) => {
        console.log('🔍 Global toggleTopBar called with:', show, 'Current showTopBar state:', showTopBar);
        setShowTopBar(show);
        console.log('🔍 Global TopBar state set to:', show);
        // Also control metrics visibility
        if (!show) {
          setShowMetrics(false);
          console.log('🔍 Global Metrics hidden');
        } else {
          setShowMetrics(true);
          console.log('🔍 Global Metrics shown');
          // Show UI elements if they were hidden by canvas fullscreen
          if (typeof window !== 'undefined' && window.globalCanvasManager) {
            window.globalCanvasManager.showUIElements();
            console.log('🔍 Global UI elements restored after canvas fullscreen');
            
            // Debug canvas state
            const canvas = window.globalCanvasManager.getCanvas();
            if (canvas) {
              console.log('🔍 Global Canvas state after TopBar restore:', {
                position: canvas.style.position,
                width: canvas.style.width,
                height: canvas.style.height,
                zIndex: canvas.style.zIndex,
                isFullscreen: window.globalCanvasManager.isInFullscreen(),
                rect: canvas.getBoundingClientRect()
              });
              
              // Exit fullscreen mode if canvas is still in fullscreen
              if (window.globalCanvasManager.isInFullscreen()) {
                console.log('🔍 Global Canvas is still in fullscreen, exiting...');
                window.globalCanvasManager.exitFullscreen();
                console.log('🔍 Global Canvas fullscreen exited');
              }
            }
          }
        }
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.toggleTopBar;
      }
    };
  }, [showTopBar, setShowTopBar, setShowMetrics]);

  // Debug TopBar state changes
  useEffect(() => {
    console.log('🔍 MainComponent: showTopBar state changed to:', showTopBar);
  }, [showTopBar]);

  // Debug showMetrics state changes
  useEffect(() => {
    console.log('🔍 MainComponent: showMetrics state changed to:', showMetrics);
  }, [showMetrics]);

  // Action handlers
  const handleRandomDot = async () => {
    if (isCapturing) return;

    // Check if camera is activated - show notification and return early if not
    if (!isCameraActivated) {
      showCameraRequiredNotification('Random Dot');
      return;
    }

    try {
      // Import and use RandomDotAction
      const { default: RandomDotAction } = await import('../../components/collected-dataset-customized/Action/RandomDotAction.jsx');
      
      // Ensure canvas is available
      const canvas = canvasManager.getCanvas();
      if (!canvas) {
        throw new Error("Canvas not available");
      }
      
      const randomDotAction = new RandomDotAction({
        canvasRef: { current: canvas },
        toggleTopBar: (show) => {
          console.log('🔍 RandomDotAction: toggleTopBar called with:', show, 'Current showTopBar state:', showTopBar);
          setShowTopBar(show);
          console.log('🔍 RandomDotAction: TopBar state set to:', show);
          // Also control metrics visibility
          if (!show) {
            setShowMetrics(false);
            console.log('🔍 RandomDotAction: Metrics hidden');
          } else {
            setShowMetrics(true);
            console.log('🔍 RandomDotAction: Metrics shown');
            // Show UI elements if they were hidden by canvas fullscreen
            if (typeof window !== 'undefined' && window.globalCanvasManager) {
              window.globalCanvasManager.showUIElements();
              console.log('🔍 RandomDotAction: UI elements restored after canvas fullscreen');
            }
          }
        },
        setIsCapturing: (capturing) => {
          setIsCapturing(capturing);
          console.log('RandomDotAction: isCapturing set to', capturing);
        },
        setProcessStatus: (status) => {
          setProcessStatus(status);
          console.log('RandomDotAction: processStatus set to', status);
        },
        setCurrentDot: (dot) => {
          setCurrentDot(dot);
          console.log('RandomDotAction: currentDot set to', dot);
        },
        triggerCameraAccess,
        onStatusUpdate: (status) => {
          if (status.processStatus) setProcessStatus(status.processStatus);
          if (status.isCapturing !== undefined) setIsCapturing(status.isCapturing);
        },
        saveImageToServer: true,
        setCaptureCounter,
        captureCounter: captureCounter
      });
      
      await randomDotAction.handleRandomDot();
    } catch (error) {
      console.error('Random dot error:', error);
      setProcessStatus(`Error: ${error.message}`);
      setIsCapturing(false);
    }
  };

  const handleSetRandom = async () => {
    if (isCapturing) return;
    
    // Check if camera is activated - show notification and return early if not
    if (!isCameraActivated) {
      showCameraRequiredNotification('Set Random');
      return;
    }
    
    try {
      // Import and use SetRandomAction
      const { default: SetRandomAction } = await import('../../components/collected-dataset-customized/Action/SetRandomAction.jsx');
      
      // Ensure canvas is available
      const canvas = canvasManager.getCanvas();
      if (!canvas) {
        throw new Error("Canvas not available");
      }
      
      const setRandomAction = new SetRandomAction({
        canvasRef: { current: canvas },
        onStatusUpdate: (status) => {
          if (status.processStatus) setProcessStatus(status.processStatus);
          if (status.isCapturing !== undefined) setIsCapturing(status.isCapturing);
          if (status.remainingCaptures !== undefined) setRemainingCaptures(status.remainingCaptures);
        },
        setCaptureCounter,
        toggleTopBar: (show) => {
          console.log('🔍 SetRandomAction: toggleTopBar called with:', show, 'Current showTopBar state:', showTopBar);
          setShowTopBar(show);
          console.log('🔍 SetRandomAction: TopBar state set to:', show);
          // Also control metrics visibility
          if (!show) {
            setShowMetrics(false);
            console.log('🔍 SetRandomAction: Metrics hidden');
          } else {
            setShowMetrics(true);
            console.log('🔍 SetRandomAction: Metrics shown');
            // Show UI elements if they were hidden by canvas fullscreen
            if (typeof window !== 'undefined' && window.globalCanvasManager) {
              window.globalCanvasManager.showUIElements();
              console.log('🔍 SetRandomAction: UI elements restored after canvas fullscreen');
            }
          }
        },
        captureCounter: captureCounter,
        triggerCameraAccess,
        setIsCapturing: (capturing) => {
          setIsCapturing(capturing);
          console.log('SetRandomAction: isCapturing set to', capturing);
        },
        setProcessStatus: (status) => {
          setProcessStatus(status);
          console.log('SetRandomAction: processStatus set to', status);
        }
      });
      
      await setRandomAction.handleAction();
    } catch (error) {
      console.error("Random sequence error:", error);
      setProcessStatus(`Random sequence failed: ${error.message}`);
      setIsCapturing(false);
    }
  };

  const handleSetCalibrate = async () => {
    if (isCapturing) return;
    
    // Check if camera is activated - show notification and return early if not
    if (!isCameraActivated) {
      showCameraRequiredNotification('Set Calibrate');
      return;
    }
    
    try {
      // Ensure canvas is initialized first
      const canvas = canvasManager.getCanvas();
      if (!canvas) {
        throw new Error("Canvas not available");
      }
      
      // Import and use SetCalibrateAction
      const { default: SetCalibrateAction } = await import('../../components/collected-dataset-customized/Action/SetCalibrateAction.jsx');
      
      const setCalibrateAction = new SetCalibrateAction({
        canvasRef: { current: canvas },
        toggleTopBar: (show) => {
          console.log('🔍 SetCalibrateAction: toggleTopBar called with:', show, 'Current showTopBar state:', showTopBar);
          setShowTopBar(show);
          console.log('🔍 SetCalibrateAction: TopBar state set to:', show);
          // Also control metrics visibility
          if (!show) {
            setShowMetrics(false);
            console.log('🔍 SetCalibrateAction: Metrics hidden');
          } else {
            setShowMetrics(true);
            console.log('🔍 SetCalibrateAction: Metrics shown');
            // Show UI elements if they were hidden by canvas fullscreen
            if (typeof window !== 'undefined' && window.globalCanvasManager) {
              window.globalCanvasManager.showUIElements();
              console.log('🔍 SetCalibrateAction: UI elements restored after canvas fullscreen');
            }
          }
        },
        setIsCapturing: (capturing) => {
          setIsCapturing(capturing);
          console.log('SetCalibrateAction: isCapturing set to', capturing);
        },
        setProcessStatus: (status) => {
          setProcessStatus(status);
          console.log('SetCalibrateAction: processStatus set to', status);
        },
        setCurrentDot: (dot) => {
          setCurrentDot(dot);
          console.log('SetCalibrateAction: currentDot set to', dot);
        },
        triggerCameraAccess,
        onStatusUpdate: (status) => {
          if (status.processStatus) setProcessStatus(status.processStatus);
          if (status.isCapturing !== undefined) setIsCapturing(status.isCapturing);
        },
        saveImageToServer: true,
        setCaptureCounter,
        captureCounter: captureCounter
      });
      
      await setCalibrateAction.handleSetCalibrate();
    } catch (error) {
      console.error("Calibration error:", error);
      setProcessStatus(`Calibration error: ${error.message}`);
      setIsCapturing(false);
    }
  };

  const handleClearAll = () => {
    // Clear canvas content
    canvasManager.clear();
    
    // Reset states
    setProcessStatus('');
    setRemainingCaptures(0);
    setIsCapturing(false);
    setCountdownValue(null);
    setShowCanvas(true);
    setCurrentDot(null);
    
    console.log('Clear All: Reset all states');
  };

  // Toggle functions
  const handleToggleHeadPose = useCallback(() => {
    const newHeadPoseState = !showHeadPose;
    setShowHeadPose(newHeadPoseState);
    setProcessStatus(`Head pose visualization ${newHeadPoseState ? 'enabled' : 'disabled'}`);
    
    if (onActionClick) {
      onActionClick('headPose');
    }
    
    if (typeof window !== 'undefined' && window.videoProcessor) {
      window.videoProcessor.updateOptions({
        showHeadPose: newHeadPoseState
      });
    }
  }, [showHeadPose, onActionClick]);

  const handleToggleBoundingBox = useCallback(() => {
    const newBoundingBoxState = !showBoundingBox;
    setShowBoundingBox(newBoundingBoxState);
    setProcessStatus(`Bounding box ${newBoundingBoxState ? 'shown' : 'hidden'}`);
    
    if (onActionClick) {
      onActionClick('boundingBox');
    }
    
    if (typeof window !== 'undefined' && window.videoProcessor) {
      window.videoProcessor.updateOptions({
        showBoundingBox: newBoundingBoxState
      });
    }
  }, [showBoundingBox, onActionClick]);

  const handleToggleMask = useCallback(() => {
    const newMaskState = !showMask;
    setShowMask(newMaskState);
    setProcessStatus(`Mask ${newMaskState ? 'shown' : 'hidden'}`);
    
    if (onActionClick) {
      onActionClick('mask');
    }
    
    if (typeof window !== 'undefined' && window.videoProcessor) {
      window.videoProcessor.updateOptions({
        showMask: newMaskState
      });
    }
  }, [showMask, onActionClick]);

  const handleToggleParameters = useCallback(() => {
    const newParametersState = !showParameters;
    setShowParameters(newParametersState);
    setProcessStatus(`Parameters ${newParametersState ? 'shown' : 'hidden'}`);
    
    if (onActionClick) {
      onActionClick('parameters');
    }
    
    if (typeof window !== 'undefined' && window.videoProcessor) {
      window.videoProcessor.updateOptions({
        showParameters: newParametersState
      });
    }
  }, [showParameters, onActionClick]);

  const handleToggleCamera = useCallback(() => {
    const newCameraState = !isCameraActive;
    console.log(`[Camera Toggle] Switching camera from ${isCameraActive} to ${newCameraState}`);
    
    setIsCameraActive(newCameraState);
    setShowCamera(newCameraState); // Link the camera display state with the active state
    
    if (newCameraState) {
      setProcessStatus('Starting camera preview...');
      // Set camera activation when camera is started
      setCameraActivation(true);
      // Add a small delay to ensure the component is ready
      setTimeout(() => {
        setProcessStatus('Camera preview active');
      }, 500);
    } else {
      setProcessStatus('Camera preview stopped');
      // Don't deactivate camera state when stopping preview
      // This allows buttons to continue working
    }
    
    if (onActionClick) {
      onActionClick('preview', newCameraState);
    } else {
      setShowPermissionPopup(true);
    }
    
    if (newCameraState && typeof window !== 'undefined' && window.videoProcessor) {
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
  }, [isCameraActive, showCamera, onActionClick, showHeadPose, showBoundingBox, showMask, showParameters, setCameraActivation]);

  // Add a proper action handler for camera preview
  const handleActionClick = useCallback((actionType, ...args) => {
    switch (actionType) {
      case 'preview':
        const shouldShow = args[0] !== undefined ? args[0] : !showCamera;
        console.log(`[Action Handler] Preview action: shouldShow=${shouldShow}, current showCamera=${showCamera}`);
        setShowCamera(shouldShow);
        setIsCameraActive(shouldShow);
        
        if (shouldShow) {
          setProcessStatus('Camera preview started');
          // Set camera activation when camera is started
          setCameraActivation(true);
          // Clear any existing warnings when camera is activated
          setShowWarning(false);
          setWarningMessage('');
        } else {
          setProcessStatus('Camera preview stopped');
        }
        break;
      case 'headPose':
        handleToggleHeadPose();
        break;
      case 'boundingBox':
        handleToggleBoundingBox();
        break;
      case 'mask':
        handleToggleMask();
        break;
      case 'parameters':
        handleToggleParameters();
        break;
      case 'metrics':
        console.log('🔍 Metrics toggle clicked, current state:', showMetrics);
        const newMetricsState = !showMetrics;
        setShowMetrics(newMetricsState);
        setProcessStatus(`Metrics ${newMetricsState ? 'shown' : 'hidden'}`);
        console.log('🔍 Metrics state set to:', newMetricsState);
        break;
      case 'randomDot':
        console.log('Random Dot button clicked');
        handleRandomDot();
        break;
      case 'setRandom':
        console.log('Set Random button clicked');
        handleSetRandom();
        break;
      case 'calibrate':
        console.log('Set Calibrate button clicked');
        handleSetCalibrate();
        break;
      case 'clearAll':
        console.log('Clear All button clicked');
        handleClearAll();
        break;
      case 'toggleTopBar':
        const show = args[0] !== undefined ? args[0] : !showTopBar;
        setShowTopBar(show);
        break;
      default:
        console.log('Unknown action type:', actionType);
        // Silent handling for unknown actions
        break;
    }
  }, [showCamera, showMetrics, showTopBar, handleToggleHeadPose, handleToggleBoundingBox, handleToggleMask, handleToggleParameters, handleRandomDot, handleSetRandom, handleSetCalibrate, handleClearAll, setCameraActivation]);

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

  // Handle camera close
  const handleCameraClose = useCallback(() => {
    setShowCamera(false);
    setIsCameraActive(false);
    setProcessStatus('Camera preview stopped');
    // Don't clear camera activation when closing camera
    // This allows buttons to continue working
  }, []);

  // Handle camera ready
  const handleCameraReady = useCallback((dimensions) => {
    setMetrics({
      width: dimensions.width,
      height: dimensions.height,
      distance: dimensions.distance || '---'
    });
    setOutputText(`Camera ready: ${dimensions.width}x${dimensions.height}`);
    setProcessStatus('Camera preview active');
  }, []);

  // Add back button handler
  const handleGoBack = () => {
    router.push('/');
  };

  // Dynamic class to reflect current window size
  const getSizeClass = () => {
    const { percentage } = windowSize;
    if (percentage < 35) return 'window-size-tiny';
    if (percentage < 50) return 'window-size-small';
    if (percentage < 70) return 'window-size-medium';
    return 'window-size-large';
  };

  // Expose functions via ref
  useImperativeHandle(ref, () => ({
    handleRandomDot,
    handleSetRandom,
    handleSetCalibrate,
    handleClearAll,
    handleToggleHeadPose,
    handleToggleBoundingBox,
    handleToggleMask,
    handleToggleParameters,
    handleToggleCamera
  }));

  return (
    <div className={`main-container collected-dataset-customized-page ${getSizeClass()}`} style={{
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'fixed',
      top: 0,
      left: 0,
      margin: 0,
      padding: 0,
      backgroundColor: 'transparent'
    }}>
      <Head>
        <title>Camera Dataset Collection</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style jsx>{`
          .collected-dataset-customized-page {
            height: 100vh;
            width: 100vw;
            overflow: hidden;
            position: fixed;
            top: 0;
            left: 0;
            margin: 0;
            padding: 0;
            z-index: 1;
            background-color: transparent;
          }
        `}</style>
      </Head>
      
      {/* Backend connection status banner */}
      {isHydrated && backendStatus === 'disconnected' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          padding: '6px 0',
          backgroundColor: '#ffe0b2',
          color: '#e65100',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          zIndex: 110
        }}>
          ⚠️ Backend disconnected. Hurry up, Make ONLINE please and Using mock mode
        </div>
      )}
      
      {/* Warning message banner */}
      {isHydrated && showWarning && (
        <div className="warning-banner" style={{
          position: 'fixed',
          top: showTopBar ? (backendStatus === 'disconnected' ? '32px' : '60px') : '0',
          left: '0',
          width: '100%',
          backgroundColor: '#ffeb3b',
          color: '#333',
          padding: '10px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 11,
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          <strong>⚠️ {warningMessage}</strong>
        </div>
      )}

      {/* Camera activation notification */}
      {isHydrated && showCameraNotification && (
        <div className="camera-notification-banner" style={{
          position: 'fixed',
          top: showTopBar ? (backendStatus === 'disconnected' ? '32px' : '60px') : '0',
          left: '0',
          width: '100%',
          backgroundColor: '#ff6b6b',
          color: 'white',
          padding: '12px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          zIndex: 102,
          animation: 'fadeIn 0.3s ease-in-out',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          <strong>📷 {cameraNotificationMessage}</strong>
        </div>
      )}

      {isLoading ? (
        <div className="loading-container">
          <p>Loading user settings...</p>
        </div>
      ) : (
        <>
          {/* TopBar component */}
          {showTopBar && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 12,
              height: '120px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderBottom: 'none'
            }}>
              <TopBar 
                key={`topbar-${showTopBar}-${showMetrics}`}
                onButtonClick={handleActionClick}
                onCameraAccess={() => setShowPermissionPopup(true)}
                outputText={statusMessage || outputText}
                onOutputChange={(text) => setOutputText(text)}
                onToggleTopBar={(show) => {
                  console.log('🔍 TopBar toggle called with:', show, 'Current showTopBar state:', showTopBar);
                  setShowTopBar(show);
                  console.log('🔍 TopBar state set to:', show);
                  // Also control metrics visibility
                  if (!show) {
                    setShowMetrics(false);
                    console.log('🔍 Metrics hidden');
                  } else {
                    setShowMetrics(true);
                    console.log('🔍 Metrics shown');
                    // Show UI elements if they were hidden by canvas fullscreen
                    if (typeof window !== 'undefined' && window.globalCanvasManager) {
                      window.globalCanvasManager.showUIElements();
                      console.log('🔍 UI elements restored after canvas fullscreen');
                      
                      // Debug canvas state
                      const canvas = window.globalCanvasManager.getCanvas();
                      if (canvas) {
                        console.log('🔍 Canvas state after TopBar restore:', {
                          position: canvas.style.position,
                          width: canvas.style.width,
                          height: canvas.style.height,
                          zIndex: canvas.style.zIndex,
                          isFullscreen: window.globalCanvasManager.isInFullscreen(),
                          rect: canvas.getBoundingClientRect()
                        });
                        
                        // Exit fullscreen mode if canvas is still in fullscreen
                        if (window.globalCanvasManager.isInFullscreen()) {
                          console.log('🔍 Canvas is still in fullscreen, exiting...');
                          window.globalCanvasManager.exitFullscreen();
                          console.log('🔍 Canvas fullscreen exited');
                        }
                      }
                    }
                  }
                }}
                onToggleMetrics={() => setShowMetrics(!showMetrics)}
                canvasRef={{ current: canvasManager.getCanvas() }}
                showMetrics={showMetrics}
                isTopBarShown={showTopBar}
                isCanvasVisible={showCanvas}
                isCameraActive={isCameraActive}
                isCameraActivated={isCameraActivated}
              />
            </div>
          )}
          


          {/* Show restore button when TopBar is hidden */}
          {!showTopBar && (
            <div className="restore-button-container" style={{
              position: 'fixed',
              top: '10px',
              right: '10px',
              zIndex: 1000
            }}>
              <button 
                className="restore-btn"
                onClick={() => setShowTopBar(true)}
                title="Show TopBar and Metrics"
                style={{
                  padding: '5px 10px',
                  background: '#0066cc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                ≡
              </button>
            </div>
          )}

          {/* Main preview area */}
          <div 
            ref={previewAreaRef}
            className="camera-preview-area"
            style={{ 
              height: showTopBar ? 'calc(100vh - 120px)' : '100vh',
              marginTop: backendStatus === 'disconnected' ? '32px' : '0',
              paddingTop: showCameraNotification ? '44px' : '0',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'transparent',
              overflow: 'hidden',
              zIndex: 1
            }}
          >
            {!showCamera ? (
              <>
                {/* Camera placeholder square - only show if needed */}
                {isHydrated && showCameraPlaceholder && (
                  <div 
                    className="camera-placeholder-square"
                    style={{
                      width: '180px',
                      height: '135px',
                      margin: '20px auto',
                      border: '2px dashed #666',
                      borderRadius: '4px',
                      backgroundColor: '#f5f5f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 5
                    }}
                  >
                    <div style={{ fontSize: '1.5rem' }}>📷</div>
                  </div>
                )}
                
                {/* Canvas container - managed by GlobalCanvasManager */}
                <div 
                  className="canvas-container" 
                  style={{ 
                    height: '100vh',
                    width: '100vw',
                    overflow: 'hidden',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    margin: 0,
                    padding: 0,
                    border: 'none',
                    zIndex: 1,
                    pointerEvents: 'auto'
                  }}
                >
                  {/* The canvas will be dynamically created and managed by GlobalCanvasManager */}
                </div>
              </>
            ) : null}
            
            {/* Camera component */}
            {isHydrated && typeof window !== 'undefined' && showCamera && (
              <DynamicCameraAccess
                key={`camera-${showCamera}-${showHeadPose}-${showBoundingBox}-${showMask}-${showParameters}`}
                isShowing={showCamera} 
                onClose={handleCameraClose}
                onCameraReady={handleCameraReady}
                showHeadPose={showHeadPose}
                showBoundingBox={showBoundingBox}
                showMask={showMask}
                showParameters={showParameters}
                videoRef={videoRef}
              />
            )}
            
            {/* Camera permission popup */}
            {isHydrated && typeof window !== 'undefined' && showPermissionPopup && (
              <div className="camera-permission-popup" style={{
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
              }}>
                <div className="camera-permission-dialog" style={{
                  width: '400px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
                }}>
                  <h3 className="camera-permission-title" style={{
                    margin: '0 0 15px',
                    fontSize: '18px',
                    fontWeight: 'bold'
                  }}>Camera Access Required</h3>
                  <p className="camera-permission-message" style={{
                    margin: '0 0 20px',
                    fontSize: '14px',
                    lineHeight: '1.4'
                  }}>
                    This application needs access to your camera to function properly. 
                    When prompted by your browser, please click "Allow" to grant camera access.
                  </p>
                  <div className="camera-permission-buttons" style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px'
                  }}>
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
          
          {/* Metrics info - moved outside preview area to avoid stacking context issues */}
          {isHydrated && (
            <DisplayResponse 
              key={`metrics-${showMetrics}`}
              width={canvasManager.getDimensions().width} 
              height={canvasManager.getDimensions().height} 
              distance={metrics.distance}
              isVisible={showMetrics}
            />
          )}
          {console.log('🔍 Rendering DisplayResponse, showMetrics:', showMetrics, 'isHydrated:', isHydrated)}
        </>
      )}
    </div>
  );
});

// Create a client-only version of MainComponent
const MainComponentClient = dynamic(() => Promise.resolve(MainComponent), { ssr: false });

// Export the main component
export default function MainPage() {
  return <MainComponentClient />;
}

export { ActionButton, MainComponent }; 