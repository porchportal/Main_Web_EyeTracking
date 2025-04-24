import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAdminSettings } from './adminSettings';

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
  const { settings, updateSettings } = useAdminSettings();
  const [currentSettings, setCurrentSettings] = useState({ times: 1, delay: 3 });
  const [currentUserId, setCurrentUserId] = useState(null);

  // Update canvas status when prop changes
  useEffect(() => {
    setCanvasStatus(isCanvasVisible);
  }, [isCanvasVisible]);

  // Listen for user ID changes
  useEffect(() => {
    const handleUserIdChange = (event) => {
      if (event.detail && event.detail.userId) {
        console.log('User ID changed:', event.detail.userId);
        setCurrentUserId(event.detail.userId);
        // Immediately update settings for the new user
        if (settings && settings[event.detail.userId]) {
          console.log('Updating settings for user:', settings[event.detail.userId]);
          setCurrentSettings(settings[event.detail.userId]);
        }
      }
    };

    window.addEventListener('userIdChange', handleUserIdChange);
    return () => {
      window.removeEventListener('userIdChange', handleUserIdChange);
    };
  }, [settings]);

  // Update settings when they change or user ID changes
  useEffect(() => {
    if (settings && currentUserId) {
      console.log('Settings updated for user:', currentUserId, settings[currentUserId]);
      const userSettings = settings[currentUserId];
      if (userSettings) {
        setCurrentSettings(userSettings);
      }
    }
  }, [settings, currentUserId]);

  // Listen for settings updates from admin page
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      if (event.detail && event.detail.type === 'captureSettings') {
        const { userId, times, delay } = event.detail;
        console.log('Received settings update:', { userId, times, delay });
        if (userId === currentUserId) {
          setCurrentSettings(prev => ({
            ...prev,
            times: times !== undefined ? times : prev.times,
            delay: delay !== undefined ? delay : prev.delay
          }));
        }
      }
    };

    window.addEventListener('captureSettingsUpdate', handleSettingsUpdate);
    return () => {
      window.removeEventListener('captureSettingsUpdate', handleSettingsUpdate);
    };
  }, [currentUserId]);

  // Handle settings change
  const handleSettingsChange = async (newSettings) => {
    try {
      if (currentUserId) {
        console.log('Updating settings for user:', currentUserId, newSettings);
        await updateSettings(newSettings, currentUserId);
        setCurrentSettings(newSettings);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  const handleButtonClick = (actionType) => {
    if (onButtonClick) {
      onButtonClick(actionType);
    }
  };

  const handleToggleTopBar = () => {
    onToggleTopBar(!isTopBarShown);
  };
  
  const handleToggleMetrics = () => {
    onToggleMetrics();
  };

  const handleGoBack = () => {
    router.push('/');
  };

  const statusMessage = `TopBar ${isTopBarShown ? 'shown' : 'hidden'}, Canvas: ${canvasStatus ? 'Visible' : 'Hidden'}`;

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="logo">
          <h1 className="logo-text">Logo</h1>
        </div>

        <div className="controls-container">
          <div className="control-group">
            <span className="control-label">Time(s):</span>
            <div className="control-input">
              <span className="control-input-field">{currentSettings.times}</span>
            </div>
          </div>
          
          <div className="control-group">
            <span className="control-label">Delay(s):</span>
            <div className="control-input">
              <span className="control-input-field">{currentSettings.delay}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="topbar-middle">
        <div className="button-groups">
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
          
          <div className="topbar-divider"></div>
          
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