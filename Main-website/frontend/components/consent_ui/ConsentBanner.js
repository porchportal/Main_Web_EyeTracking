// frontend/components/consent_ui/ConsentBanner.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../../styles/Consent.module.css';
import { useConsent } from './ConsentContext';
import { getOrCreateUserId } from '../../utils/consentManager';

export default function ConsentBanner() {
  const { showBanner, updateConsent } = useConsent();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [cookieStatus, setCookieStatus] = useState(null);

  useEffect(() => {
    const checkCookieStatus = async () => {
      try {
        const userId = getOrCreateUserId();
        const response = await fetch(`/api/user-preferences/${userId}`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            // 'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV',
            'X-API-Key': process.env.NEXT_PUBLIC_API_KEY 
          }
        });

        if (response.ok) {
          const data = await response.json();
          setCookieStatus(data.data?.cookie ?? false);
        } else {
          setCookieStatus(false);
        }
      } catch (error) {
        console.error('Error checking cookie status:', error);
        setCookieStatus(false);
      }
    };

    checkCookieStatus();
  }, []);

  // If banner shouldn't be shown or cookie is already accepted, return null
  if (!showBanner || cookieStatus === true) return null;

  const handleAccept = async () => {
    setLoading(true);
    try {
      // Update consent status
      await updateConsent(true);
      
      // Get user ID
      const userId = getOrCreateUserId();
      
      // User data will be initialized automatically when they first save their profile
      // No need to pre-initialize since we're using the new DataCenter approach
      console.log('User consent accepted, user data will be initialized on first profile save');
      
      // Update user preferences with cookie acceptance
      const response = await fetch(`/api/user-preferences/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY 
        },
        body: JSON.stringify({
          cookie: true
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save cookie preferences');
      }
      
      setCookieStatus(true);
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
      await updateConsent(false);
      setCookieStatus(false);
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