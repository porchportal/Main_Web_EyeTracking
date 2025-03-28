import React, { useState, useEffect } from 'react';

const TopBar = ({ 
  onButtonClick, 
  outputText, 
  onOutputChange, 
  onToggleTopBar, 
  onToggleMetrics,
  canvasRef
}) => {
  // State to track canvas visibility
  const [canvasVisible, setCanvasVisible] = useState(false);
  
  // Check canvas visibility on mount and when canvasRef changes
  useEffect(() => {
    if (!canvasRef?.current) return;
    
    // Function to check if canvas is visible
    const checkCanvasVisibility = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Check if canvas has dimensions and is in the DOM
      const isVisible = !!(
        canvas.width && 
        canvas.height && 
        canvas.getBoundingClientRect().width
      );
      
      setCanvasVisible(isVisible);
    };
    
    // Check initially
    checkCanvasVisibility();
    
    // Create a MutationObserver to watch for canvas changes
    const observer = new MutationObserver(checkCanvasVisibility);
    observer.observe(canvasRef.current.parentElement, { 
      attributes: true, 
      childList: true,
      subtree: true 
    });
    
    // Set up interval to periodically check visibility
    const intervalId = setInterval(checkCanvasVisibility, 1000);
    
    return () => {
      observer.disconnect();
      clearInterval(intervalId);
    };
  }, [canvasRef]);

  const handleButtonClick = (actionType) => {
    // Call the passed button click handler
    if (onButtonClick) {
      onButtonClick(actionType);
    }
  };

  // Enhanced toggle handlers with visual feedback
  const handleToggleTopBar = () => {
    if (onToggleTopBar) {
      // Add visual feedback
      const btn = document.querySelector('.menu-btn');
      if (btn) {
        btn.classList.add('active-toggle');
        setTimeout(() => btn.classList.remove('active-toggle'), 300);
      }
      
      onToggleTopBar();
    }
  };
  
  const handleToggleMetrics = () => {
    if (onToggleMetrics) {
      // Add visual feedback
      const btn = document.querySelector('.alert-btn');
      if (btn) {
        btn.classList.add('active-toggle');
        setTimeout(() => btn.classList.remove('active-toggle'), 300);
      }
      
      onToggleMetrics();
    }
  };

  return (
    <div className="topbar">
      {/* Left Section - Logo and Controls */}
      <div className="topbar-left">
        {/* Logo */}
        <div className="logo">
          <h1 className="logo-text">Logo</h1>
        </div>
        
        {/* Time/Delay Controls */}
        <div className="controls-container">
          <div className="control-group">
            <span className="control-label">Time(s):</span>
            <div className="control-input">
              <input
                type="text"
                defaultValue="1"
                className="control-input-field"
              />
            </div>
          </div>
          
          <div className="control-group">
            <span className="control-label">Delay(s):</span>
            <div className="control-input">
              <input
                type="text"
                defaultValue="3"
                className="control-input-field"
              />
            </div>
          </div>
        </div>
        
        {/* Canvas visibility indicator */}
        <div 
          className="canvas-status"
          style={{
            display: 'flex',
            alignItems: 'center',
            marginLeft: '10px',
            padding: '0 8px',
            backgroundColor: canvasVisible ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
            borderRadius: '4px',
            fontSize: '12px'
          }}
        >
          <div 
            style={{ 
              width: '10px', 
              height: '10px', 
              borderRadius: '50%', 
              backgroundColor: canvasVisible ? '#00cc00' : '#ff0000',
              marginRight: '5px'
            }} 
          />
          <span>Canvas: {canvasVisible ? 'Visible' : 'Hidden'}</span>
        </div>
      </div>
      
      {/* Middle Section - Buttons */}
      <div className="topbar-middle">
        <div className="button-groups">
          {/* First Button Group */}
          <div className="button-group">
            <div className="button-row">
              <button 
                className="btn"
                onClick={() => handleButtonClick('setRandom')}
              >
                Set Random
              </button>
              <button 
                className="btn"
                onClick={() => handleButtonClick('randomDot')}
              >
                Random Dot
              </button>
            </div>
            
            <div className="button-row">
              <button 
                className="btn"
                onClick={() => handleButtonClick('calibrate')}
              >
                Set Calibrate
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
        
        .canvas-status {
          transition: background-color 0.5s ease;
        }
      `}</style>
    </div>
  );
};

export default TopBar;