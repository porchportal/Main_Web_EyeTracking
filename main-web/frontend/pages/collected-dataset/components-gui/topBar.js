import React, { useState, useEffect } from 'react';

const TopBar = ({ 
  onButtonClick, 
  outputText, 
  onOutputChange, 
  onToggleTopBar, 
  onToggleMetrics,
  canvasRef
}) => {
  // Canvas visibility status is now moved to the top right corner

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
      // onToggleTopBar('toggleTopBar');
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
        
        {/* Canvas status indicator removed from here */}
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
      `}</style>
    </div>
  );
};

export default TopBar;