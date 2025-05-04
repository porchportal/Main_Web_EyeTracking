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
        console.log('Fetched settings:', newSettings);
        setSettings(prev => ({
          ...prev,
          [currentUserId]: newSettings
        }));
        setError(null);
        
        // First update topBar through ref
        if (ref && ref.current) {
          if (ref.current.setCaptureSettings) {
            ref.current.setCaptureSettings(newSettings);
            setIsTopBarUpdated(true);
          }
        }
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
  }, [currentUserId, ref]);

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
    const handleSettingsUpdate = (event) => {
      if (event.detail && event.detail.type === 'captureSettings') {
        const { userId, times, delay } = event.detail;
        if (times !== undefined || delay !== undefined) {
          const newSettings = {
            times: times !== undefined ? times : (settings[userId]?.times || 1),
            delay: delay !== undefined ? delay : (settings[userId]?.delay || 3),
            image_path: settings[userId]?.image_path || "/asfgrebvxcv",
            updateImage: settings[userId]?.updateImage || "image.jpg",
            set_timeRandomImage: settings[userId]?.set_timeRandomImage || 1,
            every_set: settings[userId]?.every_set || 2,
            zoom_percentage: settings[userId]?.zoom_percentage || 100,
            position_zoom: settings[userId]?.position_zoom || [3, 4],
            state_isProcessOn: settings[userId]?.state_isProcessOn ?? true,
            currentlyPage: settings[userId]?.currentlyPage || "str",
            freeState: settings[userId]?.freeState || 3
          };

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
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save settings to backend');
              }
              
              console.log('Settings saved to backend:', newSettings);
              setError(null);
            } catch (error) {
              console.error('Error saving settings to backend:', error);
              setError(error.message);
            }
          };
          saveToBackend();
        }
      }
    };

    window.addEventListener('captureSettingsUpdate', handleSettingsUpdate);
    return () => {
      window.removeEventListener('captureSettingsUpdate', handleSettingsUpdate);
    };
  }, [settings, ref]);

  const updateSettings = async (newSettings, userId) => {
    try {
      if (!newSettings || typeof newSettings !== 'object') {
        throw new Error('Invalid settings format');
      }

      const { times, delay } = newSettings;
      if (typeof times !== 'number' || typeof delay !== 'number' || times < 1 || delay < 1) {
        throw new Error('Invalid settings values');
      }

      // Preserve existing settings while updating times and delay
      const updatedSettings = {
        ...settings[userId],
        times,
        delay,
        image_path: settings[userId]?.image_path || "/asfgrebvxcv",
        updateImage: settings[userId]?.updateImage || "image.jpg",
        set_timeRandomImage: settings[userId]?.set_timeRandomImage || 1,
        every_set: settings[userId]?.every_set || 2,
        zoom_percentage: settings[userId]?.zoom_percentage || 100,
        position_zoom: settings[userId]?.position_zoom || [3, 4],
        state_isProcessOn: settings[userId]?.state_isProcessOn ?? true,
        currentlyPage: settings[userId]?.currentlyPage || "str",
        freeState: settings[userId]?.freeState || 3
      };

      setSettings(prev => ({
        ...prev,
        [userId]: updatedSettings
      }));
      initialized.current = true;

      // Save settings to backend
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
        throw new Error(errorData.detail || 'Failed to save settings to backend');
      }

      console.log('Settings updated and saved:', { userId, ...updatedSettings });
      setError(null);

      // First update topBar through ref
      if (ref && ref.current) {
        if (ref.current.setCaptureSettings) {
          ref.current.setCaptureSettings(updatedSettings);
          setIsTopBarUpdated(true);
        }
      }

    } catch (error) {
      console.error('Error updating settings:', error);
      setError(error.message);
      throw error;
    }
  };

  return { settings, updateSettings, error };
};

// Add default export component
export default function AdminSettings() {
  return null; // This is a utility file, so we don't need to render anything
}