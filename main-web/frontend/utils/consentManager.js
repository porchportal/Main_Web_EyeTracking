// frontend/utils/consentManager.js
import { v4 as uuidv4 } from 'uuid';
import Cookies from 'js-cookie';

const CONSENT_COOKIE = 'eye_tracking_consent';
const CONSENT_DETAILS_COOKIE = 'consent_details';
const USER_PROFILE_COOKIE = 'user_profile';
const USER_PREFERENCES_COOKIE = 'user_preferences';

// Get or create a user ID
export const getOrCreateUserId = () => {
  try {
    const storedConsent = Cookies.get(CONSENT_COOKIE);
    const storedDetails = Cookies.get(CONSENT_DETAILS_COOKIE);
    
    if (storedConsent && storedDetails) {
      const details = JSON.parse(storedDetails);
      return details.userId;
    }
    
    // Generate new user ID if none exists
    const newUserId = uuidv4();
    return newUserId;
  } catch (error) {
    console.error('Error getting/creating user ID:', error);
    return uuidv4();
  }
};

// Get user profile
export const getUserProfile = () => {
  try {
    const profileStr = Cookies.get(USER_PROFILE_COOKIE);
    if (profileStr) {
      return JSON.parse(profileStr);
    }
    return null;
  } catch (error) {
    console.error('Error reading user profile:', error);
    return null;
  }
};

// Update user profile
export const updateUserProfile = (profileData) => {
  try {
    const currentProfile = getUserProfile() || {};
    const updatedProfile = {
      ...currentProfile,
      ...profileData,
      updatedAt: new Date().toISOString()
    };
    Cookies.set(USER_PROFILE_COOKIE, JSON.stringify(updatedProfile), { expires: 365 });
    return updatedProfile;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// Get user preferences
export const getUserPreferences = () => {
  try {
    const preferencesStr = Cookies.get(USER_PREFERENCES_COOKIE);
    if (preferencesStr) {
      return JSON.parse(preferencesStr);
    }
    return null;
  } catch (error) {
    console.error('Error reading user preferences:', error);
    return null;
  }
};

// Update user preferences
export const updateUserPreferences = (preferencesData) => {
  try {
    const currentPreferences = getUserPreferences() || {};
    const updatedPreferences = {
      ...currentPreferences,
      ...preferencesData,
      updatedAt: new Date().toISOString()
    };
    Cookies.set(USER_PREFERENCES_COOKIE, JSON.stringify(updatedPreferences), { expires: 365 });
    return updatedPreferences;
  } catch (error) {
    console.error('Error updating user preferences:', error);
    return null;
  }
};

// Get user consent from cookies
export const getUserConsent = () => {
  try {
    const storedConsent = Cookies.get(CONSENT_COOKIE);
    const storedDetails = Cookies.get(CONSENT_DETAILS_COOKIE);
    
    if (storedConsent && storedDetails) {
      const details = JSON.parse(storedDetails);
      return {
        userId: details.userId,
        consentStatus: storedConsent === 'true',
        consentUpdatedAt: details.timestamp,
        consentDetails: details
      };
    }
    return {
      userId: null,
      consentStatus: null,
      consentUpdatedAt: null,
      consentDetails: null
    };
  } catch (error) {
    console.error('Error reading consent from cookies:', error);
    return {
      userId: null,
      consentStatus: null,
      consentUpdatedAt: null,
      consentDetails: null
    };
  }
};

// Update user consent in cookies
export const updateUserConsent = async (status, details = {}) => {
  try {
    // Get or create user ID
    const userId = details.userId || getOrCreateUserId();
    
    // Create consent data object
    const consentData = {
      userId,
      status,
      timestamp: new Date().toISOString(),
      ...details
    };
    
    // Save to cookies
    Cookies.set(CONSENT_COOKIE, status.toString(), { expires: 365 }); // Expires in 1 year
    Cookies.set(CONSENT_DETAILS_COOKIE, JSON.stringify(consentData), { expires: 365 });
    
    // Send consent data to admin
    try {
      const response = await fetch('/api/admin/consent-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(consentData)
      });
      
      if (!response.ok) {
        console.warn('Failed to send consent data to admin');
      }
    } catch (saveError) {
      console.warn('Error sending consent data:', saveError);
    }
    
    return {
      userId,
      consentStatus: status,
      consentUpdatedAt: consentData.timestamp,
      consentDetails: consentData
    };
  } catch (error) {
    console.error('Error updating consent:', error);
    throw error;
  }
};

// Clear user consent and profile
export const clearUserConsent = () => {
  try {
    Cookies.remove(CONSENT_COOKIE);
    Cookies.remove(CONSENT_DETAILS_COOKIE);
    Cookies.remove(USER_PROFILE_COOKIE);
    return true;
  } catch (error) {
    console.error('Error clearing consent:', error);
    return false;
  }
};

// Reset consent banner by clearing cookies and refreshing the page
export const resetConsentBanner = () => {
  try {
    // Clear all consent-related cookies
    Cookies.remove(CONSENT_COOKIE);
    Cookies.remove(CONSENT_DETAILS_COOKIE);
    Cookies.remove(USER_PROFILE_COOKIE);
    
    // Refresh the page to trigger the consent initialization
    window.location.reload();
    
    return true;
  } catch (error) {
    console.error('Error resetting consent banner:', error);
    return false;
  }
};