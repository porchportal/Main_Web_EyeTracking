import Head from 'next/head';
import { useRouter } from 'next/router';
import ImageUploader from './ImageUploader';
import styles from './TestingImage.module.css';

export default function TestingModel() {
  const router = useRouter();

  return (
    <div className={styles.container}>
      <Head>
        <title>Face Analysis App</title>
        <meta name="description" content="Face analysis with head pose detection" />
        <link rel="icon" href="/eye-tracking-app/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Face Analysis
        </h1>
        
        <p className={styles.description}>
          Upload an image to analyze face landmarks and head pose detection
        </p>

        <div className={styles.uploaderContainer}>
          <ImageUploader />
        </div>
      </main>
      
      <button 
        className={styles.backButton}
        onClick={() => router.push('/')}
      >
        ← Back to Home
      </button>

      <footer className={styles.footer}>
        <a 
          href="https://yourwebsite.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footerLink}
        >
        </a>
      </footer>
    </div>
  );
}
