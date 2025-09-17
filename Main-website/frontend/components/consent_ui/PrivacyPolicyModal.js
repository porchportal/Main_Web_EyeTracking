// frontend/components/consent_ui/PrivacyPolicyModal.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../../styles/Consent.module.css';

export default function PrivacyPolicyModal({ isOpen, onClose }) {
  const router = useRouter();
  const [cookieConsent, setCookieConsent] = useState(null);

  // Load current consent status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const consent = localStorage.getItem('cookieConsent');
      setCookieConsent(consent ? JSON.parse(consent) : null);
    }
  }, []);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleConfigurePreferences = () => {
    onClose();
    try {
      router.push('/preferences/consent-setup');
    } catch (error) {
      console.error('Navigation error:', error);
      router.push('/');
    }
  };

  const handleAcceptAll = () => {
    const consent = {
      essential: true,
      analytics: true,
      preferences: true,
      marketing: true,
      timestamp: Date.now(),
      version: '1.0'
    };
    localStorage.setItem('cookieConsent', JSON.stringify(consent));
    setCookieConsent(consent);
    alert('All cookies accepted! You can change your preferences anytime.');
  };

  const handleRejectAll = () => {
    const consent = {
      essential: true, // Essential cookies cannot be disabled
      analytics: false,
      preferences: false,
      marketing: false,
      timestamp: Date.now(),
      version: '1.0'
    };
    localStorage.setItem('cookieConsent', JSON.stringify(consent));
    setCookieConsent(consent);
    alert('Non-essential cookies rejected. Essential cookies remain active for website functionality.');
  };

  const getConsentStatus = () => {
    if (!cookieConsent) return 'Not set';
    const { analytics, preferences, marketing } = cookieConsent;
    const nonEssential = [analytics, preferences, marketing].filter(Boolean).length;
    return `${nonEssential}/3 non-essential cookie categories accepted`;
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Privacy Policy & Cookie Policy</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Current Consent Status */}
          {cookieConsent && (
            <div className={styles.consentStatusCard}>
              <h3 className={styles.consentStatusTitle}>Current Cookie Settings</h3>
              <p className={styles.consentStatusText}>{getConsentStatus()}</p>
              <p className={styles.consentStatusDate}>
                Last updated: {new Date(cookieConsent.timestamp).toLocaleString()}
              </p>
            </div>
          )}

          {/* Cookie Policy Content */}
          <div className={styles.policySection}>
            <h3 className={styles.sectionTitle}>🍪 Cookie Policy</h3>
            <p className={styles.sectionText}>
              Our website uses cookies to enhance your browsing experience, analyze site traffic, 
              and personalize content. This Cookie Policy explains how we use cookies and similar technologies.
            </p>
          </div>

          <div className={styles.policySection}>
            <h3 className={styles.sectionTitle}>What are Cookies?</h3>
            <p className={styles.sectionText}>
              Cookies are small text files that are stored on your device when you visit a website. 
              They help us recognize your device and remember certain information about your visit.
            </p>
          </div>

          {/* Cookie Types */}
          <div className={styles.cookieTypesContainer}>
            <div className={styles.cookieTypeCard}>
              <div className={styles.cookieTypeHeader}>
                <span className={styles.cookieTypeIcon}>🔒</span>
                <h4 className={styles.cookieTypeTitle}>Essential Cookies</h4>
              </div>
              <div className={styles.cookieTypeContent}>
                <p className={styles.cookieTypePurpose}>
                  <strong>Purpose:</strong> These cookies are necessary for the website to function properly. 
                  They enable basic functions like page navigation, user authentication, and access to secure areas.
                </p>
                <p className={styles.cookieTypeExamples}>
                  <strong>Examples:</strong> Session ID, user authentication, camera settings, consent status
                </p>
                <p className={styles.cookieTypeDuration}>
                  <strong>Duration:</strong> Session-based or up to 24 hours
                </p>
                <p className={styles.cookieTypeWarning}>
                  ⚠️ These cookies cannot be disabled as they are essential for website functionality.
                </p>
              </div>
            </div>

            <div className={styles.cookieTypeCard}>
              <div className={styles.cookieTypeHeader}>
                <span className={styles.cookieTypeIcon}>📊</span>
                <h4 className={styles.cookieTypeTitle}>Analytics Cookies</h4>
              </div>
              <div className={styles.cookieTypeContent}>
                <p className={styles.cookieTypePurpose}>
                  <strong>Purpose:</strong> These cookies help us understand how visitors interact with our website 
                  by collecting and reporting information anonymously. This helps us improve our website performance and user experience.
                </p>
                <p className={styles.cookieTypeExamples}>
                  <strong>Examples:</strong> Page views, session duration, button clicks, error tracking
                </p>
                <p className={styles.cookieTypeDuration}>
                  <strong>Duration:</strong> Up to 30 days
                </p>
                <p className={styles.cookieTypeInfo}>
                  ℹ️ These cookies are optional and can be disabled without affecting website functionality.
                </p>
              </div>
            </div>

            <div className={styles.cookieTypeCard}>
              <div className={styles.cookieTypeHeader}>
                <span className={styles.cookieTypeIcon}>⚙️</span>
                <h4 className={styles.cookieTypeTitle}>Preference Cookies</h4>
              </div>
              <div className={styles.cookieTypeContent}>
                <p className={styles.cookieTypePurpose}>
                  <strong>Purpose:</strong> These cookies enable the website to remember choices you make and provide 
                  enhanced, personalized features. They may be set by us or by third-party providers whose services 
                  we have added to our pages.
                </p>
                <p className={styles.cookieTypeExamples}>
                  <strong>Examples:</strong> Theme preferences, language settings, camera preferences, canvas settings
                </p>
                <p className={styles.cookieTypeDuration}>
                  <strong>Duration:</strong> Up to 90 days
                </p>
                <p className={styles.cookieTypeInfo}>
                  ℹ️ These cookies are optional and can be disabled, but may affect personalized features.
                </p>
              </div>
            </div>

            <div className={styles.cookieTypeCard}>
              <div className={styles.cookieTypeHeader}>
                <span className={styles.cookieTypeIcon}>📢</span>
                <h4 className={styles.cookieTypeTitle}>Marketing Cookies</h4>
              </div>
              <div className={styles.cookieTypeContent}>
                <p className={styles.cookieTypePurpose}>
                  <strong>Purpose:</strong> These cookies are used to track visitors across websites. The intention 
                  is to display ads that are relevant and engaging for the individual user.
                </p>
                <p className={styles.cookieTypeExamples}>
                  <strong>Examples:</strong> Advertising ID, campaign tracking, conversion tracking
                </p>
                <p className={styles.cookieTypeDuration}>
                  <strong>Duration:</strong> Up to 180 days
                </p>
                <p className={styles.cookieTypeInfo}>
                  ℹ️ These cookies are optional and can be disabled without affecting website functionality.
                </p>
              </div>
            </div>
          </div>

          {/* Data Protection Section */}
          <div className={styles.policySection}>
            <h3 className={styles.sectionTitle}>🛡️ Data Protection & Privacy</h3>
            <p className={styles.sectionText}>
              We are committed to protecting your privacy and complying with applicable data protection laws, 
              including GDPR and CCPA. Here's how we protect your data:
            </p>
            <ul className={styles.protectionList}>
              <li><strong>Data Minimization:</strong> We only collect data that is necessary for our services</li>
              <li><strong>Purpose Limitation:</strong> Data is used only for the purposes stated in this policy</li>
              <li><strong>Storage Limitation:</strong> Data is automatically deleted after specified periods</li>
              <li><strong>Transparency:</strong> Clear information about data collection and use</li>
              <li><strong>User Control:</strong> You can manage your cookie preferences at any time</li>
            </ul>
          </div>

          {/* User Rights Section */}
          <div className={styles.policySection}>
            <h3 className={styles.sectionTitle}>👤 Your Rights</h3>
            <p className={styles.sectionText}>Under applicable privacy laws, you have the following rights:</p>
            <ul className={styles.rightsList}>
              <li><strong>Right to Access:</strong> View your stored data</li>
              <li><strong>Right to Rectification:</strong> Correct inaccurate data</li>
              <li><strong>Right to Erasure:</strong> Request data deletion</li>
              <li><strong>Right to Portability:</strong> Export your data</li>
              <li><strong>Right to Object:</strong> Opt-out of data processing</li>
            </ul>
          </div>

          {/* Managing Cookies Section */}
          <div className={styles.policySection}>
            <h3 className={styles.sectionTitle}>🔧 Managing Cookies</h3>
            <p className={styles.sectionText}>
              You can manage your cookie preferences in several ways:
            </p>
            <ol className={styles.managementList}>
              <li>Use the "Configure Cookie Preferences" button below</li>
              <li>Set your browser to refuse all or some browser cookies</li>
              <li>Configure your browser to alert you when websites set or access cookies</li>
            </ol>
            <p className={styles.managementWarning}>
              ⚠️ Note: If you disable essential cookies, some parts of this website may become inaccessible or not function properly.
            </p>
            <p className={styles.datasetWarning}>
              <strong>Important:</strong> In this Website, if you didn't accept the cookie, you cannot collect the dataset at all.
            </p>
          </div>

          {/* Policy Updates Section */}
          <div className={styles.policySection}>
            <h3 className={styles.sectionTitle}>📋 Policy Updates</h3>
            <p className={styles.sectionText}>
              We may update this Privacy Policy and Cookie Policy from time to time. We will notify you of any 
              significant changes and may ask you to renew your consent for new data uses.
            </p>
            <p className={styles.lastUpdated}>
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          <button className={styles.modalButton} onClick={onClose}>
            Close
          </button>
          <button 
            className={`${styles.modalButton} ${styles.primaryButton}`}
            onClick={handleConfigurePreferences}
          >
            ⚙️ Configure Cookie Preferences
          </button>
          <button 
            className={`${styles.modalButton} ${styles.successButton}`}
            onClick={handleAcceptAll}
          >
            ✅ Accept All Cookies
          </button>
          <button 
            className={`${styles.modalButton} ${styles.dangerButton}`}
            onClick={handleRejectAll}
          >
            ❌ Reject Non-Essential
          </button>
        </div>
      </div>
    </div>
  );
}
