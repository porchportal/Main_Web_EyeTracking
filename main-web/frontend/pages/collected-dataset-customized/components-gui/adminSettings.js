import { useEffect, useRef, useState } from 'react';

export const useAdminSettings = (ref) => {
  const [settings, setSettings] = useState({});
  const [currentUserId, setCurrentUserId] = useState(() => {
    // Initialize from localStorage on mount
    return localStorage.getItem('currentUserId');
  });
  const [isTopBarUpdated, setIsTopBarUpdated] = useState(false);
  const [error, setError] = useState(null);
  const initialized = useRef(false);
  const pollingInterval = useRef(null);
  const [currentSettings, setCurrentSettings] = useState({});
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const POLLING_INTERVAL = 10000; // Increase to 10 seconds
  const MIN_UPDATE_INTERVAL = 2000; // Minimum time between updates

  // Debug logging for settings changes
  useEffect(() => {
    console.log('AdminSettings - Current Settings:', settings);
    console.log('AdminSettings - Current User ID:', currentUserId);
    console.log('AdminSettings - Is TopBar Updated:', isTopBarUpdated);
  }, [settings, currentUserId, isTopBarUpdated]);

  // Helper: Fetch settings for a user from backend
  const fetchSettingsForUser = async (userId) => {
    console.log('[AdminSettings] fetchSettingsForUser - userId:', userId);
    if (!userId) return;
    try {
      const response = await fetch(`/api/data-center/settings/${userId}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to fetch settings');
      }
      const result = await response.json();
      console.log('[AdminSettings] fetchSettingsForUser - Received settings:', result.data);
      
      // result.data contains the settings object
      const newSettings = result.data || {};
      setSettings(prev => ({
        ...prev,
        [userId]: newSettings
      }));
      setCurrentSettings(newSettings);
      setError(null);
      
      // Update TopBar if ref provided
      if (ref && ref.current && ref.current.setCaptureSettings) {
        console.log('[AdminSettings] Updating TopBar with settings:', newSettings);
        ref.current.setCaptureSettings(newSettings);
        setIsTopBarUpdated(true);
      }
      return newSettings;
    } catch (error) {
      console.error('[AdminSettings] Error fetching settings:', error);
      setError(error.message);
      return null;
    }
  };

  // Polling for settings updates
  useEffect(() => {
    if (!currentUserId) return;
    
    const fetchSettings = async () => {
      const now = Date.now();
      if (now - lastUpdateTime < MIN_UPDATE_INTERVAL) {
        return; // Skip if last update was too recent
      }
      
      try {
        const newSettings = await fetchSettingsForUser(currentUserId);
        if (newSettings) {
          setLastUpdateTime(now);
        }
      } catch (error) {
        console.error('[AdminSettings] Polling error:', error);
      }
    };

    fetchSettings();
    pollingInterval.current = setInterval(fetchSettings, POLLING_INTERVAL);
    
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [currentUserId, ref, lastUpdateTime]);

  // Listen for userId changes (from index.js navigation)
  useEffect(() => {
    const handleUserIdChange = (event) => {
      if (event.detail && event.detail.userId) {
        console.log('[handleUserIdChange] userId:', event.detail.userId);
        const newUserId = event.detail.userId;
        setCurrentUserId(newUserId);
        localStorage.setItem('currentUserId', newUserId);
        fetchSettingsForUser(newUserId);
      }
    };
    window.addEventListener('userIdChange', handleUserIdChange);
    return () => window.removeEventListener('userIdChange', handleUserIdChange);
  }, [ref]);

  // Initial settings fetch on mount if we have a user ID
  useEffect(() => {
    if (currentUserId && !initialized.current) {
      fetchSettingsForUser(currentUserId);
      initialized.current = true;
    }
  }, [currentUserId]);

  // Effect to handle index.js update after TopBar is updated
  useEffect(() => {
    if (isTopBarUpdated) {
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

  // Load settings from localStorage on mount (optional, fallback)
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('adminSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      }
    } catch (error) {
      // Ignore
    }
  }, []);

  // Save settings to localStorage when they change (optional)
  useEffect(() => {
    if (initialized.current) {
      try {
        localStorage.setItem('adminSettings', JSON.stringify(settings));
      } catch (error) {}
    } else {
      initialized.current = true;
    }
  }, [settings]);

  // Update settings when they change in the context
  useEffect(() => {
    if (settings && currentUserId) {
      console.log('[settings useEffect] currentUserId:', currentUserId); // Debug log
      const userSettings = settings[currentUserId];
      if (userSettings) {
        setCurrentSettings(userSettings);
        // Optionally update UI elements if needed
      }
    }
  }, [settings, currentUserId]);

  // Listen for settings updates from admin page (captureSettingsUpdate event)
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      if (event.detail && event.detail.type === 'captureSettings') {
        const { userId, times, delay } = event.detail;
        console.log('[handleSettingsUpdate] userId:', userId, 'currentUserId:', currentUserId); // Debug log
        if (userId === currentUserId) {
          const newSettings = {
            ...currentSettings,
            times: times !== undefined ? Number(times) : currentSettings.times,
            delay: delay !== undefined ? Number(delay) : currentSettings.delay
          };
          setCurrentSettings(newSettings);
          setSettings(prev => ({ ...prev, [userId]: newSettings }));
          updateSettings(newSettings, userId);
        }
      }
    };
    window.addEventListener('captureSettingsUpdate', handleSettingsUpdate);
    return () => window.removeEventListener('captureSettingsUpdate', handleSettingsUpdate);
  }, [currentUserId, currentSettings]);

  // Update settings for a user (times, delay, image, etc.)
  const updateSettings = async (newSettings, userId) => {
    console.log('[updateSettings] userId:', userId);
    if (!userId) return;
    
    const now = Date.now();
    if (now - lastUpdateTime < MIN_UPDATE_INTERVAL) {
      console.log('[updateSettings] Skipping update - too soon after last update');
      return;
    }

    const updatedSettings = {
      ...settings[userId],
      ...newSettings
    };

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to save settings');
      }

      const result = await response.json();
      setSettings(prev => ({ ...prev, [userId]: result.data || updatedSettings }));
      setCurrentSettings(result.data || updatedSettings);
      setLastUpdateTime(now);
      setError(null);
    } catch (error) {
      setError(error.message);
    }
  };

  // Upload and update image for a user
  const updateImage = async (userId, base64Image) => {
    console.log('[updateImage] userId:', userId); // Debug log
    if (!userId || !base64Image) return;
    try {
      const response = await fetch(`/api/data-center/image?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
        },
        body: JSON.stringify({ image: base64Image })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to upload image');
      }
      // Optionally, fetch settings again to get updated image info
      await fetchSettingsForUser(userId);
      setError(null);
      return true;
    } catch (error) {
      setError(error.message);
      return false;
    }
  };

  return { settings, updateSettings, updateImage, error };
};

// Add default export component
export default function AdminSettings() {
  return null; // This is a utility file, so we don't need to render anything
}