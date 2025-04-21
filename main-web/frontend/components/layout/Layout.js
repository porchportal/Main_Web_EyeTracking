// frontend/components/layout/Layout.js
import Head from 'next/head';
import ConsentBanner from '../consent/ConsentBanner';
import styles from '../../styles/Consent.module.css';

export default function Layout({ children, title = 'Eye Tracking App' }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Eye tracking application with multiple models" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      {/* Cookie consent banner at the top */}
      <ConsentBanner />
      
      <main className={styles.mainContent}>
        {children}
      </main>
    </>
  );
}