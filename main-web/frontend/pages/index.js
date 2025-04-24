// frontend/pages/index.js
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import { useProcessStatus, useBackendConnection } from '../utils/stateManager';
import { useEffect, useState } from 'react';
import { useConsent } from '../components/consent/ConsentContext';

export default function HomePage() {
  const router = useRouter();
  const { isProcessReady, toggleProcessStatus } = useProcessStatus();
  const { isConnected, authValid, checkConnection } = useBackendConnection();
  const { consentStatus, userId } = useConsent();
  const [isAdminOverride, setIsAdminOverride] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    checkConnection(true);

    // Listen for admin override events
    const handleAdminOverride = (event) => {
      if (event.detail && event.detail.type === 'adminOverride') {
        setIsAdminOverride(event.detail.enabled);
      }
    };

    window.addEventListener('adminOverride', handleAdminOverride);
    return () => {
      window.removeEventListener('adminOverride', handleAdminOverride);
    };
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
      if (!consentStatus && !isAdminOverride) {
        alert('Please accept cookies to access this feature.');
        return;
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
      if (consentStatus || isAdminOverride) {
        return styles.buttonEnabled;
      } else {
        return styles.buttonDisabled;
      }
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
          <button className={styles.menuButton} onClick={() => handleButtonClick('collected-dataset-custom')}>
            <h2>Collected Dataset with customization</h2>
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
        <a href="https://yourwebsite.com" target="_blank" rel="noopener noreferrer">
          Powered by Porch
        </a>
      </footer>
    </div>
  );
}