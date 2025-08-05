// frontend/components/consent_ui/privacy-policy.js
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../styles/Consent.module.css';

export default function PrivacyPolicyComponent() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Privacy Policy | Eye Tracking App</title>
      </Head>
      <div className={styles.preferencesContainer}>
        <h1 className={styles.preferencesTitle}>Privacy Policy</h1>
        
        <h2>Cookie Policy</h2>
        <p>Our website uses cookies to enhance your browsing experience, analyze site traffic, 
        and personalize content. This Cookie Policy explains how we use cookies and similar technologies.</p>
        
        <h3>What are Cookies?</h3>
        <p>
          Cookies are small text files that are stored on your device when you visit a website. 
          They help us recognize your device and remember certain information about your visit.
        </p>
        
        <h3>Types of Cookies We Use</h3>
        
        <h4>Essential Cookies</h4>
        <p>
          These cookies are necessary for the website to function properly. They enable basic 
          functions like page navigation and access to secure areas of the website. The website 
          cannot function properly without these cookies.
        </p>
        
        <h4>Analytics Cookies</h4>
        <p>
          These cookies help us understand how visitors interact with our website by collecting 
          and reporting information anonymously. This helps us improve our website.
        </p>
        
        <h4>Preference Cookies</h4>
        <p>
          These cookies enable the website to remember choices you make and provide enhanced, 
          personalized features. They may be set by us or by third-party providers whose services 
          we have added to our pages.
        </p>
        
        <h4>Marketing Cookies</h4>
        <p>
          These cookies are used to track visitors across websites. The intention is to display 
          ads that are relevant and engaging for the individual user.
        </p>
        
        <h3>Managing Cookies</h3>
        <p>
          You can set your browser to refuse all or some browser cookies, or to alert you when 
          websites set or access cookies. If you disable or refuse cookies, please note that some 
          parts of this website may become inaccessible or not function properly.
        </p>
        
        <h3>Contact Us</h3>
        <p>
          If you have any questions about our use of cookies, please contact us at privacy@eyetrackingapp.com.
        </p>
        
        <div style={{ marginTop: '30px' }}>
          <button 
            className={styles.backButton}
            onClick={() => router.back()}
          >
            Back
          </button>
          <button 
            className={styles.submitButton}
            onClick={() => router.push('/preferences/consent-setup')}
          >
            Configure Cookie Preferences
          </button>
        </div>
      </div>
    </>
  );
}