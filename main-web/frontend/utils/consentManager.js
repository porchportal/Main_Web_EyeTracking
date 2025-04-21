// frontend/utils/consentManager.js
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'eye_tracking_consent';
const USERID_KEY = 'eye_tracking_userid';

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
    return { userId: null, consentStatus: null, consentUpdatedAt: null };
  }
  
  // Ensure we have a user ID
  const userId = getOrCreateUserId();
  
  // Get consent from localStorage
  const storedConsent = localStorage.getItem(STORAGE_KEY);
  
  if (storedConsent) {
    try {
      const parsedConsent = JSON.parse(storedConsent);
      return {
        userId,
        consentStatus: parsedConsent.consentStatus,
        consentUpdatedAt: parsedConsent.consentUpdatedAt
      };
    } catch (error) {
      console.error('Error parsing stored consent:', error);
    }
  }
  
  // If no valid consent data in localStorage
  return { userId, consentStatus: null, consentUpdatedAt: null };
};

/**
 * Update consent in localStorage and try backend if available
 */
export const updateUserConsent = async (userId, status) => {
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
  
  // Return the local update
  return { userId, consentStatus: status, consentUpdatedAt: now };
};