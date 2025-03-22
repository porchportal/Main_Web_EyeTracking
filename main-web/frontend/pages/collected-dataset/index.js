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
  const previewAreaRef = useRef(null);

  // Update metrics when component mounts and on window resize
  useEffect(() => {
    const updateMetrics = () => {
      if (previewAreaRef.current) {
        const width = previewAreaRef.current.offsetWidth;
        const height = previewAreaRef.current.offsetHeight;
        setMetrics(prev => ({
          ...prev,
          width,
          height
        }));
      }
    };

    // Initial calculation
    if (typeof window !== 'undefined') {
      updateMetrics();
      window.addEventListener('resize', updateMetrics);
    }
    
    // Clean up
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateMetrics);
      }
    };
  }, []);

  // Handle top bar button clicks - all buttons will trigger camera permission popup
  const handleTopBarButtonClick = (actionType) => {
    // Show camera permission popup if camera is not already active
    if (!showCamera) {
      setShowPermissionPopup(true);
    }
    
    // Update output text based on action type
    setOutputText(`Action triggered: ${actionType} at ${new Date().toLocaleTimeString()}`);
    
    // You can add specific logic for different button actions here
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

  return (
    <div className="main-container">
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
          onOutputChange={(e) => setOutputText(e.target.value)}
          onToggleTopBar={toggleTopBar}
          onToggleMetrics={toggleMetrics}
        />
      )}
      
      {/* Show restore button when TopBar is hidden */}
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
        {!showCamera && (
          <div className="preview-message">
            <p>Camera preview will appear here</p>
          </div>
        )}
        
        {/* Metrics info - conditionally rendered */}
        {showMetrics && (
          <DisplayResponse 
            width={metrics.width} 
            height={metrics.height} 
            distance={metrics.distance}
          />
        )}
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