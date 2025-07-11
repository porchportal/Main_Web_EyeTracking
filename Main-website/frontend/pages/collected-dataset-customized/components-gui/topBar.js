import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAdminSettings } from './adminSettings';
import { getOrCreateUserId } from '../../../utils/consentManager';

// Improved debounce function
const debounce = (func, wait) => {
  let timeout;
  let lastArgs;
  let lastThis;
  
  return function executedFunction(...args) {
    lastArgs = args;
    lastThis = this;
    
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      timeout = null;
      func.apply(lastThis, lastArgs);
    }, wait);
  };
};

const TopBar = ({ 
  onButtonClick,
  onCameraAccess,
  outputText,
  onOutputChange,
  onToggleTopBar,
  onToggleMetrics,
  canvasRef,
  isTopBarShown = true,
  isCanvasVisible = true,
  showMetrics = true
}) => {
  const router = useRouter();
  const [canvasStatus, setCanvasStatus] = useState(isCanvasVisible);
  const { settings, updateSettings } = useAdminSettings();
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSettings, setCurrentSettings] = useState({ times_set_random: 1, delay_set_random: 3 });
  const isUpdatingRef = useRef(false);

  // Memoized function to fetch settings
  const fetchSettings = useCallback(async (userId) => {
    if (!userId || isUpdatingRef.current) return;
    
    try {
      isUpdatingRef.current = true;
      const response = await fetch(`/api/data-center/settings/${userId}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const userSettings = await response.json();
      if (userSettings && (userSettings.times_set_random || userSettings.delay_set_random)) {
        setCurrentSettings(userSettings);
        if (updateSettings) {
          await updateSettings(userSettings, userId);
        }
      }
    } catch (error) {
      console.error('TopBar - Error fetching settings:', error);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [updateSettings]);

  const ensureCanvasAvailable = () => {
    if (typeof window === 'undefined') return null;
    
    // Check for existing canvas
    let canvas = document.querySelector('#tracking-canvas');
    
    if (!canvas) {
      // Create canvas if it doesn't exist
      canvas = document.createElement('canvas');
      canvas.className = 'tracking-canvas';
      canvas.id = 'tracking-canvas';
      canvas.width = 800;
      canvas.height = 400;
      canvas.style.cssText = `
        position: relative;
        width: 100%;
        height: 400px;
        background-color: yellow;
        border: 1px solid #ccc;
        display: block;
      `;
      
      // Initialize with yellow background
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'yellow';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Append to appropriate container
      const container = document.querySelector('.canvas-container') || 
                        document.querySelector('.main-content') ||
                        document.body;
      container.appendChild(canvas);
    }
    
    // Store global reference
    window.whiteScreenCanvas = canvas;
    return canvas;
  };

  // Debounced save settings function
  const debouncedSaveSettings = useCallback(
    debounce(async (userId, newSettings) => {
      if (!userId || isUpdatingRef.current) return;
      
      try {
        isUpdatingRef.current = true;
        const response = await fetch(`/api/data-center/settings/${userId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
          },
          body: JSON.stringify(newSettings)
        });

        if (!response.ok) {
          throw new Error('Failed to save settings to backend');
        }

        const latestSettings = await response.json();
        setCurrentSettings(latestSettings);
        if (updateSettings) {
          await updateSettings(latestSettings, userId);
        }
      } catch (error) {
        console.error('TopBar - Error saving settings:', error);
      } finally {
        isUpdatingRef.current = false;
      }
    }, 500),
    [updateSettings]
  );

  // Initialize user ID and fetch initial settings
  useEffect(() => {
    const initializeUserId = async () => {
      const userId = getOrCreateUserId();
      if (userId) {
        setCurrentUserId(userId);
        await fetchSettings(userId);
        setIsLoading(false);
      }
    };
    initializeUserId();
  }, [fetchSettings]);

  // Update canvas status when prop changes
  useEffect(() => {
    setCanvasStatus(isCanvasVisible);
  }, [isCanvasVisible]);

  // Listen for user ID changes
  useEffect(() => {
    const handleUserIdChange = async (event) => {
      if (event.detail?.userId) {
        const newUserId = event.detail.userId;
        setCurrentUserId(newUserId);
        await fetchSettings(newUserId);
      }
    };

    window.addEventListener('userIdChange', handleUserIdChange);
    return () => window.removeEventListener('userIdChange', handleUserIdChange);
  }, [fetchSettings]);

  // Listen for settings updates from admin page
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      if (event.detail?.type === 'captureSettings') {
        const { userId, times_set_random, delay_set_random } = event.detail;
        
        // Only update if values have actually changed
        if (times_set_random !== currentSettings.times_set_random || delay_set_random !== currentSettings.delay_set_random) {
          const newSettings = {
            times_set_random: Number(times_set_random) || currentSettings.times_set_random,
            delay_set_random: Number(delay_set_random) || currentSettings.delay_set_random
          };
          debouncedSaveSettings(userId, newSettings);
        }
      }
    };

    window.addEventListener('captureSettingsUpdate', handleSettingsUpdate);
    return () => window.removeEventListener('captureSettingsUpdate', handleSettingsUpdate);
  }, [currentSettings, debouncedSaveSettings]);
  
  const handleButtonClick = (actionType) => {
    // Ensure canvas is available before triggering actions that need it
    if (['setRandom', 'calibrate', 'randomDot', 'clearAll'].includes(actionType)) {
      const canvas = ensureCanvasAvailable();
      if (!canvas) {
        console.warn(`Canvas not available for action: ${actionType}`);
      }
    }
    
    if (onButtonClick) {
      onButtonClick(actionType);
    }
  };

  const handleToggleTopBar = () => {
    onToggleTopBar(!isTopBarShown);
  };
  
  const handleToggleMetrics = () => {
    console.log('TopBar: handleToggleMetrics called');
    // Use action handler if available, otherwise fallback to direct toggle
    if (onButtonClick) {
      console.log('TopBar: Using action handler for metrics');
      onButtonClick('metrics');
    } else {
      console.log('TopBar: Using direct toggle for metrics');
      onToggleMetrics();
    }
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
          <div className="control-group" key={`times-${currentSettings.times_set_random}-${Date.now()}`}>
            <span className="control-label">Time(s):</span>
            <div className="control-input">
              <span className="control-input-field">{currentSettings.times_set_random}</span>
            </div>
          </div>
          
          <div className="control-group" key={`delay-${currentSettings.delay_set_random}-${Date.now()}`}>
            <span className="control-label">Delay(s):</span>
            <div className="control-input">
              <span className="control-input-field">{currentSettings.delay_set_random}</span>
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
            title={`${showMetrics ? 'Hide' : 'Show'} Metrics`}
            style={{
              padding: '5px 10px',
              backgroundColor: showMetrics ? '#00cc00' : '#ff9900',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <span className="icon-text">{showMetrics ? '✓' : '!'}</span>
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