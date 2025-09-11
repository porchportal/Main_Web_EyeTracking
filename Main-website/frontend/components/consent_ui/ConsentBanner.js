// frontend/components/consent_ui/ConsentBanner.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../../styles/Consent.module.css';
import { useConsent } from './ConsentContext';
import { getOrCreateUserId } from '../../utils/consentManager';

export default function ConsentBanner() {
  const { showBanner, updateConsent, consentChecked, loading: contextLoading } = useConsent();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  console.log('🎯 ConsentBanner render check:', {
    consentChecked,
    contextLoading,
    showBanner
  });

  // Don't render anything until consent has been checked
  if (!consentChecked || contextLoading) {
    console.log('⏳ ConsentBanner: Waiting for consent check to complete');
    return null;
  }

  // If banner shouldn't be shown, return null
  if (!showBanner) {
    console.log('🚫 ConsentBanner: Banner should not be shown');
    return null;
  }

  console.log('✅ ConsentBanner: Rendering banner');

  const handleAccept = async () => {
    setLoading(true);
    try {
      // Get user ID
      const userId = getOrCreateUserId();
      console.log('🆔 User ID for consent:', userId);
      
      const requestBody = {
        userId: userId,
        consentStatus: true
      };
      console.log('📤 Sending consent request:', requestBody);
      
      // Update consent status through the proper consent API
      const consentResponse = await fetch('/api/preferences/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY 
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📥 Consent response status:', consentResponse.status);
      
      if (!consentResponse.ok) {
        throw new Error('Failed to save consent status');
      }
      
      const consentData = await consentResponse.json();
      console.log('Consent saved successfully:', consentData);
      
      // Update local consent state
      await updateConsent(true);
      
      // User data will be initialized automatically when they first save their profile
      console.log('User consent accepted, user data will be initialized on first profile save');
      
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
      
      // Update consent status through the proper consent API
      const consentResponse = await fetch('/api/preferences/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY 
        },
        body: JSON.stringify({
          userId: userId,
          consentStatus: false
        })
      });
      
      if (!consentResponse.ok) {
        throw new Error('Failed to save consent status');
      }
      
      const consentData = await consentResponse.json();
      console.log('Consent declined successfully:', consentData);
      
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