// Cookie Destroyer Utility
// This utility provides comprehensive cookie and data clearing functionality

import Cookies from 'js-cookie';

// Cookie names used in the application
const COOKIE_NAMES = {
  CONSENT: 'eye_tracking_consent',
  CONSENT_DETAILS: 'consent_details',
  USER_PROFILE: 'user_profile',
  USER_PREFERENCES: 'user_preferences',
  SESSION_DATA: 'session_data',
  ANALYTICS: 'analytics_data',
  MARKETING: 'marketing_data'
};

// Local storage keys to clear
const LOCAL_STORAGE_KEYS = [
  'eye_tracking_consent',
  'consent_details',
  'user_profile',
  'user_preferences',
  'session_data',
  'analytics_data',
  'marketing_data',
  'user_id',
  'consent_timestamp',
  'last_activity',
  'camera_settings',
  'canvas_settings'
];

// Session storage keys to clear
const SESSION_STORAGE_KEYS = [
  'temp_data',
  'form_data',
  'upload_progress',
  'camera_stream',
  'canvas_state'
];

/**
 * Clear all cookies for the current domain
 * @returns {Object} Result object with success status and cleared cookies
 */
export const clearAllCookies = () => {
  const clearedCookies = [];
  const errors = [];

  try {
    // Get all existing cookies
    const existingCookies = document.cookie.split(';').reduce((cookies, cookie) => {
      const [name] = cookie.trim().split('=');
      if (name) cookies.push(name);
      return cookies;
    }, []);

    // Clear each cookie
    existingCookies.forEach(cookieName => {
      try {
        // Clear for current path
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        // Clear for root path
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
        // Clear for parent domain
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
        
        clearedCookies.push(cookieName);
      } catch (error) {
        errors.push({ cookie: cookieName, error: error.message });
      }
    });

    // Also clear known cookies using js-cookie
    Object.values(COOKIE_NAMES).forEach(cookieName => {
      try {
        Cookies.remove(cookieName);
        Cookies.remove(cookieName, { path: '/' });
        Cookies.remove(cookieName, { path: '/', domain: window.location.hostname });
        Cookies.remove(cookieName, { path: '/', domain: `.${window.location.hostname}` });
      } catch (error) {
        // Ignore errors for js-cookie removal
      }
    });

    console.log('🍪 Cookies cleared:', clearedCookies);
    return {
      success: true,
      clearedCookies,
      errors: errors.length > 0 ? errors : null
    };
  } catch (error) {
    console.error('❌ Error clearing cookies:', error);
    return {
      success: false,
      clearedCookies,
      errors: [...errors, { general: error.message }]
    };
  }
};

/**
 * Clear all local storage data
 * @returns {Object} Result object with success status and cleared keys
 */
export const clearAllLocalStorage = () => {
  const clearedKeys = [];
  const errors = [];

  try {
    // Clear specific known keys
    LOCAL_STORAGE_KEYS.forEach(key => {
      try {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          clearedKeys.push(key);
        }
      } catch (error) {
        errors.push({ key, error: error.message });
      }
    });

    // Clear all remaining localStorage items
    const remainingKeys = Object.keys(localStorage);
    remainingKeys.forEach(key => {
      try {
        if (!clearedKeys.includes(key)) {
          localStorage.removeItem(key);
          clearedKeys.push(key);
        }
      } catch (error) {
        errors.push({ key, error: error.message });
      }
    });

    console.log('💾 Local storage cleared:', clearedKeys);
    return {
      success: true,
      clearedKeys,
      errors: errors.length > 0 ? errors : null
    };
  } catch (error) {
    console.error('❌ Error clearing local storage:', error);
    return {
      success: false,
      clearedKeys,
      errors: [...errors, { general: error.message }]
    };
  }
};

/**
 * Clear all session storage data
 * @returns {Object} Result object with success status and cleared keys
 */
export const clearAllSessionStorage = () => {
  const clearedKeys = [];
  const errors = [];

  try {
    // Clear specific known keys
    SESSION_STORAGE_KEYS.forEach(key => {
      try {
        if (sessionStorage.getItem(key) !== null) {
          sessionStorage.removeItem(key);
          clearedKeys.push(key);
        }
      } catch (error) {
        errors.push({ key, error: error.message });
      }
    });

    // Clear all remaining sessionStorage items
    const remainingKeys = Object.keys(sessionStorage);
    remainingKeys.forEach(key => {
      try {
        if (!clearedKeys.includes(key)) {
          sessionStorage.removeItem(key);
          clearedKeys.push(key);
        }
      } catch (error) {
        errors.push({ key, error: error.message });
      }
    });

    console.log('🗂️ Session storage cleared:', clearedKeys);
    return {
      success: true,
      clearedKeys,
      errors: errors.length > 0 ? errors : null
    };
  } catch (error) {
    console.error('❌ Error clearing session storage:', error);
    return {
      success: false,
      clearedKeys,
      errors: [...errors, { general: error.message }]
    };
  }
};

/**
 * Clear IndexedDB data (if available)
 * @returns {Promise<Object>} Result object with success status
 */
export const clearIndexedDB = async () => {
  try {
    if ('indexedDB' in window) {
      // List all databases and delete them
      const databases = await indexedDB.databases();
      const deletePromises = databases.map(db => {
        return new Promise((resolve, reject) => {
          const deleteReq = indexedDB.deleteDatabase(db.name);
          deleteReq.onsuccess = () => resolve(db.name);
          deleteReq.onerror = () => reject(deleteReq.error);
        });
      });

      const deletedDatabases = await Promise.all(deletePromises);
      console.log('🗄️ IndexedDB cleared:', deletedDatabases);
      
      return {
        success: true,
        deletedDatabases
      };
    } else {
      console.log('ℹ️ IndexedDB not available');
      return {
        success: true,
        message: 'IndexedDB not available'
      };
    }
  } catch (error) {
    console.error('❌ Error clearing IndexedDB:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Nuclear option: Clear ALL data from the browser
 * @returns {Promise<Object>} Comprehensive result object
 */
export const nuclearDataClear = async () => {
  console.log('💥 NUCLEAR DATA CLEAR INITIATED...');
  
  const results = {
    cookies: clearAllCookies(),
    localStorage: clearAllLocalStorage(),
    sessionStorage: clearAllSessionStorage(),
    indexedDB: await clearIndexedDB(),
    timestamp: new Date().toISOString()
  };

  const allSuccessful = Object.values(results).every(result => 
    result.success !== false
  );

  console.log('💥 NUCLEAR CLEAR COMPLETE:', results);
  
  return {
    success: allSuccessful,
    results,
    message: allSuccessful 
      ? 'All data cleared successfully!' 
      : 'Some data clearing operations failed'
  };
};

/**
 * Reset consent banner and reload page
 * @param {boolean} showConfirmation - Whether to show confirmation before reload
 */
export const resetAndReload = (showConfirmation = true) => {
  if (showConfirmation) {
    const confirmed = window.confirm(
      'All data will be cleared and the page will reload. Continue?'
    );
    if (!confirmed) return;
  }

  // Clear all data
  nuclearDataClear().then(() => {
    // Dispatch custom event for any cleanup
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('dataCleared', {
        detail: { timestamp: new Date().toISOString() }
      });
      window.dispatchEvent(event);
    }
    
    // Reload the page
    window.location.reload();
  });
};

/**
 * Reset consent banner without reloading page
 * This ensures the consent banner reappears immediately
 */
export const resetConsentBannerOnly = () => {
  try {
    // Clear only consent-related data
    const consentCookies = [
      'eye_tracking_consent',
      'consent_details'
    ];
    
    const consentLocalStorage = [
      'eye_tracking_consent',
      'consent_details',
      'consent_timestamp'
    ];
    
    // Clear consent cookies
    consentCookies.forEach(cookieName => {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
    });
    
    // Clear consent local storage
    consentLocalStorage.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Could not remove ${key} from localStorage:`, error);
      }
    });
    
    // Dispatch event to trigger consent banner
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('consentReset', {
        detail: { timestamp: new Date().toISOString() }
      });
      window.dispatchEvent(event);
    }
    
    console.log('🍪 Consent banner reset successfully');
    return true;
  } catch (error) {
    console.error('❌ Error resetting consent banner:', error);
    return false;
  }
};

/**
 * Check if the username is the destroyer command
 * @param {string} username - Username to check
 * @returns {boolean} True if it's the destroyer command
 */
export const isDestroyerCommand = (username) => {
  const destroyerCommand = 'clear-all-the-cookie-in-this-page-right-now';
  
  return username?.toLowerCase().trim() === destroyerCommand;
};

/**
 * Handle destroyer command execution
 * @param {string} username - The username that triggered the command
 * @returns {Promise<Object>} Result of the destruction process
 */
export const handleDestroyerCommand = async (username) => {
  console.log('🚨 DESTROYER COMMAND DETECTED:', username);
  
  if (!isDestroyerCommand(username)) {
    return {
      success: false,
      message: 'Not a valid destroyer command'
    };
  }

  try {
    // Show warning
    const confirmed = window.confirm(
      '⚠️ WARNING: This will clear ALL data from this website!\n\n' +
      'This includes:\n' +
      '• All cookies\n' +
      '• Local storage data\n' +
      '• Session storage data\n' +
      '• IndexedDB data\n' +
      '• User preferences\n' +
      '• Profile data\n\n' +
      'The page will reload after clearing. Continue?'
    );

    if (!confirmed) {
      return {
        success: false,
        message: 'Destruction cancelled by user'
      };
    }

    // Execute nuclear clear
    const result = await nuclearDataClear();
    
    // Reset consent banner to make it reappear
    resetConsentBannerOnly();
    
    // Temporarily disable backend connection checks to avoid 503 errors
    if (typeof window !== 'undefined') {
      window.disableBackendChecks = true;
    }
    
    // Show success message
    alert('💥 ALL DATA CLEARED!\n\nConsent banner will reappear. The page will reload...');
    
    // Reload after a short delay to ensure consent banner appears
    setTimeout(() => {
      window.location.reload();
    }, 1500);

    return result;
  } catch (error) {
    console.error('❌ Error executing destroyer command:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Export default object with all functions
export default {
  clearAllCookies,
  clearAllLocalStorage,
  clearAllSessionStorage,
  clearIndexedDB,
  nuclearDataClear,
  resetAndReload,
  isDestroyerCommand,
  handleDestroyerCommand
};
