import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import TopBar from './components-gui/topBar';
import DisplayResponse from './components-gui/displayResponse';
import { showCapturePreview, drawRedDot, getRandomPosition, createCountdownElement, runCountdown } from '../../components/collected-dataset-customized/Action/countSave.jsx';
import { captureImagesAtPoint } from '../../components/collected-dataset-customized/Helper/savefile';
import { generateCalibrationPoints } from '../../components/collected-dataset-customized/Action/CalibratePoints.jsx';
import { useConsent } from '../../components/consent/ConsentContext';
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
    if (this.canvas && this.canvas.parentNode) {
      return this.canvas;
    }
    
    // Try to find existing canvas
    let canvas = document.querySelector('#tracking-canvas');
    
    if (!canvas) {
      // Create new canvas only if none exists
      canvas = document.createElement('canvas');
      canvas.className = 'tracking-canvas';
      canvas.id = 'tracking-canvas';
      console.log('Created new main canvas');
    } else {
      console.log('Found existing main canvas');
    }
    
    this.canvas = canvas;
    return canvas;
  }

  // Initialize the main canvas
  initializeCanvas(container = null) {
    if (this.isInitialized) {
      console.log('Canvas already initialized');
      return this.getCanvas();
    }
    
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
    console.log(`Main canvas initialized: ${canvas.width}x${canvas.height}`);
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

    // Update CSS to match
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.backgroundColor = 'yellow';
    
    // Link with other canvases if they exist
    this.linkWithOtherCanvases(canvas);
  }

  // Link this canvas with other canvases
  linkWithOtherCanvases(canvas) {
    // Find all other canvases on the page
    const allCanvases = document.querySelectorAll('canvas');
    
    allCanvases.forEach(otherCanvas => {
      if (otherCanvas !== canvas && otherCanvas.id !== 'tracking-canvas') {
        // Sync dimensions with other canvases
        otherCanvas.width = canvas.width;
        otherCanvas.height = canvas.height;
        otherCanvas.style.width = '100%';
        otherCanvas.style.height = '100%';
        
        // Clear and redraw other canvases
        const ctx = otherCanvas.getContext('2d');
        ctx.fillStyle = 'yellow';
        ctx.fillRect(0, 0, otherCanvas.width, otherCanvas.height);
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
      z-index: 99999 !important;
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
    console.log('Main canvas entered fullscreen mode');
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

    console.log('Main canvas exited fullscreen mode');
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
    });
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

    // Remove canvas completely from DOM
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

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

  // Refs
  const previewAreaRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const actionButtonGroupRef = useRef(null);

  // Add cache for settings
  const settingsCache = useRef(new Map());
  const lastSettingsUpdate = useRef(new Map());

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
      
      // Link with other canvases
      canvasManager.linkWithOtherCanvases(canvas);
      
      return true;
    },
    
    // Link with other canvases
    linkWithOtherCanvases: (canvas) => {
      canvasManager.linkWithOtherCanvases(canvas);
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

  // Set hydrated state after mount
  useEffect(() => {
    setIsHydrated(true);
    
    // Reset any existing canvas to prevent size accumulation
    if (typeof window !== 'undefined') {
      const existingCanvas = document.querySelector('#tracking-canvas');
      if (existingCanvas) {
        existingCanvas.width = 800;
        existingCanvas.height = 600;
        existingCanvas.style.width = '100%';
        existingCanvas.style.height = '100%';
        existingCanvas.style.backgroundColor = 'yellow';
      }
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
      }
    };
  }, []);

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
    
    // Initialize the global canvas manager
    const canvas = canvasManager.initializeCanvas();
    console.log('Global canvas initialized:', canvas ? 'success' : 'failed');
    
    // Sync all canvases after initialization
    if (canvas) {
      setTimeout(() => {
        canvasManager.linkWithOtherCanvases(canvas);
      }, 100);
    }
    
    return () => {
      // Cleanup canvas on component unmount
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
      }
      console.log('MainComponent cleanup - canvas removed');
    };
  }, [canvasManager, isPageActive]);

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

  // Make functions globally accessible
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.actionButtonFunctions = {
        handleRandomDot,
        handleSetRandom,
        handleSetCalibrate,
        handleClearAll
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.actionButtonFunctions;
      }
    };
  }, []);

  // Make toggleTopBar function available globally
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.toggleTopBar = (show) => {
        setShowTopBar(show);
        
        // Also hide metrics when hiding the top bar
        if (!show) {
          setShowMetrics(false);
        }
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.toggleTopBar;
      }
    };
  }, []);

  // Action handlers
  const handleRandomDot = async () => {
    if (isCapturing) return;

    try {
      // Import and use RandomDotAction
      const { default: RandomDotAction } = await import('../../components/collected-dataset-customized/Action/RandomDotAction.jsx');
      
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

  const handleSetRandom = async () => {
    if (isCapturing) return;
    
    try {
      // Import and use SetRandomAction
      const { default: SetRandomAction } = await import('../../components/collected-dataset-customized/Action/SetRandomAction.jsx');
      
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

  const handleSetCalibrate = async () => {
    if (isCapturing) return;
    
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
    setIsCameraActive(newCameraState);
    setShowCamera(newCameraState); // Link the camera display state with the active state
    
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
  }, [isCameraActive, showCamera, onActionClick, showHeadPose, showBoundingBox, showMask, showParameters]);

  // Add a proper action handler for camera preview
  const handleActionClick = useCallback((actionType, ...args) => {
    switch (actionType) {
      case 'preview':
        const shouldShow = args[0] !== undefined ? args[0] : !showCamera;
        setShowCamera(shouldShow);
        setIsCameraActive(shouldShow);
        setProcessStatus(shouldShow ? 'Camera preview started' : 'Camera preview stopped');
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
        console.log('Metrics toggle clicked, current state:', showMetrics);
        setShowMetrics(!showMetrics);
        setProcessStatus(`Metrics ${!showMetrics ? 'shown' : 'hidden'}`);
        break;
      default:
        // Silent handling for unknown actions
        break;
    }
  }, [showCamera, showMetrics, handleToggleHeadPose, handleToggleBoundingBox, handleToggleMask, handleToggleParameters]);

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
      padding: 0
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
            z-index: 9999;
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
          zIndex: 1100
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
          zIndex: 1010,
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          <strong>⚠️ {warningMessage}</strong>
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
              zIndex: 1000,
              height: '120px'
            }}>
              <TopBar 
                key={`topbar-${showTopBar}-${showMetrics}`}
                onButtonClick={handleActionClick}
                onCameraAccess={() => setShowPermissionPopup(true)}
                outputText={statusMessage || outputText}
                onOutputChange={(text) => setOutputText(text)}
                onToggleTopBar={(show) => setShowTopBar(show)}
                onToggleMetrics={() => setShowMetrics(!showMetrics)}
                canvasRef={canvasRef}
                showMetrics={showMetrics}
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
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#f5f5f5',
              overflow: 'hidden',
              zIndex: 1
            }}
          >
            {!showCamera ? (
              <>
                <div className="camera-preview-message" style={{
                  padding: '20px',
                  textAlign: 'center',
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '100%',
                  maxWidth: '600px',
                  zIndex: 5,
                  pointerEvents: 'none'
                }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Camera preview will appear here</p>
                  <p className="camera-size-indicator" style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                    Current window: {windowSize.percentage}% of screen width
                  </p>
                  
                  {/* Camera placeholder square */}
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
                        pointerEvents: 'none'
                      }}
                    >
                      <div style={{ fontSize: '1.5rem' }}>📷</div>
                    </div>
                  )}
                </div>
                
                {/* Canvas for eye tracking dots */}
                <div 
                  className="canvas-container" 
                  style={{ 
                    position: 'absolute', 
                    top: 0,
                    left: 0,
                    width: '100%', 
                    height: '100%',
                    backgroundColor: 'yellow',
                    overflow: 'hidden',
                    border: 'none',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'auto'
                  }}
                >
                  <canvas 
                    ref={canvasRef}
                    className="tracking-canvas"
                    style={{ 
                      width: '100%', 
                      height: '100%',
                      display: 'block',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      backgroundColor: 'yellow',
                      pointerEvents: 'auto'
                    }}
                  />
                </div>
              </>
            ) : null}
                  
            {/* Metrics info */}
            {isHydrated && showMetrics && (
              <DisplayResponse 
                width={metrics.width} 
                height={metrics.height} 
                distance={metrics.distance}
                isVisible={showMetrics}
              />
            )}
            {console.log('Rendering DisplayResponse, showMetrics:', showMetrics, 'isHydrated:', isHydrated)}
            
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