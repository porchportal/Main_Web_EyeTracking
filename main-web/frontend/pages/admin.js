import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/Consent.module.css';
import { useConsent } from '../components/consent/ConsentContext';
import { useAdminSettings } from './collected-dataset-customized/components-gui/adminSettings';
import fs from 'fs';
import path from 'path';

export async function getServerSideProps() {
  // Define the path to the settings file
  const settingsPath = path.join(process.cwd(), 'public', 'admin', 'capture_settings.json');
  
  // Default settings
  let settings = {
    default: {
      times: 1,
      delay: 3
    }
  };

  try {
    // Check if settings file exists
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      settings = JSON.parse(settingsData);
    } else {
      // Create directory if it doesn't exist
      const dirPath = path.dirname(settingsPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      // Create file with default settings
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    }
  } catch (error) {
    console.error('Error reading/writing settings:', error);
  }

  return {
    props: {
      initialSettings: settings
    }
  };
}

export default function AdminPage({ initialSettings }) {
  const [consentData, setConsentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { userId, consentStatus } = useConsent();
  const actionButtonRef = useRef(null);
  const { settings, updateSettings } = useAdminSettings(actionButtonRef);
  const [tempSettings, setTempSettings] = useState(initialSettings);
  const [selectedImage, setSelectedImage] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '' });
  const [debugInfo, setDebugInfo] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('default');

  // Initialize tempSettings with initial settings
  useEffect(() => {
    setTempSettings(initialSettings);
  }, [initialSettings]);

  // Add this effect to ensure global action button functions are set
  useEffect(() => {
    // Debug check to see if window.actionButtonFunctions is available
    if (typeof window !== 'undefined') {
      const checkActionButtonFunctions = () => {
        if (window.actionButtonFunctions) {
          setDebugInfo('ActionButton functions available globally');
        } else {
          setDebugInfo('ActionButton functions NOT available globally');
          // Try again in 1 second if not available
          setTimeout(checkActionButtonFunctions, 1000);
        }
      };
      
      checkActionButtonFunctions();
      
      // Add listener for settings updates
      const handleSettingsUpdate = (event) => {
        if (event.detail && event.detail.type === 'captureSettingsUpdate') {
          setDebugInfo(`Received settings update event: ${JSON.stringify(event.detail)}`);
        }
      };
      
      window.addEventListener('captureSettingsUpdate', handleSettingsUpdate);
      
      return () => {
        window.removeEventListener('captureSettingsUpdate', handleSettingsUpdate);
      };
    }
  }, []);

  useEffect(() => {
    const fetchConsentData = async () => {
      try {
        const response = await fetch('/api/admin/consent-data');
        if (!response.ok) {
          throw new Error('Failed to fetch consent data');
        }
        const data = await response.json();
        setConsentData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchConsentData();
  }, []);

  const handleTimeChange = (event) => {
    const times = parseInt(event.target.value, 10);
    if (!isNaN(times) && times > 0) {
      setTempSettings(prev => ({
        ...prev,
        [selectedUserId]: {
          ...prev[selectedUserId],
          times
        }
      }));
    }
  };

  const handleDelayChange = (event) => {
    const delay = parseInt(event.target.value, 10);
    if (!isNaN(delay) && delay > 0) {
      setTempSettings(prev => ({
        ...prev,
        [selectedUserId]: {
          ...prev[selectedUserId],
          delay
        }
      }));
    }
  };

  const handleSaveSettings = async () => {
    try {
      // Get current settings for selected user
      const userSettings = tempSettings[selectedUserId] || { times: 1, delay: 3 };
      
      // Log what we're trying to update
      console.log(`Admin: Saving settings for user ${selectedUserId}:`, userSettings);

      if (typeof window !== 'undefined') {
        window.captureSettings = {
          times: userSettings.times,
          delay: userSettings.delay
        };
        console.log('Set global captureSettings:', window.captureSettings);
      }
      
      // Update the settings using our hook function
      // This is critical - make sure we're passing the settings correctly
      updateSettings(userSettings, selectedUserId);
      
      // IMPORTANT: Create and dispatch a direct event that the ActionButton can listen for
      // This provides a more explicit communication channel
      const directEvent = new CustomEvent('captureSettingsUpdate', {
        detail: {
          type: 'captureSettings',
          userId: selectedUserId,
          times: userSettings.times,
          delay: userSettings.delay
        }
      });
      console.log('Admin: Dispatching direct event:', directEvent);
      window.dispatchEvent(directEvent);
      
      // Save to server
      const response = await fetch('/api/admin/save-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tempSettings),
      });
  
      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
  
      // Show success notification
      showNotification(`Settings saved successfully for user ${selectedUserId}!`);
    } catch (error) {
      console.error('Error saving settings:', error);
      showNotification('Failed to save settings. Please try again.', 'error');
    }
  };

  const handleImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedImage(event.target.files[0]);
    }
  };

  const handleSaveImage = () => {
    // Here you would implement the actual image upload logic
    // For now, we'll just show a notification
    if (selectedImage) {
      showNotification(`Image "${selectedImage.name}" saved successfully!`);
    } else {
      showNotification('Please select an image first', 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ 
      show: true, 
      message, 
      type 
    });
    
    // Auto-hide notification after 3 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  if (loading) {
    return (
      <div className={styles.preferencesContainer}>
        <h1>Loading consent data...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.preferencesContainer}>
        <h1>Error</h1>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard | Eye Tracking App</title>
      </Head>
      
      {/* Notification */}
      {notification.show && (
        <div className={`${styles.notification} ${notification.type === 'error' ? styles.notificationError : styles.notificationSuccess}`}>
          {notification.message}
        </div>
      )}
      
      <div className={styles.preferencesContainer}>
        <h1 className={styles.preferencesTitle}>Admin Dashboard</h1>
        
        {/* Debug Info */}
        {debugInfo && (
          <div className={styles.debugInfo}>
            <p><small>{debugInfo}</small></p>
          </div>
        )}
        
        {/* Consent Data Section */}
        <div className={styles.settingsSection}>
          <h2>Consent Data</h2>
          <div className={styles.consentTable}>
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Consent Status</th>
                  <th>Timestamp</th>
                  <th>Received At</th>
                </tr>
              </thead>
              <tbody>
                {consentData.map((data, index) => (
                  <tr key={index}>
                    <td>{data.userId}</td>
                    <td>{data.status ? 'Accepted' : 'Declined'}</td>
                    <td>{new Date(data.timestamp).toLocaleString()}</td>
                    <td>{new Date(data.receivedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Settings Section */}
        <div className={styles.settingsSection}>
          <h2>Capture Settings</h2>
          <div className={styles.settingsSubScroll}>
            <div className={styles.settingItem}>
              <label>Select User:</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className={styles.selectInput}
              >
                <option value="default">Default Settings</option>
                {consentData.map((data) => (
                  <option key={data.userId} value={data.userId}>
                    User: {data.userId}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.settingItem}>
              <label>Time(s):</label>
              <input
                type="number"
                name="time"
                value={tempSettings[selectedUserId]?.times || 1}
                onChange={handleTimeChange}
                min="1"
                max="100"
                className={styles.numberInput}
                data-control="time"
              />
            </div>
            <div className={styles.settingItem}>
              <label>Delay(s):</label>
              <input
                type="number"
                name="delay"
                value={tempSettings[selectedUserId]?.delay || 3}
                onChange={handleDelayChange}
                min="1"
                max="60"
                className={styles.numberInput}
                data-control="delay"
              />
            </div>
            <div className={styles.settingItem}>
              <button
                onClick={handleSaveSettings}
                className={styles.saveButton}
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>

        <div className={styles.settingsSection}>
          <h2>Image Settings</h2>
          <div className={styles.settingItem}>
            <label>Upload Image:</label>
            <input
              type="file"
              accept="image/*"
              className={styles.fileInput}
              onChange={handleImageChange}
            />
          </div>
          <div className={styles.settingItem}>
            <button
              onClick={handleSaveImage}
              className={styles.saveButton}
            >
              Save Image
            </button>
          </div>
        </div>

        <div className={styles.settingsSection}>
          <h2>Zoom Control</h2>
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
    </>
  );
}