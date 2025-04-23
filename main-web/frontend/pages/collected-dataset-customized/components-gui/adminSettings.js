import { useEffect, useRef, useState } from 'react';

export const useAdminSettings = (actionButtonRef) => {
  const [settings, setSettings] = useState({
    default: {
      times: 1,
      delay: 3
    }
  });
  
  // Add a useRef to track if settings have been initialized
  const initialized = useRef(false);

  useEffect(() => {
    console.log('adminSettings useEffect running, settings:', settings);
    
    // Function to update settings in action button
    const updateActionButtonSettings = (userId = 'default') => {
      console.log('Attempting to update action button settings:', settings[userId]);
      
      // Method 1: Use ref if available
      if (actionButtonRef && actionButtonRef.current) {
        console.log('Updating via actionButtonRef.current');
        try {
          actionButtonRef.current.setCaptureSettings(settings[userId]);
        } catch (err) {
          console.error('Error updating via ref:', err);
        }
      } else {
        console.log('actionButtonRef not available');
      }
      
      // Method 2: Use global window object as fallback
      if (typeof window !== 'undefined') {
        console.log('Checking for global actionButtonFunctions');
        
        // Try to find global functions - retry with setTimeout if not found
        const tryUpdateGlobal = (retriesLeft = 3) => {
          if (window.actionButtonFunctions && window.actionButtonFunctions.setCaptureSettings) {
            console.log('Updating via window.actionButtonFunctions');
            try {
              window.actionButtonFunctions.setCaptureSettings(settings[userId]);
              console.log('Settings updated via global functions');
            } catch (err) {
              console.error('Error updating via global functions:', err);
            }
          } else if (retriesLeft > 0) {
            console.log(`actionButtonFunctions not found, retrying... (${retriesLeft} attempts left)`);
            setTimeout(() => tryUpdateGlobal(retriesLeft - 1), 500);
          } else {
            console.warn('actionButtonFunctions not available after retries');
          }
        };
        
        tryUpdateGlobal();
      }
    };

    // Function to handle settings changes from admin page
    const handleSettingsChange = (event) => {
      if (event.detail && event.detail.type === 'captureSettings') {
        console.log('Received captureSettings event:', event.detail);
        const { userId, times, delay } = event.detail;
        if (times !== undefined || delay !== undefined) {
          setSettings(prevSettings => ({
            ...prevSettings,
            [userId]: {
              ...prevSettings[userId],
              times: times !== undefined ? times : prevSettings[userId]?.times || 1,
              delay: delay !== undefined ? delay : prevSettings[userId]?.delay || 3
            }
          }));
        }
        
        // Immediately try to update the action button
        setTimeout(() => updateActionButtonSettings(userId), 100);
      }
    };

    // Listen for settings changes
    window.addEventListener('captureSettingsUpdate', handleSettingsChange);

    // Initial update - only if we haven't initialized or settings changed
    if (!initialized.current) {
      initialized.current = true;
      updateActionButtonSettings('default');
    }

    // Cleanup
    return () => {
      window.removeEventListener('captureSettingsUpdate', handleSettingsChange);
    };
  }, [settings, actionButtonRef]);

  // Function to update settings
  const updateSettings = (newSettings, userId = 'default') => {
    console.log('useAdminSettings.updateSettings called with:', newSettings, 'for user:', userId);
    
    // Validate the new settings
    const validatedSettings = {
      times: Number(newSettings.times) || 1,
      delay: Number(newSettings.delay) || 3
    };
    
    // Update our local state
    setSettings(prevSettings => {
      const updatedSettings = {
        ...prevSettings,
        [userId]: validatedSettings
      };
      return updatedSettings;
    });
    
    // Create and dispatch a consistent event format
    const event = new CustomEvent('captureSettingsUpdate', {
      detail: {
        type: 'captureSettings',
        userId,
        times: validatedSettings.times,
        delay: validatedSettings.delay
      }
    });
    
    console.log('Dispatching event:', event);
    window.dispatchEvent(event);
    
    // Direct update to action button ref if available
    if (actionButtonRef && actionButtonRef.current && actionButtonRef.current.setCaptureSettings) {
      try {
        actionButtonRef.current.setCaptureSettings(validatedSettings);
      } catch (err) {
        console.error('Error updating via ref:', err);
      }
    }
    
    return validatedSettings;
  };

  return {
    settings,
    updateSettings
  };
};