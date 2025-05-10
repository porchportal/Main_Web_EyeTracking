import { useEffect, useRef, useState } from 'react';

export const useAdminSettings = (ref) => {
  const [settings, setSettings] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isTopBarUpdated, setIsTopBarUpdated] = useState(false);
  const [error, setError] = useState(null);
  const initialized = useRef(false);
  const pollingInterval = useRef(null);

  // Initialize polling for settings updates
  useEffect(() => {
    const fetchSettings = async () => {
      if (!currentUserId) return;
      
      try {
        console.log('Polling settings for user:', currentUserId);
        const response = await fetch(`/api/data-center/settings/${currentUserId}`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to fetch settings');
        }
        
        const newSettings = await response.json();
        console.log('Fetched settings for user:', currentUserId, newSettings);
        
        // Only update if settings have changed
        const currentUserSettings = settings[currentUserId];
        if (JSON.stringify(currentUserSettings) !== JSON.stringify(newSettings)) {
          setSettings(prev => ({
            ...prev,
            [currentUserId]: {
              ...newSettings,  // Use the exact settings from the server
              times: newSettings.times,  // Preserve the exact times value
              delay: newSettings.delay   // Preserve the exact delay value
            }
          }));
          
          // Update topBar through ref
          if (ref && ref.current) {
            if (ref.current.setCaptureSettings) {
              ref.current.setCaptureSettings(newSettings);
              setIsTopBarUpdated(true);
            }
          }
        }
        
        setError(null);
      } catch (error) {
        console.error('Error fetching settings:', error);
        setError(error.message);
      }
    };

    // Initial fetch
    fetchSettings();

    // Set up polling interval
    pollingInterval.current = setInterval(fetchSettings, 3000);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [currentUserId, ref, settings]);

  // Effect to handle index.js update after topBar is updated
  useEffect(() => {
    if (isTopBarUpdated) {
      // Dispatch event to update index.js
      const event = new CustomEvent('settingsUpdated', {
        detail: {
          type: 'settings',
          userId: currentUserId,
          settings: settings[currentUserId]
        }
      });
      window.dispatchEvent(event);
      setIsTopBarUpdated(false);
    }
  }, [isTopBarUpdated, currentUserId, settings]);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('adminSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      }
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (initialized.current) {
      try {
        localStorage.setItem('adminSettings', JSON.stringify(settings));
      } catch (error) {
        console.error('Error saving settings to localStorage:', error);
      }
    }
  }, [settings]);

  // Listen for user ID changes
  useEffect(() => {
    const handleUserIdChange = (event) => {
      if (event.detail && event.detail.userId) {
        setCurrentUserId(event.detail.userId);
        // Trigger immediate settings fetch for new user
        const fetchSettings = async () => {
          try {
            const response = await fetch(`/api/data-center/settings/${event.detail.userId}`);
            if (!response.ok) throw new Error('Failed to fetch settings');
            
            const newSettings = await response.json();
            console.log('Fetched settings for new user:', newSettings);
            setSettings(prev => ({
              ...prev,
              [event.detail.userId]: newSettings
            }));
            
            if (ref && ref.current && ref.current.setCaptureSettings) {
              ref.current.setCaptureSettings(newSettings);
              setIsTopBarUpdated(true);
            }
          } catch (error) {
            console.error('Error fetching settings for new user:', error);
          }
        };
        fetchSettings();
      }
    };

    window.addEventListener('userIdChange', handleUserIdChange);
    return () => {
      window.removeEventListener('userIdChange', handleUserIdChange);
    };
  }, [ref]);

  // Listen for settings updates from admin page
  useEffect(() => {
    const handleSettingsUpdate = async (event) => {
      if (event.detail && event.detail.type === 'captureSettings') {
        const { userId, times, delay } = event.detail;
        if (times !== undefined || delay !== undefined) {
          // Get current settings for this user
          const currentSettings = settings[userId] || {};
          
          // Create new settings by preserving current values and only updating what's provided
          const newSettings = {
            ...currentSettings,  // Keep all existing settings
            times: times !== undefined ? times : currentSettings.times,  // Only update if provided
            delay: delay !== undefined ? delay : currentSettings.delay,  // Only update if provided
            // Remove default values to prevent overriding user input
            image_path: currentSettings.image_path,
            updateImage: currentSettings.updateImage,
            set_timeRandomImage: currentSettings.set_timeRandomImage,
            every_set: currentSettings.every_set,
            zoom_percentage: currentSettings.zoom_percentage,
            position_zoom: currentSettings.position_zoom,
            state_isProcessOn: currentSettings.state_isProcessOn,
            currentlyPage: currentSettings.currentlyPage,
            freeState: currentSettings.freeState
          };

          console.log('Updating settings with:', newSettings);

          setSettings(prev => ({
            ...prev,
            [userId]: newSettings
          }));

          // First update topBar through ref
          if (ref && ref.current) {
            if (ref.current.setCaptureSettings) {
              ref.current.setCaptureSettings(newSettings);
              setIsTopBarUpdated(true);
            }
          }

          // Save to backend using REST API
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
              const errorData = await response.json();
              throw new Error(errorData.detail || 'Failed to save settings to backend');
            }
            
            console.log('Settings saved to backend:', newSettings);
            setError(null);
          } catch (error) {
            console.error('Error saving settings to backend:', error);
            setError(error.message);
          }
        }
      }
    };

    window.addEventListener('captureSettingsUpdate', handleSettingsUpdate);
    return () => {
      window.removeEventListener('captureSettingsUpdate', handleSettingsUpdate);
    };
  }, [settings, ref]);

  const updateSettings = async (newSettings, userId) => {
    if (!userId) {
      console.error('No user ID provided for settings update');
      return;
    }

    // Create a clean settings object for this user
    const updatedSettings = {
      ...settings[userId],
      ...newSettings,
      // Ensure times and delay are preserved exactly as provided
      times: newSettings.times !== undefined ? newSettings.times : settings[userId]?.times,
      delay: newSettings.delay !== undefined ? newSettings.delay : settings[userId]?.delay
    };

    console.log(`Updating settings for user ${userId}:`, updatedSettings);

    // Update local state
    setSettings(prev => ({
      ...prev,
      [userId]: updatedSettings
    }));

    // Save to backend using REST API
    try {
      const response = await fetch(`/api/data-center/settings/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
        },
        body: JSON.stringify(updatedSettings)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save settings');
      }

      const savedSettings = await response.json();
      console.log('Settings saved successfully:', savedSettings);
      
      // Update local state with the saved settings
      setSettings(prev => ({
        ...prev,
        [userId]: savedSettings
      }));
    } catch (error) {
      console.error('Error saving settings:', error);
      setError(error.message);
    }
  };

  return { settings, updateSettings, error };
};

// Add default export component
export default function AdminSettings() {
  return null; // This is a utility file, so we don't need to render anything
}