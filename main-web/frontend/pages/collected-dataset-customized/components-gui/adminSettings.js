import { useEffect, useRef, useState } from 'react';

export const useAdminSettings = (ref) => {
  const [settings, setSettings] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isTopBarUpdated, setIsTopBarUpdated] = useState(false);
  const initialized = useRef(false);
  const ws = useRef(null);

  // Initialize WebSocket connection
  useEffect(() => {
    ws.current = new WebSocket(`ws://${window.location.host}/api/data-center/ws`);
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data && data.key === `settings_${currentUserId}`) {
        try {
          const parsedSettings = JSON.parse(data.value);
          setSettings(prev => ({
            ...prev,
            [currentUserId]: parsedSettings
          }));
          
          // First update topBar through ref
          if (ref && ref.current) {
            if (ref.current.setCaptureSettings) {
              ref.current.setCaptureSettings(parsedSettings);
              setIsTopBarUpdated(true);
            }
          }
        } catch (error) {
          console.error('Error parsing settings from WebSocket:', error);
        }
      }
    };

    return () => {
      if (ws.current) {
        ws.current.close();
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
        // Request current settings from data center
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'request',
            key: `settings_${event.detail.userId}`
          }));
        }
      }
    };

    window.addEventListener('userIdChange', handleUserIdChange);
    return () => {
      window.removeEventListener('userIdChange', handleUserIdChange);
    };
  }, []);

  // Listen for settings updates from admin page
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      if (event.detail && event.detail.type === 'captureSettings') {
        const { userId, times, delay } = event.detail;
        if (times !== undefined || delay !== undefined) {
          const newSettings = {
            times: times !== undefined ? times : (settings[userId]?.times || 1),
            delay: delay !== undefined ? delay : (settings[userId]?.delay || 3)
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

      const updatedSettings = {
        ...settings,
        [userId]: {
          times,
          delay
        }
      };

      setSettings(updatedSettings);
      initialized.current = true;

      // Send settings to data center via WebSocket
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          key: `settings_${userId}`,
          value: JSON.stringify({ times, delay }),
          data_type: 'json'
        }));
      }

      // First update topBar through ref
      if (ref && ref.current) {
        if (ref.current.setCaptureSettings) {
          ref.current.setCaptureSettings({ times, delay });
          setIsTopBarUpdated(true);
        }
      }

    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  };

  return { settings, updateSettings };
};