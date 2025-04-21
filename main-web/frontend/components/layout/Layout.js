// frontend/components/layout/Layout.js
import Head from 'next/head';
import ConsentBanner from '../consent/ConsentBanner';

export default function Layout({ children, title = 'Eye Tracking App' }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Eye tracking application with multiple models" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main>
        {children}
      </main>
      
      {/* Cookie consent banner - always present but only visible based on consent state */}
      <ConsentBanner />
    </>
  );
}