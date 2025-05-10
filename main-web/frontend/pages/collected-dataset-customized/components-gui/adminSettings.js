import { useEffect, useRef, useState } from 'react';

export const useAdminSettings = (ref) => {
  const [settings, setSettings] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isTopBarUpdated, setIsTopBarUpdated] = useState(false);
  const [error, setError] = useState(null);
  const initialized = useRef(false);
  const pollingInterval = useRef(null);
  const [currentSettings, setCurrentSettings] = useState({});

  // Helper: Fetch settings for a user from backend
  const fetchSettingsForUser = async (userId) => {
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
        ref.current.setCaptureSettings(newSettings);
        setIsTopBarUpdated(true);
      }
      return newSettings;
    } catch (error) {
      setError(error.message);
      return null;
    }
  };

  // Polling for settings updates
  useEffect(() => {
    if (!currentUserId) return;
    const fetchSettings = () => fetchSettingsForUser(currentUserId);
    fetchSettings();
    pollingInterval.current = setInterval(fetchSettings, 3000);
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, [currentUserId, ref]);

  // Listen for userId changes (from index.js navigation)
  useEffect(() => {
    const handleUserIdChange = (event) => {
      if (event.detail && event.detail.userId) {
        setCurrentUserId(event.detail.userId);
        fetchSettingsForUser(event.detail.userId);
      }
    };
    window.addEventListener('userIdChange', handleUserIdChange);
    return () => window.removeEventListener('userIdChange', handleUserIdChange);
  }, [ref]);

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
    if (!userId) return;
    const updatedSettings = {
      ...settings[userId],
      ...newSettings
    };
    setSettings(prev => ({ ...prev, [userId]: updatedSettings }));
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
      setError(null);
    } catch (error) {
      setError(error.message);
    }
  };

  // Upload and update image for a user
  const updateImage = async (userId, base64Image) => {
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