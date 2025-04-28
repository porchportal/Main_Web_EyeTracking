// frontend/pages/index.js
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import { useProcessStatus, useBackendConnection } from '../utils/stateManager';
import { useEffect, useState } from 'react';
import { useConsent } from '../components/consent/ConsentContext';
import { isProfileComplete } from '../utils/consentManager';

export default function HomePage() {
  const router = useRouter();
  const { isProcessReady, toggleProcessStatus } = useProcessStatus();
  const { isConnected, authValid, checkConnection } = useBackendConnection();
  const { consentStatus, userId } = useConsent();
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [buttonStates, setButtonStates] = useState({});
  const [mounted, setMounted] = useState(false);

  // Check profile completion on mount
  useEffect(() => {
    setMounted(true);
    checkConnection(true);

    // Check if profile is complete
    const profileComplete = isProfileComplete();
    if (profileComplete && userId) {
      setButtonStates(prev => ({
        ...prev,
        [userId]: true
      }));
    }

    // Add effect to handle button state updates
    const handleButtonStateUpdate = (event) => {
      console.log('Received button state update:', event.detail);
      if (event.detail) {
        setButtonStates(prev => {
          const newState = {
            ...prev,
            [event.detail.userId]: event.detail.enabled
          };
          console.log('Updated button states:', newState);
          return newState;
        });
      }
    };

    window.addEventListener('buttonStateUpdate', handleButtonStateUpdate);
    return () => window.removeEventListener('buttonStateUpdate', handleButtonStateUpdate);
  }, [userId]);

  // Add effect to handle admin override events
  useEffect(() => {
    const handleAdminOverride = (event) => {
      console.log('Received admin override:', event.detail);
      if (event.detail && event.detail.type === 'adminOverride') {
        setButtonStates(prev => {
          const newState = {
            ...prev,
            [event.detail.userId]: event.detail.enabled
          };
          console.log('Updated button states from admin:', newState);
          return newState;
        });
      }
    };

    window.addEventListener('adminOverride', handleAdminOverride);
    return () => window.removeEventListener('adminOverride', handleAdminOverride);
  }, []);

  const handleButtonClick = (destination) => {
    if (destination === 'process-set' && (!isConnected || !authValid)) {
      checkConnection(true);

      if (!isConnected) {
        alert('Unable to connect to backend. Please make sure the backend server is running.');
        return;
      } else if (!authValid) {
        alert('Connected to backend but authentication failed. Please check your API key.');
        return;
      }
    }

    // Special handling for collected-dataset-custom
    if (destination === 'collected-dataset-custom') {
      const isEnabled = buttonStates[userId] || isAdminOverride;
      console.log('Button click check:', { userId, buttonStates, isEnabled });
      if (!isEnabled) {
        return; // Don't proceed if button is disabled
      }
    }

    switch (destination) {
      case 'testing-model':
        router.push('/testing-model');
        break;
      case 'realtime-model':
        router.push('/realtime-model');
        break;
      case 'collected-dataset':
        router.push('/collected-dataset');
        break;
      case 'collected-dataset-custom':
        router.push('/collected-dataset-customized');
        break;
      case 'process-set':
        router.push('/process_set');
        break;
      case 'preferences':
        router.push('/preferences');
        break;
      default:
        alert(`Navigating to ${destination} - This feature is coming soon!`);
        break;
    }
  };

  // Get button class based on consent status and admin override
  const getButtonClass = (destination) => {
    if (destination === 'collected-dataset-custom') {
      const isEnabled = buttonStates[userId] || isAdminOverride;
      console.log('Button state check:', { userId, buttonStates, isEnabled });
      return isEnabled ? styles.buttonEnabled : styles.buttonDisabled;
    }
    return styles.button;
  };

  const getProcessButtonClass = () => {
    if (!mounted) return `${styles.menuButton} ${styles.largerButton}`;

    const readyClass =
      isProcessReady && isConnected && authValid
        ? styles.readyButton
        : styles.notReadyButton;

    return `${styles.menuButton} ${styles.largerButton} ${readyClass}`;
  };

  // Add button overlay component
  const ButtonOverlay = ({ destination }) => {
    if (destination === 'collected-dataset-custom') {
      const showOverlay = !buttonStates[userId] && !isAdminOverride;
      console.log('Overlay check:', { userId, buttonStates, showOverlay });
      if (showOverlay) {
        return (
          <div className={styles.buttonOverlay}>
            <span className={styles.overlayIcon}>✕</span>
          </div>
        );
      }
    }
    return null;
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Eye Tracking Application</h1>
        <p className={styles.description}>Select one of the options below to get started</p>

        <div className={styles.buttonGrid}>
          <button className={styles.menuButton} onClick={() => handleButtonClick('testing-model')}>
            <h2>Testing Single Model</h2>
          </button>
          <button className={styles.menuButton} onClick={() => handleButtonClick('realtime-model')}>
            <h2>Realtime Model</h2>
          </button>
          <button 
            className={getButtonClass('collected-dataset-custom')} 
            onClick={() => handleButtonClick('collected-dataset-custom')}
          >
            <h2>Collected Dataset with customization</h2>
            <ButtonOverlay destination="collected-dataset-custom" />
          </button>
          <button className={styles.menuButton} onClick={() => handleButtonClick('collected-dataset')}>
            <h2>Collected Dataset</h2>
          </button>
        </div>

        {/* Third row: Process Folder Button */}
        <div className={styles.centerButtonContainer}>
          <button className={getProcessButtonClass()} onClick={() => handleButtonClick('process-set')}>
            <h2>Process Image Folder</h2>
          </button>
        </div>

        {mounted && userId && (
          <div className={styles.userInfo}>
            <p>User ID: {userId}</p>
            <p>Consent Status: {consentStatus === null ? 'Not set' : consentStatus ? 'Accepted' : 'Declined'}</p>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <a 
          href="https://www.facebook.com/profile.php?id=61557265122746" 
          target="_blank" 
          rel="noopener noreferrer"
          className={styles.footerLink}
          onClick={(e) => {
            e.preventDefault();
            window.open('https://www.facebook.com/profile.php?id=61557265122746', '_blank');
          }}
        >
          Powered by Porch
        </a>
      </footer>
    </div>
  );
}