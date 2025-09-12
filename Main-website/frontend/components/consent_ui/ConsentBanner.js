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

export default function ConsentBanner() {
  const { showBanner, updateConsent, consentChecked, loading: contextLoading } = useConsent();
  const [loading, setLoading] = useState(false);
  const router = useRouter();


  // Show loading skeleton while consent is being checked
  if (!consentChecked || contextLoading) {
    return (
      <div className={styles.bannerContainer}>
        <div className={styles.bannerContent}>
          <div className={styles.bannerText}>
            <div className={styles.skeletonText}></div>
          </div>
          <div className={styles.bannerButtons}>
            <div className={styles.skeletonButton}></div>
            <div className={styles.skeletonButton}></div>
            <div className={styles.skeletonButton}></div>
          </div>
        </div>
      </div>
    );
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
      
      console.log('🍪 ConsentBanner: Sending consent request:', requestBody);
      
      // Update consent status through the proper consent API
      const consentResponse = await fetch('/api/preferences/consent', {
        method: 'POST',
        headers: CONSENT_HEADERS,
        body: JSON.stringify(requestBody)
      });
      
      console.log('🍪 ConsentBanner: Response status:', consentResponse.status);
      
      if (!consentResponse.ok) {
        const errorText = await consentResponse.text();
        console.error('🍪 ConsentBanner: Error response:', errorText);
        throw new Error(`Failed to save consent status: ${consentResponse.status} - ${errorText}`);
      }
      
      const consentData = await consentResponse.json();
      console.log('🍪 ConsentBanner: Success response:', consentData);
      
      // Update local consent state
      await updateConsent(true);
      
      // User data will be initialized automatically when they first save their profile
      
      // Redirect to consent setup page
      router.push('/preferences/consent-setup');
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
      
      console.log('🍪 ConsentBanner: Sending decline request:', requestBody);
      
      // Update consent status through the proper consent API
      const consentResponse = await fetch('/api/preferences/consent', {
        method: 'POST',
        headers: CONSENT_HEADERS,
        body: JSON.stringify(requestBody)
      });
      
      console.log('🍪 ConsentBanner: Decline response status:', consentResponse.status);
      
      if (!consentResponse.ok) {
        const errorText = await consentResponse.text();
        console.error('🍪 ConsentBanner: Decline error response:', errorText);
        throw new Error(`Failed to save consent status: ${consentResponse.status} - ${errorText}`);
      }
      
      const consentData = await consentResponse.json();
      console.log('🍪 ConsentBanner: Decline success response:', consentData);
      
      // Update local consent state
      await updateConsent(false);
    } catch (error) {
      console.error('Error handling cookie decline:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLearnMore = () => {
    try {
      router.push('/privacy-policy');
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to window.location if router fails
      window.location.href = '/privacy-policy';
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