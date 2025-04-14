import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../../styles/Home.module.css';
import { useProcessStatus } from '../../utils/stateManager';
import { useEffect, useState } from 'react';

export default function ProcessSet() {
  const router = useRouter();
  const { isProcessReady, setProcessStatus } = useProcessStatus();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={styles.container}>
      <Head>
        <title>Process Image Folder | Eye Tracking App</title>
        <meta name="description" content="Process image folder for eye tracking" />
        <link rel="icon" href="/eye-tracking-app/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Process Image Folder
        </h1>
        
        <p className={styles.description}>
          Upload and process multiple images for eye tracking
        </p>
        
        <div className={styles.statusDisplay}>
          Current Status: {mounted && (isProcessReady ? 'Ready' : 'Not Ready')}
        </div>

        <div className={styles.uploaderContainer}>
          {/* Folder uploader component would go here */}
          {/* For now we'll just show dummy controls */}
          <div className={styles.dummyControls}>
            <button className={styles.processingButton} onClick={() => setProcessStatus(true)}>
              Mark as Ready
            </button>
            <button className={styles.processingButton} onClick={() => setProcessStatus(false)}>
              Mark as Not Ready
            </button>
          </div>
        </div>
        
        <button 
          className={styles.backButton}
          onClick={() => router.push('/')}
        >
          Back to Home
        </button>
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