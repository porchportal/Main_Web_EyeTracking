import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/UserProfile.module.css';
import { getUserProfile, updateUserProfile } from '../utils/consentManager';
import { useConsent } from './consent/ConsentContext';
import { useBackendConnection } from '../utils/stateManager';

export default function UserProfileSidebar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [profile, setProfile] = useState({
    username: '',
    sex: '',
    age: '',
    image_background: '',
    preferences: {}
  });
  const [statusMessage, setStatusMessageLocal] = useState('');
  const [captureSettings, setCaptureSettings] = useState({
    time: 3,
    delay: 5
  });

  // Get consent and backend status
  const { userId, consentStatus } = useConsent();
  const { isConnected, authValid } = useBackendConnection();

  // Load profile data when component mounts or consent changes
  useEffect(() => {
    const loadProfile = () => {
      const savedProfile = getUserProfile();
      if (savedProfile) {
        setProfile(savedProfile);
      }
    };
    loadProfile();
  }, [consentStatus]);

  // Reset sidebar state when route changes
  useEffect(() => {
    setIsOpen(false);
    setShowSettings(false);
    setSettingsError('');
  }, [router.pathname]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = () => {
    try {
      updateUserProfile(profile);
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const handleSettingsClick = () => {
    if (router.pathname === '/collected-dataset-customized') {
      setShowSettings(true);
      // Send message to main page to show settings
      window.postMessage({ type: 'SHOW_SETTINGS', show: true }, '*');
      setSettingsError('');
    } else {
      setSettingsError('📌 You have to click the "Collected Dataset with customization" button first');
    }
  };

  // Add effect to listen for settings visibility changes
  useEffect(() => {
    const handleSettingsMessage = (event) => {
      if (event.data.type === 'SHOW_SETTINGS') {
        setShowSettings(event.data.show);
      }
    };

    window.addEventListener('message', handleSettingsMessage);
    return () => {
      window.removeEventListener('message', handleSettingsMessage);
    };
  }, []);

  const updateStatusMessage = (message) => {
    if (setStatusMessage) {
      setStatusMessage(message);
    }
    setStatusMessageLocal(message);
  };

  // Add function to handle capture settings changes
  const handleCaptureSettingsChange = (e) => {
    const { name, value } = e.target;
    setCaptureSettings(prev => ({
      ...prev,
      [name]: parseInt(value) || 0
    }));
    
    // Send message to main page to update settings
    window.postMessage({ 
      type: 'UPDATE_CAPTURE_SETTINGS', 
      settings: {
        ...captureSettings,
        [name]: parseInt(value) || 0
      }
    }, '*');
  };

  // Don't render anything if consent is not accepted
  if (!consentStatus) {
    return null;
  }

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 100 }}>
      <button 
        className={styles.toggleButton}
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          zIndex: 100,
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#0d6efd',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          fontSize: '20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyItems: 'center',
          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)'
        }}
      >
        {isOpen ? '×' : '☰'}
      </button>

      <div 
        className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}
        style={{ 
          zIndex: 49,
          position: 'fixed',
          top: 0,
          right: isOpen ? '0' : '-400px',
          width: '400px',
          height: '100vh',
          background: 'white',
          boxShadow: '-2px 0 5px rgba(0, 0, 0, 0.1)',
          transition: 'right 0.3s ease',
          overflowY: 'auto'
        }}
      >
        <div className={styles.profileHeader}>
          <h2>User Profile</h2>
          <button 
            className={styles.closeButton}
            onClick={() => setIsOpen(false)}
          >
            ×
          </button>
        </div>

        {/* Status Information */}
        <div className={styles.statusSection}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>User ID:</span>
            <span className={styles.statusValue}>{userId || 'Not set'}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Consent Status:</span>
            <span className={`${styles.statusValue} ${consentStatus ? styles.statusActive : styles.statusInactive}`}>
              {consentStatus === null ? 'Not set' : consentStatus ? 'Accepted' : 'Declined'}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Backend Status:</span>
            <span className={`${styles.statusValue} ${isConnected ? styles.statusActive : styles.statusInactive}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {isConnected && (
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Authentication:</span>
              <span className={`${styles.statusValue} ${authValid ? styles.statusActive : styles.statusInactive}`}>
                {authValid ? 'Valid' : 'Invalid'}
              </span>
            </div>
          )}
        </div>

        {!showSettings ? (
          <div className={styles.profileForm}>
            <div className={styles.formGroup}>
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={profile.username}
                onChange={handleInputChange}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="sex">Sex</label>
              <select
                id="sex"
                name="sex"
                value={profile.sex}
                onChange={handleInputChange}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="age">Age</label>
              <input
                type="number"
                id="age"
                name="age"
                value={profile.age}
                onChange={handleInputChange}
                min="1"
                max="120"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="image_background">Background Image URL</label>
              <input
                type="text"
                id="image_background"
                name="image_background"
                value={profile.image_background}
                onChange={handleInputChange}
                placeholder="Enter image URL"
              />
            </div>

            <button 
              className={styles.saveButton}
              onClick={handleSave}
            >
              Save Profile
            </button>

            <button 
              className={styles.settingsButton}
              onClick={handleSettingsClick}
              style={{
                backgroundColor: settingsError ? '#dc3545' : '#0d6efd',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                marginTop: '10px',
                width: '100%'
              }}
            >
              Settings
            </button>
            {settingsError && (
              <div style={{ color: '#dc3545', marginTop: '10px', textAlign: 'center' }}>
                {settingsError}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.settingsPanel}>
            <div className={styles.settingsHeader}>
              <h2>Settings</h2>
              <button 
                className={styles.backButton}
                onClick={() => {
                  setShowSettings(false);
                  window.postMessage({ type: 'SHOW_SETTINGS', show: false }, '*');
                }}
              >
                ← Back
              </button>
            </div>
            
            <div className={styles.settingsContent}>
              <div className={styles.settingsSection}>
                <h3>General Settings</h3>
                <div className={styles.settingItem}>
                  <label>Dark Mode</label>
                  <input type="checkbox" />
                </div>
                <div className={styles.settingItem}>
                  <label>Notifications</label>
                  <input type="checkbox" />
                </div>
              </div>
              
              <div className={styles.settingsSection}>
                <h3>Data Collection</h3>
                <div className={styles.settingItem}>
                  <label>Enable Eye Tracking</label>
                  <input type="checkbox" />
                </div>
                <div className={styles.settingItem}>
                  <label>Data Collection Frequency</label>
                  <select>
                    <option>Every 5 minutes</option>
                    <option>Every 10 minutes</option>
                    <option>Every 30 minutes</option>
                  </select>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h3>Capture Settings</h3>
                <div className={styles.settingsSubScroll}>
                  <div className={styles.settingItem}>
                    <label>Time(s):</label>
                    <input
                      type="number"
                      name="time"
                      value={captureSettings.time}
                      onChange={handleCaptureSettingsChange}
                      min="1"
                      max="10"
                      className={styles.numberInput}
                    />
                  </div>
                  <div className={styles.settingItem}>
                    <label>Delay(s):</label>
                    <input
                      type="number"
                      name="delay"
                      value={captureSettings.delay}
                      onChange={handleCaptureSettingsChange}
                      min="1"
                      max="30"
                      className={styles.numberInput}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h3>Image Settings</h3>
                <div className={styles.settingItem}>
                  <label>Upload Image:</label>
                  <input
                    type="file"
                    accept="image/*"
                    className={styles.fileInput}
                  />
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h3>Zoom Control</h3>
                <div className={styles.settingItem}>
                  <label>Zoom Level:</label>
                  <div className={styles.zoomControls}>
                    <button className={styles.zoomButton}>-</button>
                    <input
                      type="number"
                      min="50"
                      max="200"
                      className={styles.zoomInput}
                    />
                    <span className={styles.zoomPercent}>%</span>
                    <button className={styles.zoomButton}>+</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 