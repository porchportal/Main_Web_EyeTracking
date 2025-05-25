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
  const [currentUserId, setCurrentUserId] = useState(null);

  const getInitialSettings = () => {
    if (settings && currentUserId && settings[currentUserId]) {
      return settings[currentUserId];
    }
    return { times: 1, delay: 3 };
  };
  const [currentSettings, setCurrentSettings] = useState(getInitialSettings());

  // Debug logging for settings changes
  useEffect(() => {
    console.log('TopBar - Current Settings State:', currentSettings);
    console.log('TopBar - Settings from context:', settings);
    console.log('TopBar - Current User ID:', currentUserId);
  }, [currentSettings, settings, currentUserId]);

  // Update canvas status when prop changes
  useEffect(() => {
    setCanvasStatus(isCanvasVisible);
  }, [isCanvasVisible]);

  // Listen for user ID changes and immediately fetch settings
  useEffect(() => {
    const handleUserIdChange = async (event) => {
      if (event.detail && event.detail.userId) {
        console.log('TopBar - User ID changed:', event.detail.userId);
        const newUserId = event.detail.userId;
        setCurrentUserId(newUserId);
        
        // Immediately fetch settings for the new user
        try {
          const response = await fetch(`/api/data-center/settings/${newUserId}`, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
            }
          });
          if (!response.ok) throw new Error('Failed to fetch settings');
          
          const userSettings = await response.json();
          console.log('TopBar - Fetched settings for new user:', userSettings);
          setCurrentSettings(userSettings);
          
          // Also update through the settings context
          if (updateSettings) {
            await updateSettings(userSettings, newUserId);
          }
        } catch (error) {
          console.error('TopBar - Error fetching settings for new user:', error);
        }
      }
    };

    window.addEventListener('userIdChange', handleUserIdChange);
    return () => {
      window.removeEventListener('userIdChange', handleUserIdChange);
    };
  }, [updateSettings]);

  // Fetch settings on initial load if we have a user ID
  useEffect(() => {
    if (currentUserId) {
      const fetchInitialSettings = async () => {
        try {
          const response = await fetch(`/api/data-center/settings/${currentUserId}`, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
            }
          });
          if (!response.ok) throw new Error('Failed to fetch settings');
          
          const userSettings = await response.json();
          console.log('TopBar - Fetched initial settings:', userSettings);
          setCurrentSettings(userSettings);
          
          if (updateSettings) {
            await updateSettings(userSettings, currentUserId);
          }
        } catch (error) {
          console.error('TopBar - Error fetching initial settings:', error);
        }
      };
      
      fetchInitialSettings();
    }
  }, [currentUserId, updateSettings]);

  // Update settings when they change in the context
  useEffect(() => {
    if (settings && currentUserId && settings[currentUserId]) {
      console.log('TopBar - Settings context updated for user:', currentUserId, settings[currentUserId]);
      const userSettings = settings[currentUserId];
      if (userSettings) {
        console.log('TopBar - Updating current settings with:', userSettings);
        setCurrentSettings(userSettings);
      }
    }
  }, [settings, currentUserId]);

  // Listen for settings updates from admin page
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      console.log('TopBar - Settings Update Event Received:', event.detail);
      if (event.detail && event.detail.type === 'captureSettings') {
        const { userId, times, delay } = event.detail;
        console.log('TopBar - Processing settings update:', { userId, times, delay });
        console.log('TopBar - Current User ID:', currentUserId);
        console.log('TopBar - User ID comparison:', {
          received: userId,
          current: currentUserId,
          match: userId === currentUserId
        });
        
        // Force update regardless of user ID match for now
        const newSettings = {
          times: Number(times) || currentSettings.times,
          delay: Number(delay) || currentSettings.delay
        };
        console.log('TopBar - New settings to be applied:', newSettings);
        console.log('TopBar - Current settings before update:', currentSettings);
        
        setCurrentSettings(newSettings);
        
        // Save to backend
        const saveToBackend = async () => {
          try {
            const response = await fetch(`/api/data-center/settings/${userId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
              },
              body: JSON.stringify(newSettings)
            });

            if (!response.ok) {
              throw new Error('Failed to save settings to backend');
            }
            console.log('TopBar - Settings saved to backend successfully');

            // Immediately fetch the latest settings from the backend
            const fetchResponse = await fetch(`/api/data-center/settings/${userId}`, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
              }
            });
            if (!fetchResponse.ok) throw new Error('Failed to fetch settings after save');
            const latestSettings = await fetchResponse.json();
            setCurrentSettings(latestSettings);
            if (updateSettings) {
              await updateSettings(latestSettings, userId);
            }
          } catch (error) {
            console.error('TopBar - Error saving/fetching settings to backend:', error);
          }
        };
        saveToBackend();
      }
    };

    window.addEventListener('captureSettingsUpdate', handleSettingsUpdate);
    return () => {
      window.removeEventListener('captureSettingsUpdate', handleSettingsUpdate);
    };
  }, [currentUserId, currentSettings]);

  // Add a new effect to monitor currentSettings changes
  useEffect(() => {
    console.log('TopBar - currentSettings changed:', currentSettings);
  }, [currentSettings]);

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
          <div className="control-group" key={`times-${currentSettings.times}-${Date.now()}`}>
            <span className="control-label">Time(s):</span>
            <div className="control-input">
              <span className="control-input-field">{currentSettings.times}</span>
            </div>
          </div>
          
          <div className="control-group" key={`delay-${currentSettings.delay}-${Date.now()}`}>
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