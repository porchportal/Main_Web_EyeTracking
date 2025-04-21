// frontend/pages/preferences/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../../styles/Consent.module.css';
import { useConsent } from '../../components/consent/ConsentContext';
import { getUserPreferences, updateUserPreferences } from '../../utils/consentManager';

export default function PreferencesPage() {
  const { userId, consentStatus, updateConsent } = useConsent();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    consentStatus: null,
    theme: 'light',
    language: 'en',
    notificationSettings: {
      emailNotifications: false,
      pushNotifications: false
    },
    imageProcessingSettings: {
      quality: 'high',
      autoEnhance: true,
      showHeadPose: true,
      showBoundingBox: false,
      showMask: false,
      showParameters: true
    }
  });
  
  // Fetch user preferences when component mounts
  useEffect(() => {
    const fetchPreferences = async () => {
      if (!userId) return;
      
      try {
        setLoading(true);
        const data = await getUserPreferences(userId);
        
        // Transform backend data to frontend format
        setPreferences({
          consentStatus: data.consent_status,
          theme: data.theme || 'light',
          language: data.language || 'en',
          notificationSettings: data.notification_settings || {
            emailNotifications: false,
            pushNotifications: false
          },
          imageProcessingSettings: data.image_processing_settings || {
            quality: 'high',
            autoEnhance: true,
            showHeadPose: true,
            showBoundingBox: false,
            showMask: false,
            showParameters: true
          },
          preferences: data.preferences || {}
        });
      } catch (error) {
        console.error('Error fetching preferences:', error);
        // Use default preferences with current consent status
        setPreferences(prev => ({
          ...prev,
          consentStatus: consentStatus
        }));
      } finally {
        setLoading(false);
      }
    };
    
    fetchPreferences();
  }, [userId, consentStatus]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPreferences(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    
    if (name === 'consentStatus') {
      setPreferences(prev => ({
        ...prev,
        consentStatus: checked
      }));
      return;
    }
    
    // Handle nested properties
    if (name.startsWith('notification.')) {
      const field = name.replace('notification.', '');
      setPreferences(prev => ({
        ...prev,
        notificationSettings: {
          ...prev.notificationSettings,
          [field]: checked
        }
      }));
    } else if (name.startsWith('image.')) {
      const field = name.replace('image.', '');
      setPreferences(prev => ({
        ...prev,
        imageProcessingSettings: {
          ...prev.imageProcessingSettings,
          [field]: checked
        }
      }));
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      // Update consent status if changed
      if (preferences.consentStatus !== consentStatus) {
        await updateConsent(preferences.consentStatus);
      }
      
      // Update other preferences
      await updateUserPreferences(userId, {
        theme: preferences.theme,
        language: preferences.language,
        notificationSettings: preferences.notificationSettings,
        imageProcessingSettings: preferences.imageProcessingSettings
      });
      
      alert('Preferences saved successfully!');
      router.push('/');
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const handleBack = () => {
    router.back();
  };
  
  if (loading) {
    return (
      <div className={styles.preferencesContainer}>
        <h1 className={styles.preferencesTitle}>Loading preferences...</h1>
      </div>
    );
  }
  
  return (
    <>
      <Head>
        <title>User Preferences | Eye Tracking App</title>
      </Head>
      <div className={styles.preferencesContainer}>
        <h1 className={styles.preferencesTitle}>User Preferences</h1>
        
        <form onSubmit={handleSubmit}>
          <h2>Cookie Consent</h2>
          <div className={styles.formSwitch}>
            <input
              type="checkbox"
              name="consentStatus"
              id="consentStatus"
              className={styles.formCheckbox}
              checked={preferences.consentStatus === true}
              onChange={handleCheckboxChange}
            />
            <label htmlFor="consentStatus">
              I consent to the use of cookies to improve my experience
            </label>
          </div>
          
          <h2>Display Settings</h2>
          <div className={styles.formGroup}>
            <label htmlFor="theme" className={styles.formLabel}>Theme</label>
            <select
              name="theme"
              id="theme"
              className={styles.formControl}
              value={preferences.theme}
              onChange={handleInputChange}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System Default</option>
            </select>
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="language" className={styles.formLabel}>Language</label>
            <select
              name="language"
              id="language"
              className={styles.formControl}
              value={preferences.language}
              onChange={handleInputChange}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>
          
          <h2>Notification Settings</h2>
          <div className={styles.formSwitch}>
            <input
              type="checkbox"
              name="notification.emailNotifications"
              id="emailNotifications"
              className={styles.formCheckbox}
              checked={preferences.notificationSettings?.emailNotifications === true}
              onChange={handleCheckboxChange}
            />
            <label htmlFor="emailNotifications">
              Receive email notifications
            </label>
          </div>
          
          <div className={styles.formSwitch}>
            <input
              type="checkbox"
              name="notification.pushNotifications"
              id="pushNotifications"
              className={styles.formCheckbox}
              checked={preferences.notificationSettings?.pushNotifications === true}
              onChange={handleCheckboxChange}
            />
            <label htmlFor="pushNotifications">
              Receive push notifications
            </label>
          </div>
          
          <h2>Image Processing Settings</h2>
          <div className={styles.formGroup}>
            <label htmlFor="quality" className={styles.formLabel}>Processing Quality</label>
            <select
              name="quality"
              id="quality"
              className={styles.formControl}
              value={preferences.imageProcessingSettings?.quality || 'high'}
              onChange={(e) => {
                setPreferences(prev => ({
                  ...prev,
                  imageProcessingSettings: {
                    ...prev.imageProcessingSettings,
                    quality: e.target.value
                  }
                }));
              }}
            >
              <option value="low">Low (Faster)</option>
              <option value="medium">Medium</option>
              <option value="high">High (More accurate)</option>
            </select>
          </div>
          
          <div className={styles.formSwitch}>
            <input
              type="checkbox"
              name="image.autoEnhance"
              id="autoEnhance"
              className={styles.formCheckbox}
              checked={preferences.imageProcessingSettings?.autoEnhance === true}
              onChange={handleCheckboxChange}
            />
            <label htmlFor="autoEnhance">
              Auto-enhance images
            </label>
          </div>
          
          <div className={styles.formSwitch}>
            <input
              type="checkbox"
              name="image.showHeadPose"
              id="showHeadPose"
              className={styles.formCheckbox}
              checked={preferences.imageProcessingSettings?.showHeadPose === true}
              onChange={handleCheckboxChange}
            />
            <label htmlFor="showHeadPose">
              Show head pose
            </label>
          </div>
          
          <div className={styles.formSwitch}>
            <input
              type="checkbox"
              name="image.showBoundingBox"
              id="showBoundingBox"
              className={styles.formCheckbox}
              checked={preferences.imageProcessingSettings?.showBoundingBox === true}
              onChange={handleCheckboxChange}
            />
            <label htmlFor="showBoundingBox">
              Show bounding box
            </label>
          </div>
          
          <div className={styles.formSwitch}>
            <input
              type="checkbox"
              name="image.showMask"
              id="showMask"
              className={styles.formCheckbox}
              checked={preferences.imageProcessingSettings?.showMask === true}
              onChange={handleCheckboxChange}
            />
            <label htmlFor="showMask">
              Show face mask
            </label>
          </div>
          
          <div className={styles.formSwitch}>
            <input
              type="checkbox"
              name="image.showParameters"
              id="showParameters"
              className={styles.formCheckbox}
              checked={preferences.imageProcessingSettings?.showParameters === true}
              onChange={handleCheckboxChange}
            />
            <label htmlFor="showParameters">
              Show tracking parameters
            </label>
          </div>
          
          <div style={{ marginTop: '20px' }}>
            <button 
              type="button" 
              className={styles.backButton}
              onClick={handleBack}
            >
              Back
            </button>
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
      </>
    );
  }