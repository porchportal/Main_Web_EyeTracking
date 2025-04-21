// frontend/components/consent/ConsentBanner.js
import { useState } from 'react';
import { useRouter } from 'next/router';
import styles from '../../styles/Consent.module.css';
import { useConsent } from './ConsentContext';

export default function ConsentBanner() {
  const { showBanner, updateConsent } = useConsent();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // If banner shouldn't be shown, return null
  if (!showBanner) return null;

  const handleAccept = async () => {
    setLoading(true);
    await updateConsent(true);
    setLoading(false);
  };

  const handleDecline = async () => {
    setLoading(true);
    await updateConsent(false);
    setLoading(false);
  };

  const handleLearnMore = () => {
    router.push('/privacy-policy');
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