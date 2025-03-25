import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import TopBar from './components-gui/topBar';
// Import our dynamic camera component with SSR disabled
import DynamicCameraAccess from './components-gui/DynamicCameraAccess';
import DisplayResponse from './components-gui/displayResponse';
import { ActionButtonGroup } from './components-gui/actionButton';

export default function CollectedDatasetPage() {
  const [showCamera, setShowCamera] = useState(false);
  const [showPermissionPopup, setShowPermissionPopup] = useState(false);
  const [showTopBar, setShowTopBar] = useState(true);
  const [showMetrics, setShowMetrics] = useState(true);
  const [outputText, setOutputText] = useState('');
  const [metrics, setMetrics] = useState({
    width: '---',
    height: '---',
    distance: '---'
  });
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
    percentage: 100
  });
  const previewAreaRef = useRef(null);
  const canvasRef = useRef(null);
  
  // State for camera processing options
  const [showHeadPose, setShowHeadPose] = useState(false);
  const [showBoundingBox, setShowBoundingBox] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [showParameters, setShowParameters] = useState(false);
  
  // State to track if camera square should be shown
  const [showCameraPlaceholder, setShowCameraPlaceholder] = useState(false);
  
  // To store the camera permission state
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  
  // Check if we're on the client or server
  const isClient = typeof window !== 'undefined';

  // Update metrics and window size when component mounts and on window resize
  useEffect(() => {
    if (!isClient) return; // Skip on server
    
    const updateDimensions = () => {
      if (previewAreaRef.current) {
        const width = previewAreaRef.current.offsetWidth;
        const height = previewAreaRef.current.offsetHeight;
        
        // Calculate what percentage of the screen we're using
        const screenPercentage = (window.innerWidth / window.screen.width) * 100;
        
        setMetrics(prev => ({
          ...prev,
          width,
          height
        }));
        
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
          percentage: Math.round(screenPercentage)
        });

        // Update canvas dimensions
        adjustCanvasDimensions();
      }
    };

    // Initial calculation
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    // Show welcome message
    setOutputText('Camera system ready. Click "Show Preview" to start camera.');
    
    // Clean up
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Adjust canvas dimensions to fill the container properly
  const adjustCanvasDimensions = () => {
    if (!isClient || !canvasRef.current || !previewAreaRef.current) return;
    
    const canvas = canvasRef.current;
    const container = previewAreaRef.current;
    
    // Get the size of the preview area
    const rect = container.getBoundingClientRect();
    
    // Set canvas dimensions to match container size
    canvas.width = rect.width;
    canvas.height = rect.height - (showTopBar ? 0 : 0); // Adjust if needed
    
    // Clear the canvas
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Add effect to update canvas when dimensions change
  useEffect(() => {
    if (isClient) {
      adjustCanvasDimensions();
    }
  }, [windowSize, showTopBar]);
  
  // Handler for action button clicks
  const handleActionButtonClick = (actionType) => {
    switch (actionType) {
      case 'headPose':
        const newHeadPoseState = !showHeadPose;
        setShowHeadPose(newHeadPoseState);
        setOutputText(`Head pose visualization ${newHeadPoseState ? 'enabled' : 'disabled'}`);
        if (newHeadPoseState && !showCamera) {
          setShowCameraPlaceholder(true);
        } else if (!newHeadPoseState && !showBoundingBox && !showMask && !showParameters) {
          setShowCameraPlaceholder(false);
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
        break;
      case 'preview':
        if (cameraPermissionGranted) {
          // If permission is already granted, just show the camera
          setShowCamera(true);
          setShowCameraPlaceholder(false);
        } else {
          // Otherwise show permission popup
          setShowPermissionPopup(true);
          setOutputText('Opening camera preview');
          setShowCameraPlaceholder(true);
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
        break;
      default:
        setOutputText(`Action triggered: ${actionType} at ${new Date().toLocaleTimeString()}`);
    }
  };

  // Top Bar button click handler
  const handleTopBarButtonClick = (actionType) => {
    // Show camera permission popup if camera is not already active and permission not yet granted
    if (!showCamera && !cameraPermissionGranted && (
      actionType === 'Show Preview' ||
      actionType === 'preview'
    )) {
      setShowPermissionPopup(true);
      setShowCameraPlaceholder(true);
    } else if (cameraPermissionGranted && !showCamera && (
      actionType === 'Show Preview' ||
      actionType === 'preview'
    )) {
      // If permission already granted, just show the camera without asking again
      setShowCamera(true);
      setShowCameraPlaceholder(false);
    }
    
    // Check for action buttons
    if (
      actionType === 'Draw Head pose' || 
      actionType === 'Show Bounding Box' || 
      actionType === '😷 Show Mask' ||
      actionType === 'Parameters'
    ) {
      switch (actionType) {
        case 'Draw Head pose':
          const newHeadPoseState = !showHeadPose;
          setShowHeadPose(newHeadPoseState);
          setOutputText(`Head pose visualization ${newHeadPoseState ? 'enabled' : 'disabled'}`);
          if (newHeadPoseState && !showCamera) {
            setShowCameraPlaceholder(true);
          } else if (!newHeadPoseState && !showBoundingBox && !showMask && !showParameters) {
            setShowCameraPlaceholder(false);
          }
          break;
        case 'Show Bounding Box':
          const newBoundingBoxState = !showBoundingBox;
          setShowBoundingBox(newBoundingBoxState);
          setOutputText(`Bounding box ${newBoundingBoxState ? 'shown' : 'hidden'}`);
          if (newBoundingBoxState && !showCamera) {
            setShowCameraPlaceholder(true);
          } else if (!newBoundingBoxState && !showHeadPose && !showMask && !showParameters) {
            setShowCameraPlaceholder(false);
          }
          break;
        case '😷 Show Mask':
          const newMaskState = !showMask;
          setShowMask(newMaskState);
          setOutputText(`Mask ${newMaskState ? 'shown' : 'hidden'}`);
          if (newMaskState && !showCamera) {
            setShowCameraPlaceholder(true);
          } else if (!newMaskState && !showHeadPose && !showBoundingBox && !showParameters) {
            setShowCameraPlaceholder(false);
          }
          break;
        case 'Parameters':
          const newParametersState = !showParameters;
          setShowParameters(newParametersState);
          setOutputText(`Parameters ${newParametersState ? 'shown' : 'hidden'}`);
          if (newParametersState && !showCamera) {
            setShowCameraPlaceholder(true);
          } else if (!newParametersState && !showHeadPose && !showBoundingBox && !showMask) {
            setShowCameraPlaceholder(false);
          }
          break;
      }
      return;
    }
    
    // Update output text based on action type
    setOutputText(`Action triggered: ${actionType} at ${new Date().toLocaleTimeString()}`);
  };

  const handlePermissionAccepted = () => {
    setShowPermissionPopup(false);
    setShowCamera(true);
    setCameraPermissionGranted(true); // Store that permission has been granted
    setShowCameraPlaceholder(false); // Hide placeholder when camera is active
  };

  const handlePermissionDenied = () => {
    setShowPermissionPopup(false);
  };

  const handleCameraClose = () => {
    setShowCamera(false);
    
    // Show camera placeholder if any of the visualization options are enabled
    if (showHeadPose || showBoundingBox || showMask || showParameters) {
      setShowCameraPlaceholder(true);
    } else {
      setShowCameraPlaceholder(false);
    }
  };

  const handleCameraReady = (dimensions) => {
    setMetrics({
      width: dimensions.width,
      height: dimensions.height,
      distance: dimensions.distance || '---'
    });
    setOutputText(`Camera ready: ${dimensions.width}x${dimensions.height}`);
  };

  const toggleTopBar = () => {
    const newTopBarState = !showTopBar;
    setShowTopBar(newTopBarState);
    
    // Also hide metrics when hiding the top bar
    if (!newTopBarState) {
      setShowMetrics(false);
    }
    
    setOutputText(`TopBar ${newTopBarState ? 'shown' : 'hidden'}${!newTopBarState ? ', Metrics hidden' : ''}`);
    
    // Wait for state update and DOM changes, then adjust canvas
    setTimeout(adjustCanvasDimensions, 0);
  };

  const toggleMetrics = () => {
    setShowMetrics(prev => !prev);
    setOutputText(`Metrics ${!showMetrics ? 'shown' : 'hidden'}`);
  };

  // Dynamic class to reflect current window size
  const getSizeClass = () => {
    const { percentage } = windowSize;
    if (percentage < 35) return 'window-size-tiny';
    if (percentage < 50) return 'window-size-small';
    if (percentage < 70) return 'window-size-medium';
    return 'window-size-large';
  };

  return (
    <div className={`main-container ${getSizeClass()}`}>
      <Head>
        <title>Camera Dataset Collection</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* TopBar component with onButtonClick handler - conditionally rendered */}
      {showTopBar && (
        <TopBar 
          onButtonClick={handleTopBarButtonClick} 
          onCameraAccess={() => setShowPermissionPopup(true)}
          outputText={outputText}
          onOutputChange={(text) => setOutputText(text)}
          onToggleTopBar={toggleTopBar}
          onToggleMetrics={toggleMetrics}
          canvasRef={canvasRef}
        />
      )}
      
      {/* Show restore button when TopBar is hidden - positioned at top right */}
      {!showTopBar && (
        <div className="restore-button-container">
          <button 
            className="restore-btn"
            onClick={toggleTopBar}
            title="Show TopBar and Metrics"
          >
            ≡
          </button>
        </div>
      )}
      
      {/* Main preview area */}
      <div 
        ref={previewAreaRef}
        className="camera-preview-area"
        style={{ height: showTopBar ? 'calc(100vh - 120px)' : '100vh' }}
      >
        {!showCamera ? (
          <div className="camera-preview-message">
            <p>Camera preview will appear here</p>
            <p className="camera-size-indicator">Current window: {windowSize.percentage}% of screen width</p>
            
            {/* Camera placeholder square - small version */}
            {showCameraPlaceholder && (
              <div 
                className="camera-placeholder-square"
                style={{
                  width: '180px',  // Increased size for better visibility
                  height: '135px', // Maintained 4:3 aspect ratio
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
            
            {/* Action buttons for camera control */}
            <div className="camera-action-buttons-container" style={{ marginTop: '30px', maxWidth: '600px' }}>
              <ActionButtonGroup
                triggerCameraAccess={() => {
                  if (cameraPermissionGranted) {
                    setShowCamera(true);
                    setShowCameraPlaceholder(false);
                  } else {
                    setShowPermissionPopup(true);
                  }
                }}
                isCompactMode={windowSize.width < 768}
                onActionClick={handleActionButtonClick}
                showHeadPose={showHeadPose}
                showBoundingBox={showBoundingBox}
                showMask={showMask}
                showParameters={showParameters}
              />
            </div>
          </div>
        ) : null}
        
        {/* Metrics info - conditionally rendered */}
        {showMetrics && (
          <DisplayResponse 
            width={metrics.width} 
            height={metrics.height} 
            distance={metrics.distance}
          />
        )}
        
        {/* Canvas for eye tracking dots - Making it truly fullscreen */}
        <div 
          className="canvas-container" 
          style={{ 
            position: 'absolute', 
            top: 0,
            left: 0,
            width: '100%', 
            height: '100%',
            backgroundColor: 'white',
            display: showCamera ? 'none' : 'block', // Hide canvas when camera is showing
            overflow: 'hidden',
            border: 'none' // Remove border to eliminate line
          }}
        >
          <canvas 
            ref={canvasRef}
            className="tracking-canvas"
            style={{ 
              width: '100%', 
              height: '100%',
              display: 'block' // Removes the inline-block spacing issues
            }}
          />
        </div>
      </div>
      
      {/* Camera permission popup - Simplified client-side only version */}
      {isClient && showPermissionPopup && (
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
      
      {/* Camera component - using client-only version */}
      {isClient && (
        <DynamicCameraAccess
          isShowing={showCamera} 
          onClose={handleCameraClose}
          onCameraReady={handleCameraReady}
          showHeadPose={showHeadPose}
          showBoundingBox={showBoundingBox}
          showMask={showMask}
          showParameters={showParameters}
        />
      )}
    </div>
  );
}