// frontend/components/consent_ui/ConsentBanner.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../../styles/Consent.module.css';
import { useConsent } from './ConsentContext';
import { getOrCreateUserId } from '../../utils/consentManager';

// Stable headers to prevent object recreation
const CONSENT_HEADERS = Object.freeze({
  'Content-Type': 'application/json',
  'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
});

export default function ConsentBanner({ onShowPrivacyModal }) {
  const { showBanner, updateConsent, consentChecked, loading: contextLoading } = useConsent();
  const [loading, setLoading] = useState(false);
  const router = useRouter();


  // Don't show anything while consent is being checked (prevents flash)
  if (!consentChecked || contextLoading) {
    return null;
  }

  // If banner shouldn't be shown, return null
  if (!showBanner) {
    return null;
  }


  const handleAccept = async () => {
    setLoading(true);
    try {
      // Get user ID
      const userId = getOrCreateUserId();
      
      const requestBody = {
        userId: userId,
        consentStatus: true
      };
      
      
      // Update consent status through the proper consent API
      const consentResponse = await fetch('/api/preferences/consent', {
        method: 'POST',
        headers: CONSENT_HEADERS,
        body: JSON.stringify(requestBody)
      });
      
      
      if (!consentResponse.ok) {
        const errorText = await consentResponse.text();
        console.error('🍪 ConsentBanner: Error response:', errorText);
        throw new Error(`Failed to save consent status: ${consentResponse.status} - ${errorText}`);
      }
      
      const consentData = await consentResponse.json();

      // Update local consent state
      await updateConsent(true);

      // Dispatch custom event to notify other components that consent was accepted
      window.dispatchEvent(new CustomEvent('consentAccepted', {
        detail: { userId: userId }
      }));

      // User data will be initialized automatically when they first save their profile
    } catch (error) {
      console.error('Error handling cookie acceptance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    setLoading(true);
    try {
      // Get user ID
      const userId = getOrCreateUserId();
      
      const requestBody = {
        userId: userId,
        consentStatus: false
      };
      
      
      // Update consent status through the proper consent API
      const consentResponse = await fetch('/api/preferences/consent', {
        method: 'POST',
        headers: CONSENT_HEADERS,
        body: JSON.stringify(requestBody)
      });
      
      
      if (!consentResponse.ok) {
        const errorText = await consentResponse.text();
        console.error('🍪 ConsentBanner: Decline error response:', errorText);
        throw new Error(`Failed to save consent status: ${consentResponse.status} - ${errorText}`);
      }
      
      const consentData = await consentResponse.json();
      
      // Update local consent state
      await updateConsent(false);
    } catch (error) {
      console.error('Error handling cookie decline:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLearnMore = () => {
    if (onShowPrivacyModal) {
      onShowPrivacyModal();
    } else {
      // Fallback to navigation if modal handler not provided
      try {
        router.push('/preferences/privacy-policy');
      } catch (error) {
        console.error('Navigation error:', error);
        window.location.href = '/preferences/privacy-policy';
      }
    }
  };

  const handleConfigCookie = () => {
    try {
      router.push('/preferences/consent-setup');
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to window.location if router fails
      window.location.href = '/preferences/consent-setup';
    }
  };


  return (
    <div className={styles.bannerContainer}>
      <div className={styles.bannerContent}>
        <span className={styles.bannerText}>
          🍪 We use cookies to collect information about how you interact with our site—like your preferences and usage data—to improve your experience. By clicking "Accept", you agree to our use of cookies.
        </span>
        <div className={styles.bannerButtons}>
          <button 
            className={`${styles.bannerButton} ${styles.acceptButton}`} 
            onClick={handleAccept}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Accept'}
          </button>
          <button 
            className={`${styles.bannerButton} ${styles.declineButton}`} 
            onClick={handleDecline}
            disabled={loading}
          >
            Decline
          </button>
          <button 
            className={`${styles.bannerButton} ${styles.configButton}`}
            onClick={handleConfigCookie}
          >
            Config Cookie
          </button>
          <button 
            className={`${styles.bannerButton} ${styles.learnMoreButton}`}
            onClick={handleLearnMore}
          >
            Learn more
          </button>
        </div>
      </div>
    </div>
  );
}