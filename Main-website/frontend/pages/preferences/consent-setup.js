// frontend/pages/preferences/consent-setup.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../../styles/Consent.module.css';
import { useConsent } from '../../components/consent_ui/ConsentContext';
import { getOrCreateUserId, updateUserConsent } from '../../utils/consentManager';

export default function ConsentSetupPage() {
  const router = useRouter();
  const { consentStatus, updateConsent } = useConsent();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    analyticsConsent: true,
    preferencesConsent: true,
    marketingConsent: false,
    thirdPartyConsent: false
  });

  // If user hasn't accepted cookies yet, redirect back to home
  useEffect(() => {
    if (consentStatus === false) {
      router.push('/');
    }
  }, [consentStatus, router]);

  const handleChange = (e) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update consent preferences
      const userId = getOrCreateUserId();
      
      // For now, we'll just save this as a preference
      // In a production app, you'd store these granular consents
      const preferenceData = {
        userId,
        consentStatus: true,
        consentDetails: formData
      };
      
      // Update the consent in context
      await updateConsent(true);
      
      // Mock saving preferences
      localStorage.setItem('consent_details', JSON.stringify(formData));
      
      // Redirect to home or dashboard
      router.push('/');
    } catch (error) {
      console.error('Error saving consent preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Cookie Consent Setup | Eye Tracking App</title>
      </Head>
      <div className={styles.preferencesContainer}>
        <h1 className={styles.preferencesTitle}>Cookie Consent Preferences</h1>
        <p>Thank you for accepting cookies. Please select which types of cookies you'd like to allow:</p>

        <form onSubmit={handleSubmit}>
          <div className={styles.formSwitch}>
            <input
              type="checkbox"
              id="analyticsConsent"
              name="analyticsConsent"
              checked={formData.analyticsConsent}
              onChange={handleChange}
              className={styles.formCheckbox}
            />
            <label htmlFor="analyticsConsent">
              <strong>Analytics Cookies</strong> - Help us understand how visitors interact with our website
            </label>
          </div>

          <div className={styles.formSwitch}>
            <input
              type="checkbox"
              id="preferencesConsent"
              name="preferencesConsent"
              checked={formData.preferencesConsent}
              onChange={handleChange}
              className={styles.formCheckbox}
            />
            <label htmlFor="preferencesConsent">
              <strong>Preferences Cookies</strong> - Allow the website to remember choices you make
            </label>
          </div>

          <div className={styles.formSwitch}>
            <input
              type="checkbox"
              id="marketingConsent"
              name="marketingConsent"
              checked={formData.marketingConsent}
              onChange={handleChange}
              className={styles.formCheckbox}
            />
            <label htmlFor="marketingConsent">
              <strong>Marketing Cookies</strong> - Used to track visitors across websites for advertising
            </label>
          </div>

          <div className={styles.formSwitch}>
            <input
              type="checkbox"
              id="thirdPartyConsent"
              name="thirdPartyConsent"
              checked={formData.thirdPartyConsent}
              onChange={handleChange}
              className={styles.formCheckbox}
            />
            <label htmlFor="thirdPartyConsent">
              <strong>Third-party Cookies</strong> - Set by third-party services on our website
            </label>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => router.push('/')}
            >
              Skip for now
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}