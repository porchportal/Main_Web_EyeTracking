import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';

export default function HomePage() {
  const router = useRouter();

  const handleButtonClick = (destination) => {
    if (destination === 'testing-model') {
      router.push('/testing-model');
    } else if (destination === 'collected-dataset') {
      router.push('/collected-dataset');
    } else {
      // For other buttons, we'll just show an alert for now
      alert(`Navigating to ${destination} - This feature is coming soon!`);
    }
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