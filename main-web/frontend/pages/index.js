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
  
  // Use local state for client-side rendering to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  
  // Once component mounts, we can safely render the button with the correct state
  useEffect(() => {
    setMounted(true);
    
    // Check backend connection on page load
    checkConnection(true);
  }, []);
  
  const handleButtonClick = (destination) => {
    // Check connection before navigating
    if (destination === 'process-set' && (!isConnected || !authValid)) {
      // Try to reconnect first
      checkConnection(true);
      
      if (!isConnected) {
        alert('Unable to connect to backend. Please make sure the backend server is running.');
        return;
      } else if (!authValid) {
        alert('Connected to backend but authentication failed. Please check your API key.');
        return;
      }
    }
    
    if (destination === 'testing-model') {
      router.push('/testing-model');
    } else if (destination === 'collected-dataset') {
      router.push('/collected-dataset');
    } else if (destination === 'process-set') {
      router.push('/process_set');
    } else if (destination === 'preferences') {
      router.push('/preferences');
    } else {
      // For other buttons, we'll just show an alert for now
      alert(`Navigating to ${destination} - This feature is coming soon!`);
    }
  };
  
  // Determine the CSS classes for the process button based on state and connection
  const getProcessButtonClass = () => {
    if (!mounted) return `${styles.menuButton} ${styles.largerButton}`;
    
    const readyClass = (isProcessReady && isConnected && authValid) 
      ? styles.readyButton 
      : styles.notReadyButton;
    
    return `${styles.menuButton} ${styles.largerButton} ${readyClass}`;
  };
  
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>
          Eye Tracking Application
        </h1>
        
        <p className={styles.description}>
          Select one of the options below to get started
        </p>
        
        <div className={styles.buttonGrid}>
          <button 
            className={styles.menuButton}
            onClick={() => handleButtonClick('collected-dataset')}
          >
            <h2>Collected Dataset</h2>
          </button>
          
          <button 
            className={styles.menuButton}
            onClick={() => handleButtonClick('testing-model')}
          >
            <h2>Testing Single Model</h2>
          </button>
          
          <button 
            className={styles.menuButton}
            onClick={() => handleButtonClick('realtime-model')}
          >
            <h2>Realtime Model</h2>
          </button>
        </div>
        
        <div className={styles.centerButtonContainer}>
          <button 
            className={getProcessButtonClass()}
            onClick={() => handleButtonClick('process-set')}
          >
            <h2>Process Image Folder</h2>
          </button>
        </div>
        
        {/* Display consent status if available */}
        {mounted && userId && (
          <div className={styles.userInfo}>
            <p>User ID: {userId}</p>
            <p>Consent Status: {consentStatus === null ? 'Not set' : consentStatus ? 'Accepted' : 'Declined'}</p>
          </div>
        )}
      </main>
      
      <footer className={styles.footer}>
        <a
          href="https://yourwebsite.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by Porch
        </a>
      </footer>
    </div>
  );
}