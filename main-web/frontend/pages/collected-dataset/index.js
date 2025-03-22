import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import TopBar from './components-gui/topBar';
import CameraAccess from './components-gui/cameraAccess';
import DisplayResponse from './components-gui/displayResponse';

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
  const canvasRef = useRef(null); // Reference for the tracking canvas

  // Update metrics and window size when component mounts and on window resize
  useEffect(() => {
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
      }
    };

    // Initial calculation
    if (typeof window !== 'undefined') {
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
    }
    
    // Clean up
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateDimensions);
      }
    };
  }, []);

  const handleTopBarButtonClick = (actionType) => {
    // Show camera permission popup if camera is not already active
    if (!showCamera && (
      actionType === 'Random Dot' || 
      actionType === 'Set Random' || 
      actionType === 'Set Calibrate' ||
      actionType === 'Show Preview' ||
      actionType === 'randomDot' ||
      actionType === 'setRandom' ||
      actionType === 'calibrate' ||
      actionType === 'preview'
    )) {
      setShowPermissionPopup(true);
    }
    
    // Update output text based on action type
    setOutputText(`Action triggered: ${actionType} at ${new Date().toLocaleTimeString()}`);
  };

  const handlePermissionAccepted = () => {
    setShowPermissionPopup(false);
    setShowCamera(true);
  };

  const handlePermissionDenied = () => {
    setShowPermissionPopup(false);
  };

  const handleCameraClose = () => {
    setShowCamera(false);
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
    setShowTopBar(prev => !prev);
    setOutputText(`TopBar ${!showTopBar ? 'shown' : 'hidden'}`);
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
            title="Show TopBar"
          >
            ≡
          </button>
        </div>
      )}
      
      {/* Main preview area */}
      <div 
        ref={previewAreaRef}
        className="preview-area"
      >
        {!showCamera ? (
          <div className="preview-message">
            <p>Camera preview will appear here</p>
            <p className="size-indicator">Current window: {windowSize.percentage}% of screen width</p>
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
        
        {/* Canvas for eye tracking dots */}
        <div 
          className="canvas-container" 
          style={{ 
            position: 'relative', 
            width: '100%', 
            height: '60vh', 
            minHeight: '400px', 
            border: '1px solid #e0e0e0', 
            backgroundColor: 'white',
            display: showCamera ? 'none' : 'block' // Hide canvas when camera is showing
          }}
        >
          <canvas 
            ref={canvasRef}
            className="tracking-canvas"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
      
      {/* Camera permission popup */}
      {showPermissionPopup && (
        <div className="permission-popup">
          <div className="permission-dialog">
            <h3 className="permission-title">Camera Access Required</h3>
            <p className="permission-message">
              This application needs access to your camera to function properly. 
              When prompted by your browser, please click "Allow" to grant camera access.
            </p>
            <div className="permission-buttons">
              <button 
                onClick={handlePermissionDenied}
                className="btn"
                style={{ backgroundColor: '#f0f0f0' }}
              >
                Cancel
              </button>
              <button 
                onClick={handlePermissionAccepted}
                className="btn"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Camera component */}
      <CameraAccess 
        isShowing={showCamera} 
        onClose={handleCameraClose}
        onCameraReady={handleCameraReady}
      />
    </div>
  );
}