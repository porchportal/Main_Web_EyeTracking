import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const TopBar = ({ 
  onButtonClick,
  onCameraAccess,
  outputText,
  onOutputChange,
  onToggleTopBar,
  onToggleMetrics,
  canvasRef,
  isTopBarShown = true,
  isCanvasVisible = true
}) => {
  const router = useRouter();
  const [canvasStatus, setCanvasStatus] = useState(isCanvasVisible);

  // Update canvas status when prop changes
  useEffect(() => {
    setCanvasStatus(isCanvasVisible);
  }, [isCanvasVisible]);

  const handleButtonClick = (actionType) => {
    // Call the passed button click handler
    if (onButtonClick) {
      onButtonClick(actionType);
    }
  };

  // Enhanced toggle handlers with visual feedback
  const handleToggleTopBar = () => {
    onToggleTopBar(!isTopBarShown);
  };
  
  const handleToggleMetrics = () => {
    onToggleMetrics();
  };

  // Add back button handler
  const handleGoBack = () => {
    router.push('/');
  };

  // Create status message
  const statusMessage = `TopBar ${isTopBarShown ? 'shown' : 'hidden'}, Canvas: ${canvasStatus ? 'Visible' : 'Hidden'}`;

  return (
    <div className="topbar">
      {/* Left Section - Logo and Controls */}
      <div className="topbar-left">
        {/* Logo */}
        <div className="logo">
          <h1 className="logo-text">Logo</h1>
        </div>
      </div>
      
      {/* Middle Section - Buttons */}
      <div className="topbar-middle">
        <div className="button-groups">
          {/* First Button Group */}
          <div className="button-group">
            <div className="button-row">
              <button 
                className="btn back-button"
                onClick={handleGoBack}
                title="Go back to home page"
              >
                ← Back
              </button>
              
              <button 
                className="btn"
                onClick={() => handleButtonClick('setRandom')}
              >
                Set Random
              </button>
              <button 
                className="btn"
                onClick={() => handleButtonClick('calibrate')}
              >
                Set Calibrate
              </button>
            </div>
            
            <div className="button-row" style={{ marginRight: '80px' }}>
              <button 
                className="btn"
                onClick={() => handleButtonClick('randomDot')}
              >
                Random Dot
              </button>
              <button 
                className="btn"
                onClick={() => handleButtonClick('clearAll')}
              >
                Clear All
              </button>
            </div>
          </div>
          
          {/* Divider */}
          <div className="topbar-divider"></div>
          
          {/* Second Button Group */}
          <div className="button-group">
            <div className="button-row">
              <button 
                className="btn"
                onClick={() => handleButtonClick('headPose')}
              >
                Draw Head pose
              </button>
              <button 
                className="btn"
                onClick={() => handleButtonClick('boundingBox')}
              >
                Show Bounding Box
              </button>
            </div>
            
            <div className="button-row">
              <button 
                className="btn"
                onClick={() => handleButtonClick('preview')}
              >
                Show Preview
              </button>
              <button 
                className="btn"
                onClick={() => handleButtonClick('mask')}
              >
                😊 Show Mask
              </button>
              <button 
                className="btn"
                onClick={() => handleButtonClick('parameters')}
              >
                Parameters
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Section - Output Display and Controls */}
      <div className="topbar-right">
        <div className="notes-container">
          <div 
            className="output-display"
            title="Processing Output"
          >
            {statusMessage}
            <br />
            {outputText || "Processing output will appear here..."}
          </div>
        </div>
        
        <div className="control-buttons">
          <button 
            className="icon-btn menu-btn"
            onClick={handleToggleTopBar}
            title="Toggle TopBar"
            style={{
              padding: '5px 10px',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              marginRight: '5px'
            }}
          >
            <span className="icon-text">≡</span>
          </button>
          
          <button 
            className="icon-btn alert-btn"
            onClick={handleToggleMetrics}
            title="Toggle Metrics"
            style={{
              padding: '5px 10px',
              backgroundColor: '#ff9900',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            <span className="icon-text">!</span>
          </button>
        </div>
      </div>
      
      {/* CSS for the toggle button effects */}
      <style jsx>{`
        .active-toggle {
          transform: scale(1.2);
          transition: all 0.3s ease;
        }
        
        .icon-btn {
          transition: all 0.2s ease;
        }
        
        .icon-btn:hover {
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
};

export default TopBar;