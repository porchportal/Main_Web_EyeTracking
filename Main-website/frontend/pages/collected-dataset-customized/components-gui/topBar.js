import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
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
  canvasRef,
  isTopBarShown = true,
  isCanvasVisible = true,
  showMetrics = true,
  isCameraActive = false,
  isCameraActivated = false,
  selectedCamerasCount = 0
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
      console.log(`[TopBar] Fetching settings for user: ${userId}`);
      
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

      const result = await response.json();
      const userSettings = result.data || {};
      
      console.log(`[TopBar] Retrieved settings for user ${userId}:`, userSettings);
      
      if (userSettings && (userSettings.times_set_random !== undefined || userSettings.delay_set_random !== undefined)) {
        setCurrentSettings(userSettings);
        if (updateSettings) {
          await updateSettings(userSettings, userId);
        }
        
        // Dispatch event to notify other components
        const event = new CustomEvent('topBarSettingsLoaded', {
          detail: {
            userId: userId,
            times_set_random: userSettings.times_set_random,
            delay_set_random: userSettings.delay_set_random,
            settings: userSettings
          }
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('TopBar - Error fetching settings:', error);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [updateSettings]);

  // Get canvas function - use existing canvas from global manager
  const getCanvas = () => {
    // Use the global canvas manager from index.js if available
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.getCanvas();
    }
    
    // Fallback: check for existing canvas
    let canvas = document.querySelector('#tracking-canvas');
    
    if (!canvas) {
      console.warn('No canvas found and no global canvas manager available');
      return null;
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
    // Check camera activation for action buttons that require camera
    if (['setRandom', 'calibrate', 'randomDot'].includes(actionType)) {
      if (!isCameraActivated) {
        // Show notification through global camera state manager
        if (typeof window !== 'undefined' && window.cameraStateManager) {
          const actionNames = {
            'setRandom': 'Set Random',
            'calibrate': 'Set Calibrate', 
            'randomDot': 'Random Dot'
          };
          window.cameraStateManager.showNotification(actionNames[actionType]);
        }
        return;
      }
    }
    
    // Ensure canvas is available before triggering actions that need it
    if (['setRandom', 'calibrate', 'randomDot', 'clearAll'].includes(actionType)) {
      const canvas = getCanvas();
      if (!canvas) {
        console.warn(`Canvas not available for action: ${actionType}`);
      }
    }
    
    if (onButtonClick) {
      onButtonClick(actionType);
    }
  };

  const handleToggleTopBar = () => {
    console.log('🔍 TopBar: handleToggleTopBar called, current isTopBarShown:', isTopBarShown);
    // Use global control function
    if (typeof window !== 'undefined' && window.toggleTopBar) {
      window.toggleTopBar(!isTopBarShown);
    }
  };
  
  const handleToggleMetrics = () => {
    console.log('🔍 TopBar: handleToggleMetrics called, current showMetrics:', showMetrics);
    // Use global control function
    if (typeof window !== 'undefined' && window.toggleMetrics) {
      window.toggleMetrics(!showMetrics);
    }
  };

  const handleGoBack = () => {
    router.push('/');
  };

  const statusMessage = `TopBar ${isTopBarShown ? 'shown' : 'hidden'}, Canvas: ${canvasStatus ? 'Visible' : 'Hidden'}`;

  console.log('🔍 TopBar: Rendering with props:', {
    isTopBarShown,
    showMetrics,
    isCameraActivated,
    isCameraActive
  });

  // Debug showMetrics prop changes
  useEffect(() => {
    console.log('🔍 TopBar: showMetrics prop changed to:', showMetrics);
  }, [showMetrics]);

    return (
    <div className="topbar" style={{ zIndex: 12, position: 'relative' }}>
      <div className="topbar-left">
        <div className="logo-container" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}>
          <div className="logo" style={{
            display: 'flex',
            alignItems: 'center',
            height: '100%'
          }}>
            <Image
              src="/logo.png"
              alt="NECTEC NSTDA Logo"
              width={220}
              height={160}
              style={{
                objectFit: 'contain',
                maxHeight: '50px'
              }}
              priority
            />
          </div>

          <div className="controls-container" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'flex-start'
          }}>
            <div className="control-group" key={`times-${currentSettings.times_set_random}-${Date.now()}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span className="control-label" style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#333',
                whiteSpace: 'nowrap',
                width: '60px',
                textAlign: 'right'
              }}>Time(s):</span>
              <div className="control-input">
                <div className="control-input-field" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  {currentSettings.times_set_random}
                </div>
              </div>
            </div>
            
            <div className="control-group" key={`delay-${currentSettings.delay_set_random}-${Date.now()}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span className="control-label" style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#333',
                whiteSpace: 'nowrap',
                width: '60px',
                textAlign: 'right'
              }}>Delay(s):</span>
              <div className="control-input">
                <div className="control-input-field" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  {currentSettings.delay_set_random}
                </div>
              </div>
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
                title="Start random sequence"
              >
                Set Random
              </button>
              <button 
                className="btn"
                onClick={() => handleButtonClick('calibrate')}
                title="Start calibration sequence"
              >
                Set Calibrate
              </button>
            </div>
            
            <div className="button-row" style={{ marginRight: '80px' }}>
                              <button 
                  className="btn"
                  onClick={() => handleButtonClick('randomDot')}
                  title="Start random dot sequence"
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
                onClick={() => handleButtonClick('preview')}
              >
                Show Preview
              </button>
              <button 
                className="btn camera-select-btn"
                onClick={() => handleButtonClick('selectCamera')}
                style={{
                  position: 'relative',
                  backgroundColor: '#4CAF50',
                  color: 'white'
                }}
              >
                📷 Select Camera
                <span className="camera-count" style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  backgroundColor: selectedCamerasCount > 0 ? '#4CAF50' : '#ff4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {selectedCamerasCount}
                </span>
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
            <br />
            <span style={{ 
              fontSize: '12px', 
              color: isCameraActivated ? '#00cc00' : '#ff9900',
              fontWeight: 'bold'
            }}>
              📷 Camera: {isCameraActivated ? (isCameraActive ? 'Active' : 'Activated (Click Preview to Start)') : 'Not Activated (Deactivates on Refresh)'}
            </span>
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
              transition: 'all 0.2s ease',
              marginRight: '5px'
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