import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import TopBar from './components-gui/topBar';
import DisplayResponse from './components-gui/displayResponse.jsx';
import NotificationMessage from './components-gui/noti_message';
import CameraSelect from './components-gui/cameraSelect';
import cameraStyles from './styles/camera-ui.module.css';
import { useCanvasImage, useCanvasImageWithOverlay, ImageOverlay } from './components-gui/CanvasImage';
import { showCapturePreview, drawRedDot, getRandomPosition, createCountdownElement, runCountdown } from '../../components/collected-dataset-customized/Action/countSave.jsx';
import { captureImagesAtUserPoint } from '../../components/collected-dataset-customized/Helper/user_savefile';
import { generateCalibrationPoints } from '../../components/collected-dataset-customized/Action/CalibratePoints.jsx';
import { useConsent } from '../../components/consent_ui/ConsentContext';
import { useRouter } from 'next/router';
import { useAdminSettings } from './components-gui/adminSettings';
import { counter, debugButtonStorage, getAllImageCounters, resetAllImageCounters } from './components-gui/count&mark.js';
import styles from './styles/main-canvas.module.css';

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

// Simplified Canvas Manager - Essential functions only
class GlobalCanvasManager {
  constructor() {
    this.canvas = null;
    this.isInitialized = false;
  }

  // Get or create the main canvas
  getCanvas() {
    if (this.canvas) {
      return this.canvas;
    }

    // Try to find existing canvas first
    let canvas = document.querySelector('#main-canvas');
    
    if (canvas) {
      this.canvas = canvas;
      canvas.classList.add(styles.mainCanvas);
      return canvas;
    }
    
    // Create new canvas if none exists
    canvas = document.createElement('canvas');
    canvas.className = styles.mainCanvas;
    canvas.id = 'main-canvas';
    this.canvas = canvas;
    
    return canvas;
  }

  // Initialize the main canvas
  initializeCanvas() {
    const canvas = this.getCanvas();
    if (!canvas) {
      return null;
    }
    
    // Set up canvas with proper dimensions
    this.setupCanvas(canvas);
    
    // Add to body if not already there
    if (!canvas.parentNode) {
      document.body.appendChild(canvas);
    }

    // Ensure canvas has proper positioning above main-preview-area
    canvas.style.zIndex = '10'; // Higher z-index to ensure it's above preview area
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none'; // Allow clicks to pass through to elements below

    // Set up global references
    this.setupGlobalReferences();

    // Set up responsive behavior
    this.setupResponsiveCanvas(canvas);

    this.isInitialized = true;
    return canvas;
  }

  // Set up canvas with proper dimensions
  setupCanvas(canvas) {
    if (!canvas) return;

    const windowWidth = window.innerWidth || 800;
    const windowHeight = window.innerHeight || 600;

    canvas.width = windowWidth;
    canvas.height = windowHeight;

    // Ensure canvas is properly centered and styled
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '10'; // Higher z-index to ensure it's above preview area
    canvas.style.display = 'block';
    canvas.style.margin = '0';
    canvas.style.padding = '0';
    canvas.style.border = 'none';
    canvas.style.outline = 'none';
    canvas.style.pointerEvents = 'none'; // Allow clicks to pass through to elements below

    // Initialize with yellow background (will be overridden by canvas image manager if needed)
    this.clearCanvas(canvas);
  }

  // Restore canvas after tab visibility change
  restoreCanvas() {
    const canvas = this.getCanvas();
    if (!canvas) return null;

    // Ensure canvas is properly set up
    this.setupCanvas(canvas);
    
    // Add to body if not already there
    if (!canvas.parentNode) {
      document.body.appendChild(canvas);
    }

    // Ensure canvas has proper positioning
    canvas.style.zIndex = '10';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';

    return canvas;
  }

  // Clear canvas with yellow background
  clearCanvas(canvas = null) {
    const targetCanvas = canvas || this.getCanvas();
    if (!targetCanvas) return;
    
    // Always set yellow background in index.js
    const ctx = targetCanvas.getContext('2d');
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.fillStyle = 'yellow';
    ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    
    // If we have a canvas image manager, check if it has an image to redraw
    if (this.canvasImageManager && this.canvasImageManager.currentImage) {
      const cachedImage = this.canvasImageManager.imageCache.get(this.canvasImageManager.currentImage);
      if (cachedImage) {
        // Redraw the image on top of yellow background
        this.canvasImageManager.drawImageOnCanvas(cachedImage);
      }
    }
  }

  // Set canvas image manager reference
  setCanvasImageManager(manager) {
    this.canvasImageManager = manager;
  }

  // Get canvas image manager
  getCanvasImageManager() {
    return this.canvasImageManager;
  }

  // Set settings and userId for resize operations
  setSettingsAndUserId(settings, userId) {
    this.settings = settings;
    this.userId = userId;
  }

  // Set up global references
  setupGlobalReferences() {
    if (typeof window !== 'undefined') {
      window.mainCanvas = this.canvas;
      window.globalCanvasManager = this;
    }
  }

  // Set up responsive canvas behavior
  setupResponsiveCanvas(canvas) {
    if (!canvas) return;

    const handleWindowResize = () => {
      this.handleResize();
    };

    window.addEventListener('resize', handleWindowResize);
    canvas._windowResizeHandler = handleWindowResize;
  }

  // Handle resize events
  handleResize() {
    const canvas = this.getCanvas();
    if (!canvas) return;

    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;

    // Update canvas dimensions
    canvas.width = newWidth;
    canvas.height = newHeight;
    
    // Always set yellow background first
    this.clearCanvas(canvas);
    
    // If we have a canvas image manager, let it handle the image redraw
    if (this.canvasImageManager) {
      // Pass settings and userId to the resize handler for MongoDB image restoration
      if (this.settings && this.userId) {
        this.canvasImageManager.handleResize(this.settings, this.userId);
      } else {
        this.canvasImageManager.handleResize();
      }
    }
  }

  // Show UI elements (used by action handlers)
  showUIElements() {
    const hiddenElements = document.querySelectorAll('[data-hidden-by-canvas="true"]');
    hiddenElements.forEach(el => {
      el.style.display = '';
      el.removeAttribute('data-hidden-by-canvas');
      
      if (el.classList.contains('topbar')) {
        el.style.zIndex = '12';
        el.style.position = 'relative';
      }
    });
    
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      topbar.style.zIndex = '12';
      topbar.style.position = 'relative';
    }
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

  // Cleanup and destroy
  destroy() {
    // Clean up window resize listener
    if (this.canvas && this.canvas._windowResizeHandler) {
      window.removeEventListener('resize', this.canvas._windowResizeHandler);
    }

    // Remove all canvases from DOM
    const allCanvases = document.querySelectorAll('canvas');
    allCanvases.forEach(canvas => {
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    });

    // Reset state
    this.canvas = null;
    this.isInitialized = false;

    // Clean up global references
    if (typeof window !== 'undefined') {
      delete window.whiteScreenCanvas;
      delete window.globalCanvasManager;
    }
  }
}

// Main component that combines all functionality
const MainComponent = forwardRef(({ triggerCameraAccess, isCompactMode, onActionClick }, ref) => {
  const router = useRouter();
  const { userId: consentUserId } = useConsent();
  const { settings, updateSettings, fetchSettings, currentSettings, currentUserId: adminCurrentUserId } = useAdminSettings(ref, consentUserId);
  
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
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameras, setSelectedCameras] = useState([]);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0, percentage: 100 });
  const [metrics, setMetrics] = useState({ width: 0, height: 0, distance: '---' });
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
  
  // Countdown timer state for camera activation
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(2);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [hasShownFirstTimeCountdown, setHasShownFirstTimeCountdown] = useState(false);
  
  // Button action states
  const [randomTimes, setRandomTimes] = useState();
  const [delaySeconds, setDelaySeconds] = useState();
  const [processStatus, setProcessStatus] = useState('');
  const [currentDot, setCurrentDot] = useState(null);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const [remainingCaptures, setRemainingCaptures] = useState(0);
  const [showCanvas, setShowCanvas] = useState(true);
  const [calibrationHandler, setCalibrationHandler] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Track clicked buttons for OrderRequire component
  const [clickedButtons, setClickedButtons] = useState(new Set());
  
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
  
  // Canvas image management hook with overlay support
  const canvas = canvasManager.getCanvas();
  const {
    canvasImageManager,
    showNotification: showCanvasNotification,
    notificationMessage: canvasNotificationMessage,
    overlayImagePath,
    showOverlay,
    setOverlayImagePath,
    setShowOverlay,
    handleResize: handleCanvasImageResize,
    forceCheckMongoDBSettings,
    handleTabVisibilityChange,
    setOnImageComplete,
    getCurrentImageIndex,
    moveToNextImage,
    resetToFirstImage
  } = useCanvasImageWithOverlay(canvas, currentUserId, settings, adminCurrentUserId);
  
  // Function to track button clicks
  const trackButtonClick = useCallback(async (buttonName) => {
    setClickedButtons(prev => {
      const newSet = new Set([...prev, buttonName]);
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('clickedButtons', JSON.stringify(Array.from(newSet)));
      }
      return newSet;
    });
    
    // Also track in CanvasImage manager (but exclude 'Show preview' from counter)
    if (canvasImageManager && canvasImageManager.trackButtonClick && buttonName !== 'Show preview') {
      const userSettings = settings?.[currentUserId];
      const imageBackgroundPaths = userSettings?.image_background_paths || [];
      await canvasImageManager.trackButtonClick(buttonName, imageBackgroundPaths);
    }
  }, [canvasImageManager, settings, currentUserId]);
  
  // Function to clear clicked buttons (useful for resetting progress)
  const clearClickedButtons = useCallback(() => {
    setClickedButtons(new Set());
    // Clear from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('clickedButtons');
    }
    
    // Also reset CanvasImage manager
    if (canvasImageManager && canvasImageManager.resetButtonClickCount) {
      canvasImageManager.resetButtonClickCount();
    }
  }, [canvasImageManager]);
  
  // Function to load clicked buttons from localStorage
  const loadClickedButtonsFromStorage = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('clickedButtons');
        if (stored) {
          const buttonArray = JSON.parse(stored);
          return new Set(buttonArray);
        }
      } catch (error) {
        console.warn('Error loading clicked buttons from localStorage:', error);
      }
    }
    return new Set();
  }, []);

  // Function to get progress info from canvas image manager
  const getProgressInfo = useCallback(() => {
    if (canvasImageManager && canvasImageManager.getProgressInfo) {
      return canvasImageManager.getProgressInfo();
    }
    return {
      buttonClickCount: 0,
      currentImageTimes: 1,
      currentImageIndex: 0,
      totalImages: 0,
      currentImagePath: null
    };
  }, [canvasImageManager]);

  // Refs
  const previewAreaRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const actionButtonGroupRef = useRef(null);

  // Add cache for settings
  const settingsCache = useRef(new Map());
  const lastSettingsUpdate = useRef(new Map());
  
  // Camera selection and management functions
  const getAvailableCameras = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        const cameras = videoDevices.map((device, index) => ({
          id: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
          index: index
        }));
        
        setAvailableCameras(cameras);
        
        // Auto-select camera based on availability
        if (cameras.length === 1) {
          // If only one camera, auto-select it
          setSelectedCameras([cameras[0].id]);
          setProcessStatus(`Auto-selected camera: ${cameras[0].label}`);
        } else if (cameras.length > 1 && (!Array.isArray(selectedCameras) || selectedCameras.length === 0)) {
          // If multiple cameras but none selected, select the first one as default
          setSelectedCameras([cameras[0].id]);
          setProcessStatus(`Default camera selected: ${cameras[0].label}`);
        }
        
        return cameras;
      }
    } catch (error) {
      console.error('Error getting available cameras:', error);
      setProcessStatus('Error getting camera list');
    }
    return [];
  }, [selectedCameras.length]);

  const openCameraSelector = useCallback(() => {
    setShowCameraSelector(true);
    getAvailableCameras();
  }, [getAvailableCameras]);
  
  // Countdown timer function for camera activation
  const startCameraActivationCountdown = useCallback(() => {
    if (hasShownFirstTimeCountdown) return; // Only show countdown on first activation
    
    setShowCountdown(true);
    setIsCountdownActive(true);
    setCountdownValue(2);
    setProcessStatus('Camera activation countdown starting...');
    
    const countdownInterval = setInterval(() => {
      setCountdownValue(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setShowCountdown(false);
          setIsCountdownActive(false);
          setHasShownFirstTimeCountdown(true);
          setProcessStatus('Camera activated and ready for use!');
          return 0;
        }
        setProcessStatus(`Camera activating... ${prev - 1} seconds remaining`);
        return prev - 1;
      });
    }, 1000);
  }, [hasShownFirstTimeCountdown]);

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
      // Start countdown timer for first-time activation
      startCameraActivationCountdown();
      
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
  }, [startCameraActivationCountdown]);

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

  // Function to fetch settings directly from MongoDB with caching
  const fetchSettingsFromMongoDB = useCallback(async (userId) => {
    if (!userId) return null;
    
    // Check cache first to avoid redundant requests
    const cachedSettings = settingsCache.current.get(userId);
    const lastUpdate = lastSettingsUpdate.current.get(userId);
    const now = Date.now();
    
    // If we have cached settings and they're recent (less than 30 seconds), use them
    if (cachedSettings && lastUpdate && (now - lastUpdate < 30000)) {
      return cachedSettings;
    }
    
    try {
      const response = await fetch(`/api/data-center/settings/${userId}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
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
      lastSettingsUpdate.current.set(userId, now);
      
      // Update the settings in the admin settings hook
      if (settings && typeof updateSettings === 'function') {
        await updateSettings(userSettings, userId);
      }
      
      return userSettings;
    } catch (error) {
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
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
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
  



  // Simplified canvas utilities - only essential functions
  const canvasUtils = useMemo(() => ({
    // Get or create canvas
    getCanvas: () => canvasManager.getCanvas(),
    
    // Clear canvas
    clear: () => {
      canvasManager.clearCanvas();
    },
    
    // Get canvas dimensions
    getDimensions: () => {
      return canvasManager.getDimensions();
    },
    
    // Initialize canvas
    initialize: () => {
      return canvasManager.initializeCanvas();
    }
  }), [canvasManager]);

  // Make canvas utilities globally available and integrate canvas image manager
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.canvasUtils = canvasUtils;
      window.canvasManager = canvasManager;
      
        // Integrate canvas image manager with canvas manager
        if (canvasImageManager) {
          canvasManager.setCanvasImageManager(canvasImageManager);
          // Set settings and userId for resize operations
          canvasManager.setSettingsAndUserId(settings, currentUserId);
          window.canvasImageManager = canvasImageManager;
          
          // Set up image completion callback
          if (setOnImageComplete) {
            setOnImageComplete((eventType, data) => {
              if (eventType === 'image_switched') {
                console.log('Image switched:', data);
                setProcessStatus(`Switched to image ${data.currentIndex + 1}: ${data.imagePath.split('/').pop()}`);
                
                // Update overlay image path if using overlay
                if (setOverlayImagePath) {
                  setOverlayImagePath(data.imagePath);
                }
              } else if (eventType === 'all_complete') {
                console.log('All images completed!');
                setProcessStatus('All images completed! 🎉');
              }
            });
          }
          
          // Add a debounced resize event listener to ensure it's triggered
          let resizeTimeout;
          const directResizeHandler = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
              if (canvasImageManager && canvasImageManager.handleResize) {
                // Pass settings and userId for MongoDB image restoration
                canvasImageManager.handleResize(settings, currentUserId);
              }
            }, 100); // Debounce resize events by 100ms
          };
          
          window.addEventListener('resize', directResizeHandler);
          window._directResizeHandler = directResizeHandler;
          
          // Load default image only if background change is enabled
          setTimeout(() => {
            // Check if background change is enabled before loading default image
            const userSettings = settings?.[currentUserId];
            const enableBackgroundChange = userSettings?.enable_background_change || false;
            
            if (enableBackgroundChange) {
              canvasImageManager.setImageBackground('/Overall_porch.png');
            } else {
              // Background change is disabled, clear canvas (yellow background is handled in index.js)
              canvasImageManager.clearCanvas();
              canvasImageManager.currentImage = null; // Ensure no image is set
            }
          }, 1000);







      }
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        // Remove direct resize handler and clear timeout
        if (window._directResizeHandler) {
          window.removeEventListener('resize', window._directResizeHandler);
          delete window._directResizeHandler;
        }
        
        // Clear any pending resize timeouts
        if (window._resizeTimeout) {
          clearTimeout(window._resizeTimeout);
          delete window._resizeTimeout;
        }
        
        delete window.canvasUtils;
        delete window.canvasManager;
        delete window.canvasImageManager;
      }
    };
  }, [canvasUtils, canvasManager, canvasImageManager]);

  // Update canvas manager settings and userId when they change
  useEffect(() => {
    if (canvasManager && settings && currentUserId) {
      canvasManager.setSettingsAndUserId(settings, currentUserId);
    }
  }, [canvasManager, settings, currentUserId]);

  // Force check MongoDB settings for image restoration when settings are loaded
  useEffect(() => {
    if (canvasImageManager && settings && currentUserId && isHydrated) {
      // Small delay to ensure everything is initialized
      setTimeout(() => {
        forceCheckMongoDBSettings(settings, currentUserId);
      }, 1000);
    }
  }, [canvasImageManager, settings, currentUserId, isHydrated, forceCheckMongoDBSettings]);

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
      
      // Load clicked buttons from localStorage
      const storedClickedButtons = loadClickedButtonsFromStorage();
      setClickedButtons(storedClickedButtons);
      
      // Load selected cameras from localStorage
      try {
        const storedCameras = localStorage.getItem('selectedCameras');
        if (storedCameras) {
          const parsedCameras = JSON.parse(storedCameras);
          if (Array.isArray(parsedCameras) && parsedCameras.length > 0) {
            setSelectedCameras(parsedCameras);
            setProcessStatus(`Loaded ${parsedCameras.length} previously selected camera(s) from storage`);
          }
        }
      } catch (error) {
        console.warn('Error loading selected cameras from localStorage:', error);
      }
    }
    
    // Restore camera state (which will deactivate camera)
    restoreCameraState();
    
    // Ensure only one canvas exists and prevent scrolling
    if (typeof window !== 'undefined') {
      // Prevent page scrolling
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      // Initialize canvas using the canvas manager
      canvasManager.initializeCanvas();
      
      // Ensure canvas is properly positioned
      const canvas = canvasManager.getCanvas();
      if (canvas) {
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.zIndex = '10'; // Higher z-index to ensure it's above preview area
        canvas.style.pointerEvents = 'none'; // Allow clicks to pass through to elements below
      }
    }
    
    // Fetch initial settings if we have a current user ID
    if (currentUserId && currentUserId !== 'default') {
      fetchSettingsFromMongoDB(currentUserId);
    }
    
    // Auto-detect available cameras
    getAvailableCameras();
    
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
        
        // Clean up canvas manager
        if (canvasManager) {
          canvasManager.destroy();
        }
      }
    };
  }, [currentUserId, fetchSettingsFromMongoDB, checkCameraActivation, restoreCameraState, getAvailableCameras, canvasManager, loadClickedButtonsFromStorage]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Set page as inactive but don't cleanup canvas - preserve state
        setIsPageActive(false);
        
        // Notify canvas image manager that tab became hidden
        if (handleTabVisibilityChange) {
          handleTabVisibilityChange(false);
        }
      } else {
        // Page is visible again, set as active and restore canvas if needed
        setIsPageActive(true);
        
        // Restore canvas and image if they were lost
        setTimeout(() => {
          if (canvasManager && canvasImageManager) {
            // Restore canvas
            const canvas = canvasManager.restoreCanvas();
            if (canvas) {
              // Re-initialize canvas image manager with the restored canvas
              canvasImageManager.initialize(canvas);
              
              // Notify canvas image manager that tab became visible
              if (handleTabVisibilityChange) {
                handleTabVisibilityChange(true);
              }
              
              // Restore the image if we had one
              const currentImage = canvasImageManager.getCurrentImage();
              if (currentImage) {
                // Force redraw the current image
                canvasImageManager.forceRedrawCurrentImage();
              } else if (settings && currentUserId) {
                // Try to restore from MongoDB settings
                canvasImageManager.forceCheckMongoDBSettings(settings, currentUserId);
              } else {
                // Just set yellow background
                canvasManager.clearCanvas();
              }
            }
          }
        }, 100);
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
        // Note: clickedButtons are preserved in localStorage for next session
      }
    };

    const cleanupPageStyles = () => {
      if (typeof window !== 'undefined') {
        // Remove canvas completely from DOM
        const canvas = document.querySelector('#main-canvas');
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
        document.body.classList.remove('main-container');
        document.documentElement.classList.remove('main-container');
      }
    };

    // Handle window focus/blur as backup for tab switching
    const handleWindowFocus = () => {
      if (!document.hidden) {
        // Window gained focus - restore canvas and image
        setTimeout(() => {
          if (canvasManager && canvasImageManager) {
            const canvas = canvasManager.restoreCanvas();
            if (canvas) {
              canvasImageManager.initialize(canvas);
              if (handleTabVisibilityChange) {
                handleTabVisibilityChange(true);
              }
              const currentImage = canvasImageManager.getCurrentImage();
              if (currentImage) {
                canvasImageManager.forceRedrawCurrentImage();
              } else if (settings && currentUserId) {
                canvasImageManager.forceCheckMongoDBSettings(settings, currentUserId);
              }
            }
          }
        }, 100);
      }
    };

    const handleWindowBlur = () => {
      // Window lost focus - notify canvas image manager
      if (handleTabVisibilityChange) {
        handleTabVisibilityChange(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
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
        const canvas = document.querySelector('#main-canvas');
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
        document.body.classList.remove('main-container');
        document.documentElement.classList.remove('main-container');
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
              'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
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

  // Update window size and canvas dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (previewAreaRef.current) {
        const width = previewAreaRef.current.offsetWidth;
        const height = previewAreaRef.current.offsetHeight;
        const screenPercentage = (window.innerWidth / window.screen.width) * 100;
        
        // Get actual canvas dimensions
        const canvas = canvasManager.getCanvas();
        const canvasWidth = canvas ? canvas.width : 0;
        const canvasHeight = canvas ? canvas.height : 0;
        
        // Only update metrics if we have valid canvas dimensions
        if (canvasWidth > 0 && canvasHeight > 0) {
          setMetrics(prev => ({ 
            ...prev, 
            width: canvasWidth, 
            height: canvasHeight 
          }));
        } else {
          // Keep current metrics or set to 0 if no valid canvas
          setMetrics(prev => ({ 
            ...prev, 
            width: prev.width > 0 ? prev.width : 0, 
            height: prev.height > 0 ? prev.height : 0 
          }));
        }
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
          percentage: Math.round(screenPercentage)
        });
        
        // Update canvas size when window size changes
        if (canvasManager && isPageActive) {
          canvasManager.handleResize();
          
          // Also trigger canvas image manager resize if available
          const canvasImageManager = canvasManager.getCanvasImageManager();
          if (canvasImageManager && canvasImageManager.handleResize) {
            // Pass settings and userId for MongoDB image restoration
            canvasImageManager.handleResize(settings, currentUserId);
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
    
    // Initialize the global canvas manager
    const canvas = canvasManager.initializeCanvas();
    
    // Ensure canvas has proper positioning (don't clear if image exists)
    if (canvas) {
      // Only clear canvas if no image is currently set
      if (!canvasImageManager || !canvasImageManager.currentImage) {
        // Check if background change is enabled before clearing
        const userSettings = settings?.[currentUserId];
        const enableBackgroundChange = userSettings?.enable_background_change || false;
        
        // Always set yellow background in index.js
        canvasManager.clearCanvas(canvas);
        
        if (!enableBackgroundChange && canvasImageManager) {
          // Background change is disabled, ensure no image is set
          canvasImageManager.currentImage = null;
        }
      }
      // Ensure canvas is properly positioned and centered
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.zIndex = '10'; // Higher z-index to ensure it's above preview area
      canvas.style.display = 'block';
      canvas.style.margin = '0';
      canvas.style.padding = '0';
      canvas.style.border = 'none';
      canvas.style.outline = 'none';
      canvas.style.pointerEvents = 'none'; // Allow clicks to pass through to elements below
      
      // Set canvas dimensions to actual window size
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Update metrics with actual canvas dimensions
      setMetrics(prev => ({
        ...prev,
        width: canvas.width,
        height: canvas.height
      }));
    }
    
    return () => {
      // Cleanup canvas on component unmount
      if (canvasManager) {
        canvasManager.destroy();
      }
    };
  }, [canvasManager, isPageActive]);

  // Optimize settings updates - properly handle MongoDB data with throttling
  useEffect(() => {
    if (settings && currentUserId && settings[currentUserId]) {
      const userSettings = settings[currentUserId];
      const cachedSettings = settingsCache.current.get(currentUserId);
      const lastUpdate = lastSettingsUpdate.current.get(currentUserId);
      const now = Date.now();
      
      // Only update if settings have actually changed and enough time has passed
      if (!isEqual(cachedSettings, userSettings) && (!lastUpdate || (now - lastUpdate > 2000))) {
        // Extract times_set_random and delay_set_random from MongoDB data
        const timesSetRandom = Number(userSettings.times_set_random) || 1;
        const delaySetRandom = Number(userSettings.delay_set_random) || 3;
        
        setRandomTimes(timesSetRandom);
        setDelaySeconds(delaySetRandom);
        settingsCache.current.set(currentUserId, userSettings);
        lastSettingsUpdate.current.set(currentUserId, now);
        
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

  // Listen for settings updates - properly handle MongoDB field names with caching
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      if (event.detail && event.detail.type === 'captureSettings') {
        const { userId, times_set_random, delay_set_random } = event.detail;
        if (userId === currentUserId) {
          const now = Date.now();
          const lastUpdate = lastSettingsUpdate.current.get(currentUserId);
          
          // Throttle updates to prevent excessive state changes
          if (lastUpdate && (now - lastUpdate < 1000)) {
            return;
          }
          
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
            lastSettingsUpdate.current.set(currentUserId, now);
          }
        }
      }
    };
    window.addEventListener('captureSettingsUpdate', handleSettingsUpdate);
    return () => {
      window.removeEventListener('captureSettingsUpdate', handleSettingsUpdate);
    };
  }, [currentUserId, settings]);
  
  // Listen for TopBar settings loaded event with caching
  useEffect(() => {
    const handleTopBarSettingsLoaded = (event) => {
      if (event.detail && event.detail.userId === currentUserId) {
        const { times_set_random, delay_set_random } = event.detail;
        const now = Date.now();
        const lastUpdate = lastSettingsUpdate.current.get(currentUserId);
        
        // Throttle updates to prevent excessive state changes
        if (lastUpdate && (now - lastUpdate < 1000)) {
          return;
        }
        
        if (times_set_random !== undefined) {
          setRandomTimes(Number(times_set_random) || 1);
        }
        if (delay_set_random !== undefined) {
          setDelaySeconds(Number(delay_set_random) || 3);
        }
        
        // Update cache timestamp
        lastSettingsUpdate.current.set(currentUserId, now);
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
        getCurrentSettings: () => ({
          times_set_random: randomTimes,
          delay_set_random: delaySeconds,
          currentUserId: currentUserId
        })
      };
      
      // Make button tracking functions globally accessible
      window.buttonTracking = {
        getClickedButtons: () => Array.from(clickedButtons),
        clearClickedButtons: clearClickedButtons,
        trackButtonClick: trackButtonClick,
        loadFromStorage: loadClickedButtonsFromStorage,
        saveToStorage: (buttons) => {
          if (typeof window !== 'undefined') {
            localStorage.setItem('clickedButtons', JSON.stringify(Array.from(buttons)));
          }
        },
        clearStorage: () => {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('clickedButtons');
          }
        },
        resetProgress: () => {
          // Clear both state and localStorage
          clearClickedButtons();
          console.log('Button progress reset - all checkmarks cleared');
        },
        getStorageInfo: () => {
          if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('clickedButtons');
            return {
              hasStoredData: !!stored,
              storedButtons: stored ? JSON.parse(stored) : [],
              currentButtons: Array.from(clickedButtons)
            };
          }
          return null;
        },
        // Add counter debugging functions
        debugStorage: () => debugButtonStorage(currentUserId),
        getCounter: (imageIndex = null) => {
          if (imageIndex !== null) {
            const storageKey = currentUserId ? `buttonCounter_${currentUserId}_image_${imageIndex}` : `buttonCounter_image_${imageIndex}`;
            return localStorage.getItem(storageKey) || '0';
          } else {
            const storageKey = currentUserId ? `buttonCounter_${currentUserId}` : 'buttonCounter';
            return localStorage.getItem(storageKey) || '0';
          }
        },
        getAllImageCounters: () => getAllImageCounters(currentUserId),
        resetCounter: (imageIndex = null) => {
          if (imageIndex !== null) {
            const storageKey = currentUserId ? `buttonCounter_${currentUserId}_image_${imageIndex}` : `buttonCounter_image_${imageIndex}`;
            localStorage.removeItem(storageKey);
            console.log(`Button counter for image ${imageIndex + 1} reset to 0`);
          } else {
            const storageKey = currentUserId ? `buttonCounter_${currentUserId}` : 'buttonCounter';
            localStorage.removeItem(storageKey);
            console.log('Global button counter reset to 0');
          }
        },
        resetAllImageCounters: () => resetAllImageCounters(currentUserId),
        
        // Test image switching functionality
        testImageSwitching: async () => {
          console.log('🧪 Testing image switching functionality...');
          
          if (!canvasImageManager) {
            console.error('CanvasImageManager not available');
            return;
          }
          
          // Test data similar to your MongoDB example
          const testImagePaths = [
            "[56]-/Overall_porch.png",
            "[56]-/istockphoto-517188688-612x612.jpg"
          ];
          
          console.log('📋 Test data:', testImagePaths);
          
          // Parse the images
          const parsedImages = canvasImageManager.getAllParsedImages(testImagePaths);
          console.log('📊 Parsed images:', parsedImages);
          
          // Set up the canvas with test data
          canvasImageManager.updateImageBackgroundPaths(testImagePaths);
          
          // Get current state
          const progressInfo = canvasImageManager.getProgressInfo();
          console.log('📈 Current progress:', progressInfo);
          
          // Simulate button clicks to complete first image
          console.log('🔄 Simulating button clicks to complete first image...');
          
          for (let i = 0; i < 56; i++) {
            await canvasImageManager.trackButtonClick('Test Random Dot', testImagePaths);
            
            const currentProgress = canvasImageManager.getProgressInfo();
            console.log(`Click ${i + 1}/56: ${currentProgress.progress}`);
            
            // Check if we switched to next image
            if (canvasImageManager.getCurrentImageIndex() > 0) {
              console.log('✅ Successfully switched to second image!');
              break;
            }
          }
          
          // Final state
          const finalProgress = canvasImageManager.getProgressInfo();
          console.log('🎯 Final progress:', finalProgress);
          
          return {
            success: true,
            message: 'Image switching test completed',
            finalProgress
          };
        },
        
        // Quick test to simulate completion of first image
        quickTestImageSwitch: async () => {
          console.log('⚡ Quick test: Simulating first image completion...');
          
          if (!canvasImageManager) {
            console.error('CanvasImageManager not available');
            return;
          }
          
          // Test data
          const testImagePaths = [
            "[56]-/Overall_porch.png",
            "[56]-/istockphoto-517188688-612x612.jpg"
          ];
          
          // Set up canvas
          canvasImageManager.updateImageBackgroundPaths(testImagePaths);
          
          // Set button count to just below completion (55/56)
          canvasImageManager.buttonClickCount = 55;
          canvasImageManager.currentImageTimes = 56;
          canvasImageManager.saveProgressToStorage();
          
          console.log('📊 Before switch:', canvasImageManager.getProgressInfo());
          
          // Trigger one more button click to complete first image
          await canvasImageManager.trackButtonClick('Test Random Dot', testImagePaths);
          
          console.log('📊 After switch:', canvasImageManager.getProgressInfo());
          
          return {
            success: true,
            message: 'Quick test completed',
            currentImageIndex: canvasImageManager.getCurrentImageIndex(),
            progress: canvasImageManager.getProgressInfo()
          };
        },
        
        // Check current image state
        checkImageState: () => {
          if (!canvasImageManager) {
            console.error('CanvasImageManager not available');
            return;
          }
          
          const progressInfo = canvasImageManager.getProgressInfo();
          const currentImage = canvasImageManager.getCurrentImage();
          
          console.log('🔍 Current Image State:');
          console.log('  - Current Image Index:', progressInfo.currentImageIndex);
          console.log('  - Total Images:', progressInfo.totalImages);
          console.log('  - Current Image Path:', progressInfo.currentImagePath);
          console.log('  - Button Click Count:', progressInfo.buttonClickCount);
          console.log('  - Current Image Times:', progressInfo.currentImageTimes);
          console.log('  - Progress:', progressInfo.progress);
          console.log('  - Is Complete:', progressInfo.isComplete);
          console.log('  - Canvas Current Image:', currentImage);
          
          return {
            currentImageIndex: progressInfo.currentImageIndex,
            totalImages: progressInfo.totalImages,
            currentImagePath: progressInfo.currentImagePath,
            buttonClickCount: progressInfo.buttonClickCount,
            currentImageTimes: progressInfo.currentImageTimes,
            progress: progressInfo.progress,
            isComplete: progressInfo.isComplete,
            canvasCurrentImage: currentImage
          };
        },
        
        // Force switch to specific image (for testing)
        forceSwitchToImage: async (imageIndex) => {
          if (!canvasImageManager) {
            console.error('CanvasImageManager not available');
            return;
          }
          
          console.log(`🔄 Force switching to image ${imageIndex + 1}...`);
          
          // Set the image index
          canvasImageManager.setCurrentImageIndex(imageIndex);
          
          // Get the image data
          const progressInfo = canvasImageManager.getProgressInfo();
          const targetImage = progressInfo.parsedImages[imageIndex];
          
          if (targetImage) {
            console.log(`📸 Loading image: ${targetImage.path} (times: ${targetImage.times})`);
            
            // Load the image
            const success = await canvasImageManager.setImageBackground(targetImage.path);
            
            if (success) {
              console.log(`✅ Successfully switched to image ${imageIndex + 1}`);
              return {
                success: true,
                message: `Switched to image ${imageIndex + 1}`,
                imagePath: targetImage.path,
                times: targetImage.times
              };
            } else {
              console.error(`❌ Failed to load image ${imageIndex + 1}`);
              return {
                success: false,
                message: `Failed to load image ${imageIndex + 1}`
              };
            }
          } else {
            console.error(`❌ Image ${imageIndex + 1} not found`);
            return {
              success: false,
              message: `Image ${imageIndex + 1} not found`
            };
          }
        }
      };



      
      // Make camera state management globally accessible
      window.cameraStateManager = {
        isActivated: () => isCameraActivated,
        checkActivation: checkCameraActivation,
        setActivation: setCameraActivation,
        showNotification: showCameraRequiredNotification,
        clearActivation: clearCameraActivation,
        isCountdownActive: isCountdownActive,
        stopCamera: () => {
          setShowCamera(false);
          setIsCameraActive(false);
          setCameraActivation(false);
          setProcessStatus('Camera stopped');
        },
        getVideoElement: () => {
          // Try multiple methods to get the video element
          let videoElement = window.videoElement || document.querySelector('video');
          
          if (!videoElement) {
            // Try to find video element in camera components
            const cameraComponents = document.querySelectorAll('[data-camera-video], .camera-video, video');
            for (const component of cameraComponents) {
              if (component.tagName === 'VIDEO' && component.srcObject) {
                videoElement = component;
                break;
              }
            }
          }
          
          return videoElement;
        },
        ensureCameraActive: async () => {
          // Ensure camera is activated and video element is available
          if (!isCameraActivated) {
            setCameraActivation(true);
            setIsCameraActive(true);
          }
          
          // Wait a bit for camera to initialize
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Return the video element
          return window.cameraStateManager.getVideoElement();
        },
        debugCameraState: () => {
          const videoElement = window.cameraStateManager.getVideoElement();
        }
      };

      // Make canvas image management globally accessible for debugging
      window.canvasImageDebug = {
        forceRedrawImage: () => {
          if (canvasImageManager && canvasImageManager.forceRedrawCurrentImage) {
            const success = canvasImageManager.forceRedrawCurrentImage();
            return success;
          }
          return false;
        },
        getCurrentImage: () => {
          if (canvasImageManager) {
            return canvasImageManager.getCurrentImage();
          }
          return null;
        },
        hasImage: () => {
          if (canvasImageManager) {
            return canvasImageManager.hasImageBackground();
          }
          return false;
        },
        getDebugInfo: () => {
          if (canvasImageManager) {
            const debugInfo = canvasImageManager.getDebugInfo();
            return debugInfo;
          }
          return null;
        },
        clearCache: () => {
          if (canvasImageManager) {
            canvasImageManager.clearCache();
          }
        },
        reloadCurrentImage: () => {
          if (canvasImageManager && canvasImageManager.getCurrentImage()) {
            const currentImage = canvasImageManager.getCurrentImage();
            return canvasImageManager.setImageBackground(currentImage);
          }
          return false;
        },
        testResize: () => {
          if (canvasManager && canvasManager.handleResize) {
            canvasManager.handleResize();
          }
        },
        restoreFromMongoDB: () => {
          if (canvasImageManager && canvasImageManager.handleCanvasBackgroundFromSettings) {
            return canvasImageManager.handleCanvasBackgroundFromSettings(settings, currentUserId);
          }
          return false;
        },
        forceCheckMongoDBSettings: () => {
          if (forceCheckMongoDBSettings) {
            return forceCheckMongoDBSettings(settings, currentUserId);
          }
          return false;
        },
        updateSettings: (newSettings, newUserId) => {
          if (canvasManager && canvasManager.setSettingsAndUserId) {
            canvasManager.setSettingsAndUserId(newSettings, newUserId);
          }
        }
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.actionButtonFunctions;
        delete window.globalCanvasManager;
        delete window.canvasUtils;
        delete window.mongoDBSettings;
        delete window.buttonTracking;
        delete window.cameraStateManager;
        delete window.canvasImageDebug;
      }
    };
  }, [canvasManager, canvasUtils, fetchSettingsFromMongoDB, saveSettingsToMongoDB, randomTimes, delaySeconds, currentUserId, isCameraActivated, isCountdownActive, checkCameraActivation, setCameraActivation, showCameraRequiredNotification, clearCameraActivation, clickedButtons, clearClickedButtons, trackButtonClick, loadClickedButtonsFromStorage]);

  // Make TopBar control functions available globally
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Direct TopBar control
      window.toggleTopBar = (show) => {
        setShowTopBar(show);
        
        // Auto-control metrics with TopBar
        if (!show) {
          setShowMetrics(false);
        } else {
          setShowMetrics(true);
        }
        
        // Restore UI elements if needed
        if (typeof window !== 'undefined' && window.globalCanvasManager) {
          window.globalCanvasManager.showUIElements();
        }
      };
      
      // Direct metrics control
      window.toggleMetrics = (show) => {
        setShowMetrics(show);
      };
      
      // Get current TopBar state
      window.getTopBarState = () => ({
        isTopBarShown: showTopBar,
        showMetrics: showMetrics,
        isCameraActive: isCameraActive,
        isCameraActivated: isCameraActivated
      });
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.toggleTopBar;
        delete window.toggleMetrics;
        delete window.getTopBarState;
      }
    };
  }, [showTopBar, showMetrics, isCameraActive, isCameraActivated]);



  // TopBar control functions
  const hideTopBar = () => {
    if (typeof window !== 'undefined' && window.toggleTopBar) {
      window.toggleTopBar(false);
    } else {
      setShowTopBar(false);
      setShowMetrics(false);
    }
  };

  const restoreTopBar = () => {
    if (typeof window !== 'undefined' && window.toggleTopBar) {
      window.toggleTopBar(true);
    } else {
      setShowTopBar(true);
      setShowMetrics(true);
      // Show UI elements if they were hidden by canvas fullscreen
      if (typeof window !== 'undefined' && window.globalCanvasManager) {
        window.globalCanvasManager.showUIElements();
      }
    }
  };

  // Action handlers
  const handleRandomDot = async () => {
    if (isCapturing) return;

    // Check if countdown is active - block action during countdown
    if (isCountdownActive) {
      setProcessStatus('Please wait for camera activation countdown to complete...');
      return;
    }

    // Check if camera is activated - show notification and return early if not
    if (!isCameraActivated) {
      showCameraRequiredNotification('Random Dot');
      return;
    }

    // Hide camera UI if it's currently shown, but keep camera activated and active
    if (showCamera === true) {
      setShowCamera(false);
      setCameraActivation(true);
      setIsCameraActive(true); // Ensure camera stays active for capture
      setProcessStatus('Camera preview hidden for Random Dot action');
      
      // Ensure video element is available for capture
      setTimeout(() => {
        const videoElement = window.videoElement || document.querySelector('video');
        if (!videoElement || !videoElement.srcObject) {
          console.warn('Camera not ready for capture, attempting to ensure camera is active...');
          // Try to trigger camera activation if available
          if (typeof window !== 'undefined' && window.cameraStateManager) {
            window.cameraStateManager.setActivation(true);
          }
        }
      }, 500);
    }

    try {
      // Clear canvas before starting the main process (preserve image if exists)
      if (!canvasImageManager || !canvasImageManager.currentImage) {
        // Always set yellow background in index.js
        canvasManager.clearCanvas();
        
        // Check if background change is disabled
        const userSettings = settings?.[currentUserId];
        const enableBackgroundChange = userSettings?.enable_background_change || false;
        
        if (!enableBackgroundChange && canvasImageManager) {
          // Background change is disabled, ensure no image is set
          canvasImageManager.currentImage = null;
        }
      }
      
      // Import and use RandomDotAction
      const { default: RandomDotAction } = await import('../../components/collected-dataset-customized/Action/RandomDotAction.jsx');
      
      // Ensure canvas is available
      const canvas = canvasManager.getCanvas();
      if (!canvas) {
        throw new Error("Canvas not available");
      }
      
      const randomDotAction = new RandomDotAction({
        canvasRef: { current: canvas },
        setIsCapturing: (capturing) => {
          setIsCapturing(capturing);
        },
        setProcessStatus: (status) => {
          setProcessStatus(status);
        },
        setCurrentDot: (dot) => {
          setCurrentDot(dot);
        },
        triggerCameraAccess,
        onStatusUpdate: (status) => {
          if (status.processStatus) setProcessStatus(status.processStatus);
          if (status.isCapturing !== undefined) setIsCapturing(status.isCapturing);
        },
        saveImageToServer: true,
        setCaptureCounter,
        captureCounter: captureCounter,
        hideTopBar: hideTopBar, // Pass the hideTopBar function to the action
        restoreTopBar: restoreTopBar // Pass the restoreTopBar function to the action
      });
      
      await randomDotAction.handleRandomDot();
      
      // Increment counter after successful completion (per image)
      const currentImageIndex = canvasImageManager ? canvasImageManager.getCurrentImageIndex() : 0;
      const counterResult = counter(1, currentUserId, currentImageIndex);
      if (counterResult.success) {
        console.log(`Random Dot completed - Counter: ${counterResult.newCount} (Image ${currentImageIndex + 1})`);
      }
      
    } catch (error) {
      console.error('Random dot error:', error);
      setProcessStatus(`Error: ${error.message}`);
      setIsCapturing(false);
    }
  };

  const handleSetRandom = async () => {
    if (isCapturing) return;
    
    // Check if countdown is active - block action during countdown
    if (isCountdownActive) {
      setProcessStatus('Please wait for camera activation countdown to complete...');
      return;
    }
    
    // Check if camera is activated - show notification and return early if not
    if (!isCameraActivated) {
      showCameraRequiredNotification('Set Random');
      return;
    }

    if (showCamera === true) {
      setShowCamera(false);
      setCameraActivation(true);
      setIsCameraActive(true); // Ensure camera stays active for capture
      setProcessStatus('Camera preview hidden for Random Dot action');
      
      // Ensure video element is available for capture
      setTimeout(() => {
        const videoElement = window.videoElement || document.querySelector('video');
        if (!videoElement || !videoElement.srcObject) {
          console.warn('Camera not ready for capture, attempting to ensure camera is active...');
          // Try to trigger camera activation if available
          if (typeof window !== 'undefined' && window.cameraStateManager) {
            window.cameraStateManager.setActivation(true);
          }
        }
      }, 500);
    }
    
    try {
      // Fetch current settings from adminSettings
      let times = randomTimes;
      let delay = delaySeconds;
      
      // Use the correct user ID from admin settings
      const effectiveUserId = adminCurrentUserId || currentUserId;
      
      // Always try to fetch fresh settings from MongoDB
      if (effectiveUserId && fetchSettings) {
        try {
          const userSettings = await fetchSettings(effectiveUserId);
          if (userSettings) {
            times = Number(userSettings.times_set_random);
            delay = Number(userSettings.delay_set_random);
            console.log(`[handleSetRandom] Fetched from MongoDB - times: ${times}, delay: ${delay}`);
          }
        } catch (error) {
          console.log(`[handleSetRandom] Error fetching settings, using defaults`);
        }
      }
      
      // If we still don't have valid values, use defaults
      if (!times || isNaN(times)) {
        times = 1;
      }
      if (!delay || isNaN(delay)) {
        delay = 3;
      }
      
      // Debug log to check final delay value
      console.log(`[handleSetRandom] Final values - times: ${times}, delay: ${delay} seconds`);
      
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
        captureCounter: captureCounter,
        triggerCameraAccess,
        setIsCapturing: (capturing) => {
          setIsCapturing(capturing);
        },
        setProcessStatus: (status) => {
          setProcessStatus(status);
        },
        times: times,
        delay: delay,
        hideTopBar: hideTopBar, // Pass the hideTopBar function to the action
        restoreTopBar: restoreTopBar // Pass the restoreTopBar function to the action
      });
      
      // Hide TopBar right before starting the actual action
      hideTopBar();
      
      await setRandomAction.handleAction();
      
      // Increment counter after successful completion (per image)
      const currentImageIndex = canvasImageManager ? canvasImageManager.getCurrentImageIndex() : 0;
      const counterResult = counter(1, currentUserId, currentImageIndex);
      if (counterResult.success) {
        console.log(`Set Random completed - Counter: ${counterResult.newCount} (Image ${currentImageIndex + 1})`);
      }
    } catch (error) {
      console.error("Random sequence error:", error);
      setProcessStatus(`Random sequence failed: ${error.message}`);
      setIsCapturing(false);
    }
  };

  const handleSetCalibrate = async () => {
    if (isCapturing) return;
    
    // Check if countdown is active - block action during countdown
    if (isCountdownActive) {
      setProcessStatus('Please wait for camera activation countdown to complete...');
      return;
    }
    
    // Check if camera is activated - show notification and return early if not
    if (!isCameraActivated) {
      showCameraRequiredNotification('Set Calibrate');
      return;
    }
    
    try {
      // Fetch current settings from adminSettings
      let times = randomTimes;
      let delay = delaySeconds;
      
      // Use the correct user ID from admin settings
      const effectiveUserId = adminCurrentUserId || currentUserId;
      
      // Always try to fetch fresh settings from MongoDB
      if (effectiveUserId && fetchSettings) {
        try {
          const userSettings = await fetchSettings(effectiveUserId);
          if (userSettings) {
            times = Number(userSettings.times_set_random);
            delay = Number(userSettings.delay_set_random);
          }
        } catch (error) {
          // Error fetching settings, use defaults
        }
      }
      
      // If we still don't have valid values, use defaults
      if (!times || isNaN(times)) {
        times = 1;
      }
      if (!delay || isNaN(delay)) {
        delay = 3;
      }
      
      // Ensure canvas is initialized first
      const canvas = canvasManager.getCanvas();
      if (!canvas) {
        throw new Error("Canvas not available");
      }
      
      // Import and use SetCalibrateAction
      const { default: SetCalibrateAction } = await import('../../components/collected-dataset-customized/Action/SetCalibrateAction.jsx');
      
      const setCalibrateAction = new SetCalibrateAction({
        canvasRef: { current: canvas },
        setIsCapturing: (capturing) => {
          setIsCapturing(capturing);
        },
        setProcessStatus: (status) => {
          setProcessStatus(status);
        },
        setCurrentDot: (dot) => {
          setCurrentDot(dot);
        },
        triggerCameraAccess,
        onStatusUpdate: (status) => {
          if (status.processStatus) setProcessStatus(status.processStatus);
          if (status.isCapturing !== undefined) setIsCapturing(status.isCapturing);
        },
        saveImageToServer: true,
        setCaptureCounter,
        captureCounter: captureCounter,
        times: times,
        delay: delay,
        currentUserId: effectiveUserId,
        settings: settings?.[effectiveUserId] || {},
        hideTopBar: hideTopBar, // Pass the hideTopBar function to the action
        restoreTopBar: restoreTopBar // Pass the restoreTopBar function to the action
      });
      
      // Hide TopBar right before starting the actual action
      hideTopBar();
      
      await setCalibrateAction.handleSetCalibrate();
      
      // Increment counter after successful completion (per image)
      const currentImageIndex = canvasImageManager ? canvasImageManager.getCurrentImageIndex() : 0;
      const counterResult = counter(1, currentUserId, currentImageIndex);
      if (counterResult.success) {
        console.log(`Set Calibrate completed - Counter: ${counterResult.newCount} (Image ${currentImageIndex + 1})`);
      }
      
    } catch (error) {
      console.error("Calibration error:", error);
      setProcessStatus(`Calibration error: ${error.message}`);
      setIsCapturing(false);
    }
  };

  const handleClearAll = () => {
    // Clear canvas content (force clear even if image exists)
    // Always set yellow background in index.js
    canvasManager.clearCanvas();
    
    if (canvasImageManager) {
      // Clear any image from canvas image manager
      canvasImageManager.clearCanvas();
      canvasImageManager.currentImage = null;
    }
    
    // Reset states
    setProcessStatus('');
    setRemainingCaptures(0);
    setIsCapturing(false);
    setCountdownValue(null);
    setShowCanvas(true);
    setCurrentDot(null);
    
    // Clear clicked buttons tracking
    clearClickedButtons();
  };

  const handleToggleCamera = useCallback(() => {
    const newCameraState = !isCameraActive;
    
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
              selectedCameras: selectedCameras
            });
          }
        }, 100);
      }
    }, [isCameraActive, showCamera, onActionClick, selectedCameras, setCameraActivation]);

  // Add a proper action handler for camera preview
  const handleActionClick = useCallback((actionType, ...args) => {
    // Track button clicks for OrderRequire component
    const buttonNameMap = {
      'preview': 'Show preview',
      'randomDot': 'Random Dot',
      'setRandom': 'Set Random',
      'calibrate': 'Set Calibrate'
    };
    
    // Track all buttons for checkmarks, but exclude 'preview' from counter
    if (buttonNameMap[actionType]) {
      trackButtonClick(buttonNameMap[actionType]);
    }
    
    switch (actionType) {
      case 'preview':
        const shouldShow = args[0] !== undefined ? args[0] : !showCamera;
        
        // Control camera UI visibility
        setShowCamera(shouldShow);
        
        // Control camera active state
        setIsCameraActive(shouldShow);
        
        // Only activate camera when showing preview, but don't deactivate when hiding
        if (shouldShow) {
          setCameraActivation(true);
          setProcessStatus('Camera preview started');
          // Clear any existing warnings when camera is activated
          setShowWarning(false);
          setWarningMessage('');
        } else {
          setProcessStatus('Camera preview stopped');
          // Don't deactivate camera when hiding preview - keep it activated for other functions
        }
        break;
              case 'selectCamera':
          openCameraSelector();
          break;
      case 'metrics':
        if (typeof window !== 'undefined' && window.toggleMetrics) {
          window.toggleMetrics(!showMetrics);
        }
        setProcessStatus(`Metrics ${!showMetrics ? 'shown' : 'hidden'}`);
        break;
      case 'randomDot':
        handleRandomDot();
        break;
      case 'setRandom':
        handleSetRandom();
        break;
      case 'calibrate':
        handleSetCalibrate();
        break;
      case 'clearAll':
        handleClearAll();
        break;
      case 'toggleTopBar':
        const show = args[0] !== undefined ? args[0] : !showTopBar;
        if (typeof window !== 'undefined' && window.toggleTopBar) {
          window.toggleTopBar(show);
        }
        break;
      default:
        // Silent handling for unknown actions
        break;
    }
  }, [showCamera, showMetrics, showTopBar, handleRandomDot, handleSetRandom, handleSetCalibrate, handleClearAll, setCameraActivation, openCameraSelector, trackButtonClick]);

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
    // Don't deactivate camera when closing camera UI
    // This allows buttons to continue working with camera capture
    // setIsCameraActive(false); // Commented out to keep camera active
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
    handleToggleCamera
  }));

  return (
    <>
      <Head>
        <title>Camera Dataset Collection</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style jsx>{`
          /* Ensure main canvas is properly positioned and centered */
          #main-canvas {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 10 !important;
            background-color: yellow !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            outline: none !important;
            pointer-events: none !important;
          }
          
          /* Camera preview container for multiple cameras */
          .camera-preview-container {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            gap: 20px;
            z-index: 25;
            max-width: 90vw;
            max-height: 90vh;
          }
          
          /* Single camera layout */
          .camera-preview-container:has(> *:only-child) {
            flex-direction: column;
          }
          
          /* Dual camera layout */
          .camera-preview-container:has(> *:nth-child(2)) {
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: center;
            align-items: center;
          }
          
          /* Canvas notification animation */
          @keyframes slideInFromRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}</style>
      </Head>
      
      {/* Notification Messages Component */}
      <NotificationMessage
        isHydrated={isHydrated}
        backendStatus={backendStatus}
        showTopBar={showTopBar}
        showWarning={showWarning}
        warningMessage={warningMessage}
        showCameraNotification={showCameraNotification}
        cameraNotificationMessage={cameraNotificationMessage}
        showCountdown={showCountdown}
        countdownValue={countdownValue}
        showCanvasNotificationa={showCanvasNotification}
        canvasNotificationMessage={canvasNotificationMessage}
      />

      {isLoading ? (
        <div className="loading-container">
          <p>Loading user settings...</p>
        </div>
      ) : (
        <>
          {/* TopBar component */}
          {showTopBar && (
            <div className="topbar-container">
              <TopBar 
                key={`topbar-${showTopBar}-${showMetrics}`}
                onButtonClick={handleActionClick}
                onCameraAccess={() => setShowPermissionPopup(true)}
                outputText={statusMessage || outputText}
                onOutputChange={(text) => setOutputText(text)}
                canvasRef={{ current: canvasManager.getCanvas() }}
                showMetrics={showMetrics}
                isTopBarShown={showTopBar}
                isCanvasVisible={showCanvas}
                isCameraActive={isCameraActive}
                isCameraActivated={isCameraActivated}
                selectedCamerasCount={selectedCameras.length}
                clickedButtons={clickedButtons}
                buttonClickCount={getProgressInfo().buttonClickCount}
                currentImageTimes={getProgressInfo().currentImageTimes}
                currentImageIndex={getProgressInfo().currentImageIndex}
                totalImages={getProgressInfo().totalImages}
                currentImagePath={getProgressInfo().currentImagePath}
              />
            </div>
          )}
          


          {/* Show restore button when TopBar is hidden */}
          {!showTopBar && (
            <div className="restore-button-container">
              <button 
                className="restore-btn"
                onClick={() => setShowTopBar(true)}
                title="Show TopBar and Metrics"
              >
                ≡
              </button>
            </div>
          )}

          {/* Main preview area */}
          <div 
            ref={previewAreaRef}
            className={`main-preview-area ${
              showTopBar ? 'with-topbar' : 'without-topbar'
            }`}
          >
            {!showCamera ? (
              <>
                {/* Camera placeholder square - only show if needed */}
                {isHydrated && showCameraPlaceholder && (
                  <div className="camera-placeholder-square">
                    <div className="camera-placeholder-icon">📷</div>
                  </div>
                )}
              </>
            ) : null}
            
            {/* Camera components - Support up to 2 cameras */}
            {isHydrated && typeof window !== 'undefined' && (showCamera || isCameraActive) && (
              <div className={`${cameraStyles.cameraPreviewContainer} ${Array.isArray(selectedCameras) && selectedCameras.length > 1 ? cameraStyles.dualCamera : cameraStyles.singleCamera}`}>
                {Array.isArray(selectedCameras) && selectedCameras.length > 0 ? (
                  // Show selected cameras
                  selectedCameras.map((cameraId, index) => (
                    <DynamicCameraAccess
                      key={`camera-${cameraId}-${index}-${showCamera}-${isCameraActive}`}
                      isShowing={showCamera} 
                      isHidden={!showCamera && isCameraActive}
                      onClose={handleCameraClose}
                      onCameraReady={handleCameraReady}
                      selectedCameras={selectedCameras}
                      cameraIndex={index}
                      videoRef={videoRef}
                    />
                  ))
                ) : (
                  // Fallback to single camera if none selected
                  <DynamicCameraAccess
                    key={`camera-default-${showCamera}-${isCameraActive}`}
                    isShowing={showCamera} 
                    isHidden={!showCamera && isCameraActive}
                    onClose={handleCameraClose}
                    onCameraReady={handleCameraReady}
                    selectedCameras={Array.isArray(selectedCameras) ? selectedCameras : []}
                    cameraIndex={0}
                    videoRef={videoRef}
                  />
                )}
              </div>
            )}
            
            {/* Camera Selector Modal */}
            <CameraSelect
              showCameraSelector={showCameraSelector}
              setShowCameraSelector={setShowCameraSelector}
              availableCameras={availableCameras}
              setAvailableCameras={setAvailableCameras}
              selectedCameras={selectedCameras}
              setSelectedCameras={setSelectedCameras}
              setProcessStatus={setProcessStatus}
              getAvailableCameras={getAvailableCameras}
            />
            
            {/* Camera permission popup */}
            {isHydrated && typeof window !== 'undefined' && showPermissionPopup && (
              <div className="camera-permission-popup">
                <div className="camera-permission-dialog">
                  <h3 className="camera-permission-title">Camera Access Required</h3>
                  <p className="camera-permission-message">
                    This application needs access to your camera to function properly. 
                    When prompted by your browser, please click "Allow" to grant camera access.
                  </p>
                  <div className="camera-permission-buttons">
                    <button 
                      onClick={handlePermissionDenied}
                      className="camera-btn cancel"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handlePermissionAccepted}
                      className="camera-btn continue"
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
              width={metrics.width} 
              height={metrics.height} 
              distance={metrics.distance}
              isVisible={showMetrics}
            />
          )}

          {/* Image Overlay Component - renders images on top of yellow canvas */}
          {isHydrated && canvas && overlayImagePath && showOverlay && (
            <ImageOverlay 
              key={`image-overlay-${overlayImagePath}`}
              canvas={canvas}
              imagePath={overlayImagePath}
              isVisible={showOverlay}
            />
          )}

        </>
      )}
    </>
  );
});

// Create a client-only version of MainComponent
const MainComponentClient = dynamic(() => Promise.resolve(MainComponent), { ssr: false });

// Export the main component
export default function MainPage() {
  return <MainComponentClient />;
}

export { ActionButton, MainComponent };
