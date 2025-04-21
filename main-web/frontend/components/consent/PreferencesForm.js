// frontend/components/consent/PreferencesForm.js
import { useState } from 'react';
import styles from '../../styles/Consent.module.css';

export default function PreferencesForm({ initialValues, onSubmit, onCancel, loading = false }) {
  const [formValues, setFormValues] = useState(initialValues || {
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
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    
    if (name === 'consentStatus') {
      setFormValues(prev => ({
        ...prev,
        consentStatus: checked
      }));
      return;
    }
    
    // Handle nested properties
    if (name.startsWith('notification.')) {
      const field = name.replace('notification.', '');
      setFormValues(prev => ({
        ...prev,
        notificationSettings: {
          ...prev.notificationSettings,
          [field]: checked
        }
      }));
    } else if (name.startsWith('image.')) {
      const field = name.replace('image.', '');
      setFormValues(prev => ({
        ...prev,
        imageProcessingSettings: {
          ...prev.imageProcessingSettings,
          [field]: checked
        }
      }));
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formValues);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <h2>Cookie Consent</h2>
      <div className={styles.formSwitch}>
        <input
          type="checkbox"
          name="consentStatus"
          id="consentStatus"
          className={styles.formCheckbox}
          checked={formValues.consentStatus === true}
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
          value={formValues.theme}
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
          value={formValues.language}
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
          checked={formValues.notificationSettings?.emailNotifications === true}
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
          checked={formValues.notificationSettings?.pushNotifications === true}
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
          value={formValues.imageProcessingSettings?.quality || 'high'}
          onChange={(e) => {
            setFormValues(prev => ({
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
          checked={formValues.imageProcessingSettings?.autoEnhance === true}
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
          checked={formValues.imageProcessingSettings?.showHeadPose === true}
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
          checked={formValues.imageProcessingSettings?.showBoundingBox === true}
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
          checked={formValues.imageProcessingSettings?.showMask === true}
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
          checked={formValues.imageProcessingSettings?.showParameters === true}
          onChange={handleCheckboxChange}
        />
        <label htmlFor="showParameters">
          Show tracking parameters
        </label>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        {onCancel && (
          <button 
            type="button" 
            className={styles.backButton}
            onClick={onCancel}
          >
            Back
          </button>
        )}
        <button 
          type="submit" 
          className={styles.submitButton}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </form>
  );
}