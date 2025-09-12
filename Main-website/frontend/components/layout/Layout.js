// frontend/components/layout/Layout.js
import Head from 'next/head';
import { lazy, Suspense, useState, useEffect } from 'react';
import UserProfileSidebar from '../profile/UserProfileSidebar';
import styles from '../../styles/Consent.module.css';
import { useConsent } from '../consent_ui/ConsentContext';

// Lazy load the consent banner for better performance
const ConsentBanner = lazy(() => import('../consent_ui/ConsentBanner'));

export default function Layout({ children, title = 'Eye Tracking App' }) {
  const { showBanner } = useConsent();
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Eye tracking application with multiple models" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Performance optimizations - removed preload as images load after consent */}
      </Head>
      
      {/* Cookie consent banner at the top - only render on client */}
      {isClient && (
        <Suspense fallback={<div className={styles.bannerContainer}><div className={styles.bannerContent}><div className={styles.skeletonText}></div></div></div>}>
          <ConsentBanner />
        </Suspense>
      )}
      
      <main className={`${styles.mainContent} ${showBanner ? styles.withBanner : ''}`}>
        {children}
      </main>

      {/* User Profile Sidebar */}
      <UserProfileSidebar />
    </>
  );
}