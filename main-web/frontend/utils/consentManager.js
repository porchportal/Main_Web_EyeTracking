// frontend/utils/consentManager.js
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'eye_tracking_consent';
const CONSENT_DETAILS_KEY = 'consent_details';
const USER_PROFILE_KEY = 'user_profile';

// Get or create a user ID
export const getOrCreateUserId = () => {
  try {
    const storedConsent = localStorage.getItem(STORAGE_KEY);
    const storedDetails = localStorage.getItem(CONSENT_DETAILS_KEY);
    
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
    const profileStr = localStorage.getItem(USER_PROFILE_KEY);
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
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(updatedProfile));
    return updatedProfile;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// Get user consent from localStorage
export const getUserConsent = () => {
  try {
    const storedConsent = localStorage.getItem(STORAGE_KEY);
    const storedDetails = localStorage.getItem(CONSENT_DETAILS_KEY);
    
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
    console.error('Error reading consent from storage:', error);
    return {
      userId: null,
      consentStatus: null,
      consentUpdatedAt: null,
      consentDetails: null
    };
  }
};

// Update user consent in localStorage
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
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, status.toString());
    localStorage.setItem(CONSENT_DETAILS_KEY, JSON.stringify(consentData));
    
    // Save to public directory
    try {
      const response = await fetch('/api/save-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(consentData)
      });
      
      if (!response.ok) {
        console.warn('Failed to save consent data to public directory');
      }
    } catch (saveError) {
      console.warn('Error saving consent data:', saveError);
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
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CONSENT_DETAILS_KEY);
    localStorage.removeItem(USER_PROFILE_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing consent:', error);
    return false;
  }
};