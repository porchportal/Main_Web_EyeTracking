import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import { useProcessStatus } from '../utils/stateManager';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const { isProcessReady, toggleProcessStatus } = useProcessStatus();
  // Use local state for client-side rendering to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  
  // Once component mounts, we can safely render the button with the correct state
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const handleButtonClick = (destination) => {
    if (destination === 'testing-model') {
      router.push('/testing-model');
    } else if (destination === 'collected-dataset') {
      router.push('/collected-dataset');
    } else if (destination === 'process-set') {
      router.push('/process_set');
    } else {
      // For other buttons, we'll just show an alert for now
      alert(`Navigating to ${destination} - This feature is coming soon!`);
    }
  };
  
  // Determine the CSS classes for the process button based on state
  const getProcessButtonClass = () => {
    if (!mounted) return `${styles.menuButton} ${styles.largerButton}`;
    
    return `${styles.menuButton} ${styles.largerButton} ${
      isProcessReady ? styles.readyButton : styles.notReadyButton
    }`;
  };
  
  return (
    <div className={styles.container}>
      <Head>
        <title>Eye Tracking App</title>
        <meta name="description" content="Eye tracking application with multiple models" />
        <link rel="icon" href="/eye-tracking-app/favicon.ico" />
      </Head>
      
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
            <h2>Testing Singal Model</h2>
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
            <p className={styles.statusText}>
              {mounted && (isProcessReady ? 'Ready' : 'Not Ready')}
            </p>
          </button>
          
          <button 
            className={styles.statusToggleButton}
            onClick={toggleProcessStatus}
          >
            Toggle Status ({mounted && (isProcessReady ? 'Ready' : 'Not Ready')})
          </button>
        </div>
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