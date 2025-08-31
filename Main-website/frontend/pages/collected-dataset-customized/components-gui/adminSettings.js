import { useEffect, useRef, useState, useCallback } from 'react';

// Add deep comparison utility
const isEqual = (obj1, obj2) => {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
  if (obj1 === null || obj2 === null) return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  return keys1.every(key => 
    keys2.includes(key) && isEqual(obj1[key], obj2[key])
  );
};

// Add debounce utility
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Helper function to safely access localStorage
const getLocalStorage = (key) => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn('Error accessing localStorage:', error);
    return null;
  }
};

// Helper function to safely set localStorage
const setLocalStorage = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn('Error setting localStorage:', error);
  }
};

export const useAdminSettings = (ref, consentUserId) => {
  const [settings, setSettings] = useState({});
  const [currentUserId, setCurrentUserId] = useState(() => {
    // Initialize from localStorage on mount, safely
    return getLocalStorage('currentUserId');
  });
  
  // Update currentUserId when consentUserId changes
  useEffect(() => {
    if (consentUserId && consentUserId !== currentUserId) {
      console.log('[AdminSettings] Updating currentUserId from consent context:', consentUserId);
      setCurrentUserId(consentUserId);
      setLocalStorage('currentUserId', consentUserId);
    }
  }, [consentUserId, currentUserId]);
  const [isTopBarUpdated, setIsTopBarUpdated] = useState(false);
  const [error, setError] = useState(null);
  const initialized = useRef(false);
  const pollingInterval = useRef(null);
  const [currentSettings, setCurrentSettings] = useState({});
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  
  // Constants for timing
  const MIN_UPDATE_INTERVAL = 2000; // 2 seconds minimum between updates
  const CACHE_DURATION = 30000; // 30 seconds cache duration
  const POLLING_INTERVAL = 5000; // 5 seconds polling interval
  
  // Cache and state tracking
  const settingsCache = useRef(new Map());
  const lastSettingsUpdate = useRef(new Map());
  const pendingUpdates = useRef(new Map());
  const isUpdating = useRef(false);
  const lastKnownSettings = useRef(new Map());
  const isUpdatingRef = useRef(false); // Separate ref for TopBar fetch operations

  // Debug logging for settings changes
  useEffect(() => {
    console.log('AdminSettings - Current Settings:', settings);
    console.log('AdminSettings - Current User ID:', currentUserId);
    console.log('AdminSettings - Is TopBar Updated:', isTopBarUpdated);
  }, [settings, currentUserId, isTopBarUpdated]);

  // Helper: Fetch settings for a user from backend with enhanced caching
  const fetchSettingsForUser = useCallback(async (userId) => {
    if (!userId) return;

    // Check cache first
    const cachedSettings = settingsCache.current.get(userId);
    const lastUpdate = lastSettingsUpdate.current.get(userId);
    const now = Date.now();

    // If we have cached settings and they're recent enough, use them
    if (cachedSettings && lastUpdate && (now - lastUpdate < CACHE_DURATION)) {
      console.log('[AdminSettings] Using cached settings for user:', userId);
      return cachedSettings;
    }

    // If there's already a pending update, return the cached value
    if (pendingUpdates.current.has(userId)) {
      console.log('[AdminSettings] Pending update exists, using cached value');
      return cachedSettings;
    }

    // If an update is in progress, return the cached value
    if (isUpdating.current) {
      console.log('[AdminSettings] Update in progress, using cached value');
      return cachedSettings;
    }

    try {
      isUpdating.current = true;
      pendingUpdates.current.set(userId, true);

      const response = await fetch(`/api/data-center/settings/${userId}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to fetch settings');
      }
      
      const result = await response.json();
      const newSettings = result.data || {};
      
      // Compare with last known settings
      const lastKnown = lastKnownSettings.current.get(userId);
      const hasChanged = !isEqual(lastKnown, newSettings);
      
      if (hasChanged) {
        console.log('[AdminSettings] Settings changed, updating...');
        setSettings(prev => ({
          ...prev,
          [userId]: newSettings
        }));
        setCurrentSettings(newSettings);
        
        // Update caches
        settingsCache.current.set(userId, newSettings);
        lastSettingsUpdate.current.set(userId, now);
        lastKnownSettings.current.set(userId, newSettings);
        
        // Update TopBar if ref provided
        if (ref && ref.current && ref.current.setCaptureSettings) {
          ref.current.setCaptureSettings(newSettings);
          setIsTopBarUpdated(true);
        }
      } else {
        console.log('[AdminSettings] Settings unchanged, skipping update');
      }
      
      setError(null);
      return newSettings;
    } catch (error) {
      console.error('[AdminSettings] Error fetching settings:', error);
      setError(error.message);
      return cachedSettings; // Return cached settings on error
    } finally {
      isUpdating.current = false;
      pendingUpdates.current.delete(userId);
    }
  }, [ref]);

  // Debounced version of fetchSettingsForUser
  const debouncedFetchSettings = useCallback(
    debounce((userId) => {
      fetchSettingsForUser(userId);
    }, 1000),
    [fetchSettingsForUser]
  );

  // Polling for settings updates with value-based optimization
  useEffect(() => {
    if (!currentUserId) return;
    
    const fetchSettings = async () => {
      const now = Date.now();
      if (now - lastUpdateTime < MIN_UPDATE_INTERVAL) {
        return;
      }
      
      try {
        await debouncedFetchSettings(currentUserId);
        setLastUpdateTime(now);
      } catch (error) {
        console.error('[AdminSettings] Polling error:', error);
      }
    };

    // Initial fetch
    fetchSettings();
    
    // Set up polling with value-based interval
    pollingInterval.current = setInterval(fetchSettings, POLLING_INTERVAL);
    
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [currentUserId, lastUpdateTime, debouncedFetchSettings]);

  // Listen for userId changes (from index.js navigation)
  useEffect(() => {
    const handleUserIdChange = (event) => {
      if (event.detail && event.detail.userId) {
        console.log('[handleUserIdChange] userId:', event.detail.userId);
        const newUserId = event.detail.userId;
        setCurrentUserId(newUserId);
        setLocalStorage('currentUserId', newUserId);
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
      const savedSettings = getLocalStorage('adminSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      }
    } catch (error) {
      console.warn('Error loading settings from localStorage:', error);
    }
  }, []);

  // Save settings to localStorage when they change (optional)
  useEffect(() => {
    if (initialized.current) {
      try {
        setLocalStorage('adminSettings', JSON.stringify(settings));
      } catch (error) {
        console.warn('Error saving settings to localStorage:', error);
      }
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
        const { userId, times_set_random, delay_set_random } = event.detail;
        console.log('[handleSettingsUpdate] userId:', userId, 'currentUserId:', currentUserId, 'times_set_random:', times_set_random, 'delay_set_random:', delay_set_random); // Debug log
        if (userId === currentUserId) {
          const newSettings = {
            ...currentSettings,
            times_set_random: times_set_random !== undefined ? Number(times_set_random) : currentSettings.times_set_random,
            delay_set_random: delay_set_random !== undefined ? Number(delay_set_random) : currentSettings.delay_set_random
          };
          console.log('[handleSettingsUpdate] Updated settings:', newSettings);
          setCurrentSettings(newSettings);
          setSettings(prev => ({ ...prev, [userId]: newSettings }));
          updateSettings(newSettings, userId);
        }
      }
    };
    window.addEventListener('captureSettingsUpdate', handleSettingsUpdate);
    return () => window.removeEventListener('captureSettingsUpdate', handleSettingsUpdate);
  }, [currentUserId, currentSettings]);

  // Update settings for a user with value-based optimization
  const updateSettings = useCallback(async (newSettings, userId) => {
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

    // Compare with last known settings
    const lastKnown = lastKnownSettings.current.get(userId);
    const hasChanged = !isEqual(lastKnown, updatedSettings);

    if (!hasChanged) {
      console.log('[updateSettings] Settings unchanged, skipping update');
      return;
    }

    try {
      isUpdating.current = true;
      pendingUpdates.current.set(userId, true);

      const response = await fetch(`http://localhost:80/api/data-center/settings/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
        },
        body: JSON.stringify(updatedSettings)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to save settings');
      }

      const result = await response.json();
      const finalSettings = result.data || updatedSettings;
      
      // Update state and caches
      setSettings(prev => ({ ...prev, [userId]: finalSettings }));
      setCurrentSettings(finalSettings);
      settingsCache.current.set(userId, finalSettings);
      lastSettingsUpdate.current.set(userId, now);
      lastKnownSettings.current.set(userId, finalSettings);
      setLastUpdateTime(now);
      setError(null);
    } catch (error) {
      setError(error.message);
    } finally {
      isUpdating.current = false;
      pendingUpdates.current.delete(userId);
    }
  }, [settings, lastUpdateTime]);

  // Upload and update image for a user
  const updateImage = async (userId, base64Image) => {
    console.log('[updateImage] userId:', userId); // Debug log
    if (!userId || !base64Image) return;
    try {
      const response = await fetch(`http://localhost:80/api/data-center/image?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
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

  // New function moved from topBar.js - Fetch settings with TopBar specific logic
  const fetchSettings = useCallback(async (userId) => {
    if (!userId || isUpdatingRef.current) return;
    
    try {
      isUpdatingRef.current = true;
      console.log(`[AdminSettings] Fetching settings for user: ${userId}`);
      
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
      
      console.log(`[AdminSettings] Retrieved settings for user ${userId}:`, userSettings);
      
      if (userSettings && (userSettings.times_set_random !== undefined || userSettings.delay_set_random !== undefined)) {
        setCurrentSettings(userSettings);
        
        console.log(`[AdminSettings] Settings loaded and dispatching event - Times: ${userSettings.times_set_random}, Delay: ${userSettings.delay_set_random}`);
        
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
        
        return userSettings;
      }
      
      return userSettings;
    } catch (error) {
      console.error('AdminSettings - Error fetching settings:', error);
      return null;
    } finally {
      isUpdatingRef.current = false;
    }
  }, []);

  return {
    settings,
    currentSettings,
    currentUserId,
    error,
    updateSettings: fetchSettingsForUser,
    fetchSettings, // New function for TopBar
    isLoading: initialized.current === false
  };
};

// Add default export component
export default function AdminSettings() {
  return null; 
}