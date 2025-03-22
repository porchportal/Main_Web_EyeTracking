import React, { useState } from 'react';

const TopBar = ({ onToggleTopBar, onToggleMetrics }) => {
  const [outputText, setOutputText] = useState('');
  
  const handleButtonClick = (actionType) => {
    console.log(`Button clicked: ${actionType}`);
    // Example of updating the output text based on action
    setOutputText(`Action performed: ${actionType} at ${new Date().toLocaleTimeString()}`);
    // Add your button click handler here
  };

  return (
    <div className="topbar">
      {/* Metrics Display - Moved inside topbar for better positioning */}
      <div className="metrics-display" style={{ display: 'none' }}>
        {/* Metrics content will be shown when toggled */}
        <p>Metric 1: Value</p>
        <p>Metric 2: Value</p>
      </div>
      
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
            onClick={onToggleTopBar}
            title="Toggle TopBar"
          >
            <span className="icon-text">≡</span>
          </button>
          
          <button 
            className="icon-btn alert-btn"
            onClick={onToggleMetrics}
            title="Toggle Metrics"
          >
            <span className="icon-text">!</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopBar;