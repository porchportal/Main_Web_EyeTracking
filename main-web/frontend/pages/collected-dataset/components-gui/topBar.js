import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const TopBar = ({ 
  onButtonClick, 
  onCameraAccess, 
  outputText, 
  onOutputChange,
  onToggleTopBar, 
  onToggleMetrics 
}) => {
  const router = useRouter();
  const [screenSize, setScreenSize] = useState('large'); // 'large', 'medium', 'small', 'extra-small'
  
  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width >= 1200) {
        setScreenSize('large');
      } else if (width >= 768) {
        setScreenSize('medium');
      } else if (width >= 480) {
        setScreenSize('small');
      } else {
        setScreenSize('extra-small');
      }
    };

    if (typeof window !== 'undefined') {
      updateScreenSize();
      window.addEventListener('resize', updateScreenSize);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateScreenSize);
      }
    };
  }, []);
  
  // Get button text based on screen size
  const getButtonText = (fullText, shortText) => {
    if (screenSize === 'extra-small' || screenSize === 'small') {
      return shortText;
    }
    return fullText;
  };
  
  // Helper function to create buttons that trigger camera access
  const createButton = (text, shortText, actionType) => {
    const displayText = getButtonText(text, shortText);
    return (
      <button 
        className="btn"
        onClick={() => {
          // All buttons will trigger camera access first time
          onButtonClick(actionType);
        }}
      >
        {displayText}
      </button>
    );
  };
  
  const isCompact = screenSize !== 'large';
  
  return (
    <div className={`topbar ${isCompact ? 'topbar-compact' : ''}`}>
      {/* Logo and Time/Delay Section */}
      <div className={`topbar-left ${isCompact ? 'topbar-left-compact' : ''}`}>
        {/* Logo */}
        <div className={`logo ${isCompact ? 'logo-compact' : ''}`}>
          <h1 
            className={`logo-text ${isCompact ? 'logo-text-compact' : ''}`}
            onClick={() => router.push('/')}
          >
            Logo
          </h1>
        </div>
        
        {/* Time/Delay Controls */}
        <div className={`controls-container ${isCompact ? 'controls-container-compact' : ''}`}>
          <div className={`control-group ${isCompact ? 'control-group-compact' : ''}`}>
            <span className={`control-label ${isCompact ? 'control-label-compact' : ''}`}>
              {isCompact ? 'T:' : 'Time(s):'}
            </span>
            <div className="control-input">
              <input
                type="text"
                defaultValue="1"
                className="control-input-field"
              />
            </div>
          </div>
          
          <div className={`control-group ${isCompact ? 'control-group-compact' : ''}`}>
            <span className={`control-label ${isCompact ? 'control-label-compact' : ''}`}>
              {isCompact ? 'D:' : 'Delay(s):'}
            </span>
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
      
      {/* Button Section */}
      <div className={`topbar-middle ${isCompact ? 'topbar-middle-compact' : ''}`}>
        {/* First Button Group */}
        <div className={`button-group ${isCompact ? 'button-group-compact' : ''}`}>
          <div className="button-row">
            {createButton('Set Random', 'SRandom', 'setRandom')}
            {createButton('Random Dot', 'Random', 'randomDot')}
          </div>
          
          <div className="button-row">
            {createButton('Set Calibrate', 'Calibrate', 'calibrate')}
            {createButton('Clear All', 'Clear', 'clearAll')}
          </div>
        </div>
        
        {/* Divider - only visible in large mode */}
        {!isCompact && <div className="topbar-divider"></div>}
        
        {/* Second Button Group */}
        <div className={`button-group ${isCompact ? 'button-group-compact' : ''}`}>
          <div className="button-row">
            {createButton('Draw Head pose', 'Head pose', 'headPose')}
            {createButton('Show Bounding Box', '☐ Box', 'boundingBox')}
          </div>
          
          <div className="button-row">
            {createButton('Show Preview', 'Preview', 'preview')}
            {createButton('😊 Show Mask', '😊 Mask', 'mask')}
            {createButton('Parameters', 'Values', 'parameters')}
          </div>
        </div>
      </div>
      
      {/* Right section with notes textarea and control buttons */}
      <div className={`topbar-right ${isCompact ? 'topbar-right-compact' : ''}`}>
        <div className="notes-container">
          <textarea 
            placeholder="Notes..." 
            value={outputText}
            onChange={onOutputChange}
            className="notes-textarea"
          />
        </div>
        
        <div className="top-control-buttons">
          <button 
            className="control-btn menu-btn"
            onClick={onToggleTopBar}
            title="Toggle TopBar"
          >
            ≡
          </button>
          
          <button 
            className="control-btn circle-btn"
            onClick={onToggleMetrics}
            title="Toggle Metrics"
          >
            ⚫
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopBar;