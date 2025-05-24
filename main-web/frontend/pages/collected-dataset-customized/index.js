// Modified index.js - Fixing canvas reference issues
import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import TopBar from './components-gui/topBar';
import DisplayResponse from './components-gui/displayResponse';
import { ActionButtonGroup } from './components-gui/actionButton';
import { showCapturePreview, captureImagesAtPoint, drawRedDot, getRandomPosition, runCountdown } from '../../components/collected-dataset-customized/Action/countSave';
// import { generateCalibrationPoints } from '../../components/collected-dataset-customized/Action/CalibratePoints';
import { useConsent } from '../../components/consent/ConsentContext';
import { useRouter } from 'next/router';

// Dynamically load the video processor component (not the hook directly)
const VideoProcessorComponent = dynamic(
  () => import('./components-gui/VideoProcessorComponent'),
  { ssr: false }
);

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

export default function CollectedDatasetPage() {
  const router = useRouter();
  const { userId: consentUserId } = useConsent();
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

  // Refs
  const previewAreaRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const actionButtonGroupRef = useRef(null);

  // Set hydrated state after mount
  useEffect(() => {
    setIsHydrated(true);
  }, []);

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
          const response = await fetch(`/user-preferences/${router.query.userId}`, {
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
      }
    };

    if (isHydrated) {
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [isHydrated]);

  // Initialize settings based on user data
  useEffect(() => {
    if (userData && consentUserId) {
      console.log('Initializing settings for user:', consentUserId, userData);
      
      // Initialize user-specific settings
      if (userData.preferences) {
        const { preferences } = userData;
        
        // Update camera settings if available
        if (preferences.cameraSettings) {
          const { showHeadPose, showBoundingBox, showMask, showParameters } = preferences.cameraSettings;
          setShowHeadPose(showHeadPose || false);
          setShowBoundingBox(showBoundingBox || false);
          setShowMask(showMask || false);
          setShowParameters(showParameters || false);
        }
        
        // Update other settings as needed
        if (preferences.metrics) {
          setShowMetrics(preferences.metrics.show || true);
        }
        
        if (preferences.topBar) {
          setShowTopBar(preferences.topBar.show || true);
        }
      }
    }
  }, [userData, consentUserId]);

  // Improved get canvas function that tries multiple methods
  const getMainCanvas = () => {
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
  
  // Check if we're on the client or server
  const isClient = typeof window !== 'undefined';
  
  // Add effect to initialize canvas and make it globally available
  useEffect(() => {
    if (!isClient || !isHydrated) return;
    
    // Debug info to verify canvas size and availability
    const canvas = canvasRef.current;
    if (canvas) {
      console.log("Index.js: Canvas initialized", {
        width: canvas.width,
        height: canvas.height
      });
      
      // Make canvas EXPLICITLY available globally
      window.whiteScreenCanvas = canvas;
      
      // Also store canvas dimensions
      window.canvasDimensions = {
        width: canvas.width,
        height: canvas.height
      };
    } else {
      console.warn("Canvas reference is not available during initialization");
    }
    
    // Expose canvas initialization function globally
    window.initializeCanvas = (canvas, parent) => {
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
        
        // Update global reference
        window.whiteScreenCanvas = canvas;
        window.canvasDimensions = {
          width: canvas.width,
          height: canvas.height
        };
        
        return true;
      } catch (error) {
        console.error('[initializeCanvas] Error initializing canvas:', error);
        return false;
      }
    };
    
    // Check canvas visibility and force initialization after a brief delay
    setTimeout(() => {
      const canvas = getMainCanvas();
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        console.log("Canvas initial visibility check:", {
          dimensions: `${canvas.width}x${canvas.height}`,
          rectSize: `${rect.width}x${rect.height}`,
          isVisible: (rect.width > 0 && rect.height > 0)
        });
        
        // Force initialization if needed
        adjustCanvasDimensions();
      } else {
        console.warn("Canvas not found during visibility check");
      }
    }, 500);
    
    return () => {
      delete window.whiteScreenCanvas;
      delete window.canvasDimensions;
      delete window.initializeCanvas;
    };
  }, [isHydrated]);
  // Improved canvas dimensions adjustment
  const adjustCanvasDimensions = () => {
    if (!isClient || !isHydrated || !previewAreaRef.current) return;
    
    const canvas = getMainCanvas();
    if (!canvas) {
      console.warn("No canvas found to adjust dimensions");
      return;
    }
    
    const container = previewAreaRef.current;
    
    // Get the size of the preview area
    const rect = container.getBoundingClientRect();
    
    // Calculate proper height based on top bar visibility
    const topBarHeight = showTopBar ? 120 : 0; // Adjust this value based on your top bar's actual height
    
    console.log("Adjusting canvas dimensions", {
      containerWidth: rect.width,
      containerHeight: rect.height,
      topBarVisible: showTopBar,
      calculatedHeight: rect.height
    });
    
    // Set canvas dimensions to match container size with top bar adjustment
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Clear the canvas
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    console.log(`Canvas dimensions adjusted: ${canvas.width}x${canvas.height}`);
    
    // Update global reference with current dimensions
    window.whiteScreenCanvas = canvas;
    window.canvasDimensions = {
      width: canvas.width,
      height: canvas.height
    };
  };

  // Create a capture folder on component mount
  useEffect(() => {
    if (!captureFolder && isClient && isHydrated) {
      const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
      setCaptureFolder(`session_${timestamp}`);
      console.log(`Created capture folder: session_${timestamp}`);
    }
  }, [captureFolder, isClient, isHydrated]);
  
  // Check backend connection on mount
  useEffect(() => {
    if (!isClient || !isHydrated) return; // Skip on server or before hydration
    
    const checkBackendConnection = async () => {
      try {
        const response = await fetch('/api/check-backend-connection');
        const data = await response.json();
        setBackendStatus(data.connected ? 'connected' : 'disconnected');
        console.log(`Backend connection: ${data.connected ? 'OK' : 'Failed'}`);
        
        // Show status in output text
        setOutputText(`Backend ${data.connected ? 'connected' : 'disconnected - using mock mode'}`);
      } catch (error) {
        console.error('Error checking backend connection:', error);
        setBackendStatus('disconnected');
        setOutputText('Backend disconnected - using mock mode');
      }
    };

    checkBackendConnection();
    
    // Welcome message after backend check
    setTimeout(() => {
      setOutputText('Camera system ready. Click "Show Preview" to start camera.');
    }, 2000);
  }, [isHydrated]);

  // Add styles to document head for button highlighting
  useEffect(() => {
    if (!isClient || !isHydrated) return;
    
    // Create a style element
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(0, 102, 204, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(0, 102, 204, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 102, 204, 0); }
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .btn-highlight {
        animation: pulse 1.5s infinite;
        background-color: #0099ff !important;
        color: white !important;
        transform: scale(1.05);
        transition: all 0.3s ease;
      }
      
      .warning-banner {
        animation: fadeIn 0.3s ease-in-out;
      }
    `;
    document.head.appendChild(style);
    
    // Clean up
    return () => {
      document.head.removeChild(style);
    };
  }, [isHydrated]);
  
  // Make toggleTopBar function available globally
  useEffect(() => {
    if (!isClient || !isHydrated) return;
    
    // Make toggleTopBar available to other components
    window.toggleTopBar = (show) => {
      setShowTopBar(show);
      
      // Also hide metrics when hiding the top bar
      if (!show) {
        setShowMetrics(false);
      }
      
      // Adjust canvas dimensions after toggling
      setTimeout(adjustCanvasDimensions, 100);
    };
    
    return () => {
      // Clean up
      delete window.toggleTopBar;
    };
  }, [isHydrated]);

  // Toggle camera function
  const toggleCamera = (shouldEnable) => {
    if (!isClient || !isHydrated) return;
    
    if (shouldEnable) {
      setShowCamera(true);
      setShowCameraPlaceholder(false);
      setOutputText('Camera preview started');
    } else {
      setShowCamera(false);
      setShowCameraPlaceholder(false);
      setOutputText('Camera preview stopped');
    }
  };
  
  // Handler for action button clicks
  const handleActionButtonClick = (actionType, params) => {
    if (!isClient || !isHydrated) return;
    
    // Special case for toggling the top bar
    if (actionType === 'toggleTopBar') {
      // const newTopBarState = value !== undefined ? !!value : !showTopBar;
      let newTopBarState;
    
      if (typeof params === 'boolean') {
        newTopBarState = params;
      } else if (params && typeof params.value !== 'undefined') {
        newTopBarState = !!params.value;
      } else {
        newTopBarState = !showTopBar;
      }
      setShowTopBar(newTopBarState);
      
      // Also hide metrics when hiding the top bar
      if (!newTopBarState) {
        setShowMetrics(false);
      }
      
      setOutputText(`TopBar ${newTopBarState ? 'shown' : 'hidden'}${!newTopBarState ? ', Metrics hidden' : ''}`);
      
      // Adjust canvas dimensions after toggling
      setTimeout(adjustCanvasDimensions, 100);
      return;
    }
    const canvas = getMainCanvas();
    setShowWarning(false);
    
    // Clear any existing warnings
    const safeParams = params || {};
  
    // Use safeParams instead of controlValues
    const randomTimes = safeParams.randomTimes || 1;
    const delaySeconds = safeParams.delaySeconds || 3;

    switch (actionType) {
      case 'preview':
        // Toggle camera state
        if (showCamera) {
          toggleCamera(false);
        } else if (cameraPermissionGranted) {
          toggleCamera(true);
        } else {
          // Otherwise show permission popup
          setShowPermissionPopup(true);
          setOutputText('Opening camera preview');
          setShowCameraPlaceholder(true);
        }
        break;
        
      case 'setRandom':
        setOutputText('Starting random sequence...');
        setShowTopBar(false);
        if (showCamera) {
          toggleCamera(false);
        }
        // Use the imported module approach - similar to calibrate
        if (actionButtonGroupRef.current && actionButtonGroupRef.current.handleSetRandom) {
          // Use the reference method if available
          console.log('Using ActionButtonGroup ref method for Set Random');
          actionButtonGroupRef.current.handleSetRandom();
        } 
        else if (typeof window !== 'undefined' && window.actionButtonFunctions && 
          typeof window.actionButtonFunctions.handleSetRandom === 'function') {
          // Fallback to global method
          console.log('Using global bridge method for Set Random');
          window.actionButtonFunctions.handleSetRandom();
        }
        else {
          // Make sure we have a canvas to work with
          const canvas = getMainCanvas();
          if (!canvas) {
            console.error("Canvas not found for random sequence");
            setOutputText("Error: Canvas not available for random sequence");
            setShowTopBar(true);
            return;
          }
          
          // Get control values from the TopBar
          const timeInput = document.querySelector('.control-input-field');
          const delayInput = document.querySelectorAll('.control-input-field')[1];
          
          // Default values if inputs can't be found
          let times = 1;
          let delay = 3;
          
          // Parse input values if available
          if (timeInput) {
            const parsedTime = parseInt(timeInput.value, 10);
            if (!isNaN(parsedTime) && parsedTime > 0) {
              times = parsedTime;
            }
          }
          
          if (delayInput) {
            const parsedDelay = parseInt(delayInput.value, 10);
            if (!isNaN(parsedDelay) && parsedDelay > 0) {
              delay = parsedDelay;
            }
          }
          
          // Load all required modules first, then proceed with execution
          Promise.all([
            import('../../components/collected-dataset-customized/Action/countSave'),
            import('../../components/collected-dataset-customized/Helper/savefile')
          ]).then(async ([
            countSaveModule,
            savefileModule
          ]) => {
            // Destructure the imported modules
            const { getRandomPosition, drawRedDot, runCountdown, showCapturePreview } = countSaveModule;
            const { captureImagesAtPoint } = savefileModule;
            
            try {
              // Process all captures sequentially
              let successCount = 0;
              let currentCapture = 1;
              
              while (currentCapture <= times) {
                // Update status for current capture
                setOutputText(`Capture ${currentCapture} of ${times}`);
                
                // Clear canvas before each capture
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Generate random position for this capture
                const position = getRandomPosition(canvas, 20);
                
                // Draw the dot
                drawRedDot(ctx, position.x, position.y);
                
                // Create a redrawInterval to ensure dot stays visible
                let redrawInterval = setInterval(() => {
                  drawRedDot(ctx, position.x, position.y, 12, false);
                }, 200);
                
                // Run countdown and wait for it to complete
                await new Promise(resolve => {
                  runCountdown(
                    position,
                    canvas,
                    (status) => {
                      // Update UI based on status
                      if (status.processStatus) {
                        setOutputText(`Capture ${currentCapture}/${times}: ${status.processStatus}`);
                      }
                    },
                    resolve // This will be called when countdown completes
                  );
                });
                
                // Clear redrawInterval after countdown
                clearInterval(redrawInterval);
                
                // Wait briefly after countdown
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Capture images at this point
                try {
                  const captureResult = await captureImagesAtPoint({
                    point: position,
                    captureCount: captureCounter,
                    canvasRef: { current: canvas },
                    setCaptureCount: setCaptureCounter,
                    showCapturePreview
                  });
                  
                  if (captureResult && (captureResult.screenImage || captureResult.success)) {
                    successCount++;
                  }
                  
                  // Increment counter
                  setCaptureCounter(prev => prev + 1);
                } catch (error) {
                  console.error(`Error capturing point ${currentCapture}:`, error);
                }
                
                // Wait between captures for the specified delay time
                if (currentCapture < times) {
                  setOutputText(`Waiting ${delay}s before next capture...`);
                  await new Promise(resolve => setTimeout(resolve, delay * 1000));
                }
                
                // Move to next capture
                currentCapture++;
              }
              
              // Sequence complete
              setOutputText(`Random capture sequence completed: ${successCount}/${times} captures successful`);
              
            } catch (error) {
              console.error("Random sequence error:", error);
              setOutputText(`Random sequence error: ${error.message}`);
            } finally {
              // Show TopBar again
              setTimeout(() => setShowTopBar(true), 2000);
            }
          }).catch(error => {
            console.error("Failed to import required modules:", error);
            setOutputText(`Error: ${error.message}`);
            setShowTopBar(true);
          });
        }
        break;

      case 'randomDot':
        setOutputText('Random dot action triggered');
        setShowTopBar(false);
        if (showCamera) {
          toggleCamera(false);
        }
        console.log('Attempting to access Random Dot functionality');
        
        // Use the random dot functionality from actionButton.js by delegating to ActionButtonGroup
        // This assumes you have a ref to the ActionButtonGroup component
        if (actionButtonGroupRef.current && actionButtonGroupRef.current.handleRandomDot) {
          console.log('Using ref method');
          actionButtonGroupRef.current.handleRandomDot();
        } else if (typeof window !== 'undefined' && window.actionButtonFunctions && 
          typeof window.actionButtonFunctions.handleRandomDot === 'function') {
          console.log('Using global bridge method');
          window.actionButtonFunctions.handleRandomDot();
        } else {
          // Fallback implementation
          const canvas = getMainCanvas();
          if (!canvas) {
            console.error("Canvas not found for random dot action");
            setOutputText("Error: Canvas not available for random dot");
            setShowTopBar(true); // Show TopBar again if there's an error
            break;
          }
          
          const parent = previewAreaRef.current;
          if (!parent) {
            console.error("Parent not found for canvas");
            setOutputText("Error: Canvas parent not available");
            setShowTopBar(true);
            break;
          }
          
          // Initialize canvas explicitly
          canvas.width = parent.clientWidth || 800;
          canvas.height = parent.clientHeight || 600;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          console.log(`Canvas ready for random dot: ${canvas.width}x${canvas.height}`);
          
          // Update global reference
          window.whiteScreenCanvas = canvas;
          
          // Generate random position
          const position = getRandomPosition(canvas, 20);
          
          // Draw the dot using the imported function
          const dot = drawRedDot(ctx, position.x, position.y, 8, false);
          console.log(`Random dot drawn at: ${position.x}, ${position.y}`);
          
          // Start a countdown for capture
          runCountdown(
            position,
            canvas,
            (status) => {
              // Update UI based on status
              if (status.processStatus) {
                setOutputText(status.processStatus);
              }
            },
            () => {
              // Enable camera before capture
              // triggerCameraAccess(true);
              
              // Wait briefly for camera to initialize
              setTimeout(() => {
                // Use the directly imported captureImagesAtPoint from the Helper/savefile.js
                import('../../components/collected-dataset-customized/Helper/savefile').then(({ captureImagesAtPoint }) => {
                  captureImagesAtPoint({
                    point: position,
                    captureCount: captureCounter,
                    canvasRef: { current: canvas },
                    setCaptureCount: setCaptureCounter,
                    showCapturePreview
                  }).then(() => {
                    setCaptureCounter(prev => prev + 1);
                    
                    // Show TopBar again after capture
                    setTimeout(() => {
                      setShowTopBar(true);
                    }, 2200);
                  }).catch(err => {
                    console.error("Error capturing images:", err);
                    setOutputText(`Error: ${err.message}`);
                    setShowTopBar(true);
                  });
                }).catch(err => {
                  console.error("Error importing savefile module:", err);
                  setOutputText(`Error: ${err.message}`);
                  setShowTopBar(true);
                });
              }, 500);
            }
          );
        }
        break;
      case 'headPose':
        const newHeadPoseState = !showHeadPose;
        setShowHeadPose(newHeadPoseState);
        setOutputText(`Head pose visualization ${newHeadPoseState ? 'enabled' : 'disabled'}`);
        if (newHeadPoseState && !showCamera) {
          setShowCameraPlaceholder(true);
        } else if (!newHeadPoseState && !showBoundingBox && !showMask && !showParameters) {
          setShowCameraPlaceholder(false);
        }
        
        // Update processor options if camera is active
        if (showCamera && window.videoProcessor) {
          window.videoProcessor.updateOptions({
            ...window.videoProcessor.options,
            showHeadPose: newHeadPoseState
          });
        }
        break;
        
      case 'boundingBox':
        const newBoundingBoxState = !showBoundingBox;
        setShowBoundingBox(newBoundingBoxState);
        setOutputText(`Bounding box ${newBoundingBoxState ? 'shown' : 'hidden'}`);
        if (newBoundingBoxState && !showCamera) {
          setShowCameraPlaceholder(true);
        } else if (!newBoundingBoxState && !showHeadPose && !showMask && !showParameters) {
          setShowCameraPlaceholder(false);
        }
        
        // Update processor options if camera is active
        if (showCamera && window.videoProcessor) {
          window.videoProcessor.updateOptions({
            ...window.videoProcessor.options,
            showBoundingBox: newBoundingBoxState
          });
        }
        break;
        
      case 'mask':
        const newMaskState = !showMask;
        setShowMask(newMaskState);
        setOutputText(`Mask ${newMaskState ? 'shown' : 'hidden'}`);
        if (newMaskState && !showCamera) {
          setShowCameraPlaceholder(true);
        } else if (!newMaskState && !showHeadPose && !showBoundingBox && !showParameters) {
          setShowCameraPlaceholder(false);
        }
        
        // Update processor options if camera is active
        if (showCamera && window.videoProcessor) {
          window.videoProcessor.updateOptions({
            ...window.videoProcessor.options,
            showMask: newMaskState
          });
        }
        break;
        
      case 'parameters':
        const newParametersState = !showParameters;
        setShowParameters(newParametersState);
        setOutputText(`Parameters ${newParametersState ? 'shown' : 'hidden'}`);
        if (newParametersState && !showCamera) {
          setShowCameraPlaceholder(true);
        } else if (!newParametersState && !showHeadPose && !showBoundingBox && !showMask) {
          setShowCameraPlaceholder(false);
        }
        
        // Update processor options if camera is active
        if (showCamera && window.videoProcessor) {
          window.videoProcessor.updateOptions({
            ...window.videoProcessor.options,
            showParameters: newParametersState
          });
        }
        break;
        
      // Fixed calibrate case handler in index.js
      case 'calibrate':
        setOutputText('Starting calibration sequence...');
        setShowTopBar(false);
        if (showCamera) {
          toggleCamera(false);
        }
        if (actionButtonGroupRef.current && actionButtonGroupRef.current.handleSetCalibrate) {
          // Use the reference method if available
          console.log('Using ActionButtonGroup ref method for calibration');
          actionButtonGroupRef.current.handleSetCalibrate();
        } 
        else if (typeof window !== 'undefined' && window.actionButtonFunctions && 
          typeof window.actionButtonFunctions.handleSetCalibrate === 'function') {
          // Fallback to global method
          console.log('Using global bridge method for calibration');
          window.actionButtonFunctions.handleSetCalibrate();
        }
        else {
          // Make sure we have a canvas to work with
          const canvas = getMainCanvas();
          if (!canvas) {
            console.error("Canvas not found for calibration");
            setOutputText("Error: Canvas not available for calibration");
            setShowTopBar(true);
            return;
          }
          
          // Load all required modules first, then proceed with execution
          Promise.all([
            import('../../components/collected-dataset-customized/Action/CalibratePoints'),
            import('../../components/collected-dataset-customized/Action/countSave'),
            import('../../components/collected-dataset-customized/Helper/savefile')
          ]).then(async ([
            calibratePointsModule,
            countSaveModule,
            savefileModule
          ]) => {
            // Destructure the imported modules
            const { generateCalibrationPoints } = calibratePointsModule;
            const { drawRedDot, runCountdown, showCapturePreview } = countSaveModule;
            const { captureImagesAtPoint } = savefileModule;
            
            try {
              // Generate calibration points
              const points = generateCalibrationPoints(canvas.width, canvas.height);
              
              if (!points || points.length === 0) {
                throw new Error("Failed to generate calibration points");
              }
              
              // Create status indicator
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
                padding: '8px 12px';
                border-radius: 6px;
                z-index: 9999;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
              `;
              statusIndicator.textContent = 'Calibration: Initializing...';
              document.body.appendChild(statusIndicator);
              
              // Access webcam before starting calibration if available
              if (typeof triggerCameraAccess === 'function') {
                triggerCameraAccess(true);
                await new Promise(resolve => setTimeout(resolve, 500));
              }
              
              // Process points sequentially
              let successCount = 0;
              
              for (let i = 0; i < points.length; i++) {
                const point = points[i];
                
                statusIndicator.textContent = `Calibration: Point ${i + 1}/${points.length}`;
                setOutputText(`Processing calibration point ${i + 1}/${points.length}`);
                
                // Clear the canvas before drawing new point
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw the dot
                drawRedDot(ctx, point.x, point.y);
                
                // Run countdown
                await new Promise(resolve => {
                  runCountdown(
                    point,
                    canvas,
                    (status) => {
                      if (status.processStatus) {
                        setOutputText(status.processStatus);
                      }
                    },
                    resolve // This will be called when countdown completes
                  );
                });
                
                // Capture images at this point
                try {
                  const captureResult = await captureImagesAtPoint({
                    point: point,
                    captureCount: captureCounter,
                    canvasRef: { current: canvas },
                    setCaptureCount: setCaptureCounter,
                    showCapturePreview: showCapturePreview
                  });
                  
                  if (captureResult && (captureResult.screenImage || captureResult.success)) {
                    successCount++;
                  }
                  
                  // Increment counter
                  setCaptureCounter(prev => prev + 1);
                } catch (error) {
                  console.error(`Error capturing point ${i+1}:`, error);
                }
                
                // Wait between points
                await new Promise(resolve => setTimeout(resolve, 1200));
              }
              
              // Calibration complete
              statusIndicator.textContent = `Calibration complete: ${successCount}/${points.length} points`;
              setOutputText(`Calibration completed: ${successCount}/${points.length} points captured`);
              
              // Remove the status indicator after a delay
              setTimeout(() => {
                if (statusIndicator.parentNode) {
                  statusIndicator.parentNode.removeChild(statusIndicator);
                }
              }, 3000);
            } catch (error) {
              console.error("Calibration error:", error);
              setOutputText(`Calibration error: ${error.message}`);
            } finally {
              // Show TopBar again
              setTimeout(() => setShowTopBar(true), 2000);
            }
          }).catch(error => {
            console.error("Failed to import required modules:", error);
            setOutputText(`Calibration error: ${error.message}`);
            setShowTopBar(true);
          });
        }
        break;
        
      case 'clearAll':
        // Clear canvas
        // const canvas = getMainCanvas();
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          setOutputText('Canvas cleared');
        }
        break;
        
      default:
        setOutputText(`Action triggered: ${actionType}`);
    }
  };

  const handlePermissionAccepted = () => {
    if (!isClient || !isHydrated) return;
    
    setShowPermissionPopup(false);
    setCameraPermissionGranted(true);
    toggleCamera(true);
  };

  const handlePermissionDenied = () => {
    if (!isClient || !isHydrated) return;
    
    setShowPermissionPopup(false);
    setShowCameraPlaceholder(false);
    setOutputText('Camera permission denied');
  };

  const handleCameraClose = () => {
    if (!isClient || !isHydrated) return;
    
    toggleCamera(false);
  };

  const handleCameraReady = (dimensions) => {
    if (!isClient || !isHydrated) return;
    
    setMetrics({
      width: dimensions.width,
      height: dimensions.height,
      distance: dimensions.distance || '---'
    });
    setOutputText(`Camera ready: ${dimensions.width}x${dimensions.height}`);
  };

  // Toggle top bar function
  const toggleTopBar = (show) => {
    const newTopBarState = show !== undefined ? show : !showTopBar;
    setShowTopBar(newTopBarState);
    
    // Also hide metrics when hiding the top bar
    if (!newTopBarState) {
      setShowMetrics(false);
    }
    
    setOutputText(`TopBar ${newTopBarState ? 'shown' : 'hidden'}${!newTopBarState ? ', Metrics hidden' : ''}`);
    
    // Wait for state update and DOM changes, then adjust canvas
    setTimeout(adjustCanvasDimensions, 100);
  };

  // Toggle metrics function
  const toggleMetrics = () => {
    if (showTopBar) {
      setShowMetrics(prev => !prev);
      setOutputText(`Metrics ${!showMetrics ? 'shown' : 'hidden'}`);
    } else {
      // If topBar is hidden, we can't show metrics
      setOutputText('Cannot show metrics when TopBar is hidden');
    }
  };

  // Function to trigger camera access
  const triggerCameraAccess = (forceEnable) => {
    if (forceEnable) {
      // Try to enable camera directly
      if (window.videoProcessor) {
        setShowCamera(true);
        setShowCameraPlaceholder(false);
        setCameraPermissionGranted(true);
        
        // Start video processing with current options
        window.videoProcessor.startVideoProcessing({
          showHeadPose,
          showBoundingBox,
          showMask,
          showParameters,
          showProcessedImage: true
        });
        
        return true;
      }
      return false;
    }
    
    // Just toggle current state if not forcing
    if (cameraPermissionGranted) {
      toggleCamera(!showCamera);
      return true;
    } else {
      setShowPermissionPopup(true);
      return false;
    }
  };

  // Dynamic class to reflect current window size
  const getSizeClass = () => {
    const { percentage } = windowSize;
    if (percentage < 35) return 'window-size-tiny';
    if (percentage < 50) return 'window-size-small';
    if (percentage < 70) return 'window-size-medium';
    return 'window-size-large';
  };

  // Add this function to handle settings visibility
  const handleSettingsVisibility = (isVisible) => {
    setShowSettings(isVisible);
  };

  // Add this effect to listen for settings visibility changes
  useEffect(() => {
    const handleSettingsMessage = (event) => {
      if (event.data.type === 'SHOW_SETTINGS') {
        setShowSettings(event.data.show);
      }
    };

    window.addEventListener('message', handleSettingsMessage);
    return () => {
      window.removeEventListener('message', handleSettingsMessage);
    };
  }, []);

  // Listen for user ID changes
  useEffect(() => {
    const handleUserIdChange = (event) => {
      if (event.detail && event.detail.type === 'userIdChange') {
        setCurrentUserId(event.detail.userId);
        // Dispatch event to update settings for the new user
        const event = new CustomEvent('captureSettingsUpdate', {
          detail: {
            type: 'captureSettings',
            userId: event.detail.userId
          }
        });
        window.dispatchEvent(event);
      }
    };

    window.addEventListener('userIdChange', handleUserIdChange);
    return () => {
      window.removeEventListener('userIdChange', handleUserIdChange);
    };
  }, []);

  // Initialize settings when component mounts
  useEffect(() => {
    if (consentUserId) {
      // Set the current user ID
      setCurrentUserId(consentUserId);
      
      // Dispatch event to update settings for this user
      const event = new CustomEvent('captureSettingsUpdate', {
        detail: {
          type: 'captureSettings',
          userId: consentUserId
        }
      });
      window.dispatchEvent(event);
    }
  }, [consentUserId]);

  // Load settings from backend when component mounts
  useEffect(() => {
    const loadSettings = async () => {
      if (!consentUserId) return;
      
      try {
        const response = await fetch(`/api/data-center/settings/${consentUserId}`);
        if (!response.ok) {
          throw new Error('Failed to load settings');
        }
        const loadedSettings = await response.json();
        
        // Wait for the component to be mounted and ref to be initialized
        const waitForRef = (retries = 5) => {
          if (actionButtonGroupRef.current && typeof actionButtonGroupRef.current.updateSettings === 'function') {
            // Update the settings for this user
            actionButtonGroupRef.current.updateSettings(loadedSettings);
            
            // Dispatch event to update UI
            const event = new CustomEvent('captureSettingsUpdate', {
              detail: {
                type: 'captureSettings',
                userId: consentUserId,
                times: loadedSettings.times,
                delay: loadedSettings.delay
              }
            });
            window.dispatchEvent(event);
          } else if (retries > 0) {
            setTimeout(() => waitForRef(retries - 1), 500);
          } else {
            console.warn('ActionButtonGroup ref not initialized after retries');
          }
        };
        
        waitForRef();
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    // Add a small delay to ensure components are mounted
    setTimeout(loadSettings, 1000);
  }, [consentUserId]);

  // Add polling for real-time updates
  useEffect(() => {
    const fetchUpdates = async () => {
      if (!consentUserId) return;
      
      try {
        const response = await fetch(`/api/data-center/settings/${consentUserId}`);
        if (!response.ok) throw new Error('Failed to fetch settings');
        
        const settings = await response.json();
        if (actionButtonGroupRef.current && actionButtonGroupRef.current.updateSettings) {
          actionButtonGroupRef.current.updateSettings(settings);
        }

        // You can add image fetching logic here if needed
      } catch (error) {
        console.error('Error fetching updates:', error);
      }
    };

    // Initial fetch
    fetchUpdates();

    // Set up polling interval
    const interval = setInterval(fetchUpdates, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [consentUserId]);

  // Add event listeners for settings and image updates
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      if (event.detail?.type === 'captureSettings' && event.detail?.userId === consentUserId) {
        const { times, delay } = event.detail;
        if (actionButtonGroupRef.current && actionButtonGroupRef.current.updateSettings) {
          actionButtonGroupRef.current.updateSettings({ times, delay });
        }
      }
    };

    const handleImageUpdate = (event) => {
      if (event.detail?.type === 'image' && event.detail?.userId === consentUserId) {
        const { image } = event.detail;
        // Update image in the UI if needed
        // You can add your image update logic here
      }
    };

    window.addEventListener('captureSettingsUpdate', handleSettingsUpdate);
    window.addEventListener('imageUpdate', handleImageUpdate);

    return () => {
      window.removeEventListener('captureSettingsUpdate', handleSettingsUpdate);
      window.removeEventListener('imageUpdate', handleImageUpdate);
    };
  }, [consentUserId]);

  // Load settings for a specific user
  const loadSettings = async (userId) => {
    try {
      console.log('Loading settings for user:', userId);
      const response = await fetch(`/api/data-center/settings/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch settings');
      
      const userSettings = await response.json();
      console.log('Fetched settings:', userSettings);
      
      // Dispatch settings update event
      const event = new CustomEvent('captureSettingsUpdate', {
        detail: {
          type: 'captureSettings',
          userId,
          ...userSettings
        }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Handle user ID changes
  useEffect(() => {
    if (consentUserId && consentUserId !== currentUserId) {
      console.log('User ID changed in index.js:', consentUserId);
      setCurrentUserId(consentUserId);
      
      // Dispatch event to notify other components
      const event = new CustomEvent('userIdChange', {
        detail: { userId: consentUserId }
      });
      window.dispatchEvent(event);
      
      // Load settings for the new user
      loadSettings(consentUserId);
    }
  }, [consentUserId, currentUserId]);

  // Listen for settings updates
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      if (event.detail && event.detail.type === 'captureSettings') {
        const { userId, times, delay } = event.detail;
        if (userId === currentUserId) {
          // Update the settings for this user
          if (actionButtonGroupRef.current && actionButtonGroupRef.current.updateSettings) {
            actionButtonGroupRef.current.updateSettings({
              times: times || 1,
              delay: delay || 3
            });
          }
        }
      }
    };

    window.addEventListener('captureSettingsUpdate', handleSettingsUpdate);
    return () => {
      window.removeEventListener('captureSettingsUpdate', handleSettingsUpdate);
    };
  }, [currentUserId]);

  return (
    <div className={`main-container ${getSizeClass()}`}>
      <Head>
        <title>Camera Dataset Collection</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
          {/* Load the video processor component */}
          {isHydrated && isClient && <VideoProcessorComponent />}
          
          {/* TopBar component with onButtonClick handler - conditionally rendered */}
          {showTopBar && (
            <TopBar 
              onButtonClick={handleActionButtonClick}
              onCameraAccess={() => setShowPermissionPopup(true)}
              outputText={statusMessage || outputText}
              onOutputChange={(text) => setOutputText(text)}
              onToggleTopBar={toggleTopBar}
              onToggleMetrics={toggleMetrics}
              canvasRef={canvasRef}
            />
          )}
          
          {/* Show restore button when TopBar is hidden - positioned at top right */}
          {!showTopBar && (
            <div className="restore-button-container" style={{
              position: 'fixed',
              top: '10px',
              right: '10px',
              zIndex: 1000
            }}>
              <button 
                className="restore-btn"
                onClick={() => toggleTopBar(true)}
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
              position: 'relative',
              backgroundColor: '#f5f5f5',
              overflow: 'hidden'
            }}
          >
            {/* Action buttons for camera control - moved outside conditional rendering */}
            <div className="camera-action-buttons-container" style={{ 
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              maxWidth: '600px',
              width: '100%',
              padding: '0 20px'
            }}>
              <ActionButtonGroup
                ref={actionButtonGroupRef}
                triggerCameraAccess={triggerCameraAccess}
                isCompactMode={windowSize.width < 768}
                onActionClick={handleActionButtonClick}
              />
            </div>

            {!showCamera ? (
              <>
                <div className="camera-preview-message" style={{
                  padding: '20px',
                  textAlign: 'center',
                  position: showTopBar ? 'relative' : 'absolute',
                  width: '100%',
                  zIndex: 5
                }}>
                  <p>Camera preview will appear here</p>
                  <p className="camera-size-indicator">Current window: {windowSize.percentage}% of screen width</p>
                  
                  {/* Camera placeholder square - small version */}
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
                        justifyContent: 'center'
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
                    backgroundColor: 'white',
                    overflow: 'hidden',
                    border: 'none',
                    zIndex: 10 
                  }}
                >
                  <canvas 
                    ref={canvasRef}
                    className="tracking-canvas"
                    style={{ 
                      width: '100%', 
                      height: '100%',
                      display: 'block' 
                    }}
                  />
                </div>
              </>
            ) : null}
                  
            {/* Metrics info - conditionally rendered */}
            {isHydrated && showMetrics && (
              <DisplayResponse 
                width={metrics.width} 
                height={metrics.height} 
                distance={metrics.distance}
                isVisible={showMetrics}
              />
            )}
            
            {/* Camera component - using client-only version */}
            {isHydrated && isClient && showCamera && (
              <DynamicCameraAccess
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
            {isHydrated && isClient && showPermissionPopup && (
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
}