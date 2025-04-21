// frontend/utils/consentManager.js
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'eye_tracking_consent';
const USERID_KEY = 'eye_tracking_userid';
const DETAILS_KEY = 'consent_details';

/**
 * Generate a unique user ID if one doesn't exist
 */
export const getOrCreateUserId = () => {
  if (typeof window === 'undefined') return null;
  
  // Try to get existing user ID from localStorage
  let userId = localStorage.getItem(USERID_KEY);
  
  // If no user ID exists, create one and store it
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem(USERID_KEY, userId);
  }
  
  return userId;
};

/**
 * Get consent information from localStorage only
 */
export const getUserConsent = async () => {
  if (typeof window === 'undefined') {
    return { userId: null, consentStatus: null, consentUpdatedAt: null, consentDetails: null };
  }
  
  // Ensure we have a user ID
  const userId = getOrCreateUserId();
  
  // Get consent from localStorage
  const storedConsent = localStorage.getItem(STORAGE_KEY);
  let consentDetails = null;
  
  try {
    const detailsStr = localStorage.getItem(DETAILS_KEY);
    if (detailsStr) {
      consentDetails = JSON.parse(detailsStr);
    }
  } catch (e) {
    console.error('Error parsing consent details:', e);
  }
  
  if (storedConsent) {
    try {
      const parsedConsent = JSON.parse(storedConsent);
      return {
        userId,
        consentStatus: parsedConsent.consentStatus,
        consentUpdatedAt: parsedConsent.consentUpdatedAt,
        consentDetails
      };
    } catch (error) {
      console.error('Error parsing stored consent:', error);
    }
  }
  
  // If no valid consent data in localStorage
  return { userId, consentStatus: null, consentUpdatedAt: null, consentDetails: null };
};

/**
 * Update consent in localStorage and try backend if available
 */
export const updateUserConsent = async (userId, status, details = null) => {
  if (typeof window === 'undefined') {
    throw new Error('Cannot update consent server-side');
  }
  
  if (!userId) {
    userId = getOrCreateUserId();
  }
  
  // Get current datetime in ISO format
  const now = new Date().toISOString();
  
  // Update localStorage first (optimistic update)
  const consentData = {
    consentStatus: status,
    consentUpdatedAt: now
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consentData));
  
  // Store detailed consent information if provided
  if (details) {
    localStorage.setItem(DETAILS_KEY, JSON.stringify(details));
  }
  
  // Try to update consent with the backend
  try {
    await fetch('/api/preferences/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        consentStatus: status
      })
    });
  } catch (error) {
    console.warn('Failed to update consent with backend:', error);
    // Continue anyway since we've updated localStorage
  }
  
  return { 
    userId, 
    consentStatus: status, 
    consentUpdatedAt: now,
    consentDetails: details
  };
};

/**
 * Get user preferences from backend or defaults
 */
export const getUserPreferences = async (userId) => {
  if (!userId) {
    userId = getOrCreateUserId();
  }
  
  try {
    const response = await fetch(`/api/preferences/get?userId=${userId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch preferences: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      return data.data;
    }
    
    // Return default preferences if no data
    return {
      user_id: userId,
      consent_status: null,
      theme: 'light',
      language: 'en',
      notification_settings: {
        email_notifications: false,
        push_notifications: false
      },
      image_processing_settings: {
        quality: 'high',
        auto_enhance: true,
        show_head_pose: true,
        show_bounding_box: false,
        show_mask: false,
        show_parameters: true
      }
    };
  } catch (error) {
    console.error('Error fetching preferences:', error);
    
    // Return default preferences on error
    return {
      user_id: userId,
      consent_status: null,
      theme: 'light',
      language: 'en',
      notification_settings: {
        email_notifications: false,
        push_notifications: false
      },
      image_processing_settings: {
        quality: 'high',
        auto_enhance: true,
        show_head_pose: true, 
        show_bounding_box: false,
        show_mask: false,
        show_parameters: true
      }
    };
  }
};

/**
 * Update user preferences with backend
 */
export const updateUserPreferences = async (userId, preferences) => {
  if (!userId) {
    userId = getOrCreateUserId();
  }
  
  try {
    const response = await fetch('/api/preferences/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        ...preferences
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update preferences: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error updating preferences:', error);
    throw error;
  }
};