import Head from 'next/head';
import ImageUploader from '../components/ImageUploader';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Face Analysis App</title>
        <meta name="description" content="Face analysis with head pose detection" />
        <link rel="icon" href="/eye-tracking-app/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Face Analysis Application
        </h1>
        
        <p className={styles.description}>
          Upload an image to analyze face and head pose
        </p>

        <div className={styles.uploaderContainer}>
          <ImageUploader />
        </div>
      </main>

      <footer className={styles.footer}>
        <a 
          href="https://yourwebsite.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by Your Company
        </a>
      </footer>
    </div>
  );
}