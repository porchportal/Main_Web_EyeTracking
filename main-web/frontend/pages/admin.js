/**
 * Admin Page API Documentation
 * 
 * This page handles the following API endpoints:
 * 
 * 1. WebSocket Connection (/api/data-center/ws)
 *    - Purpose: Real-time communication with data center
 *    - Events:
 *      - settings_{userId}: Receives settings updates for specific user
 *      - image_{userId}: Receives image updates for specific user
 *      - zoom_{userId}: Receives zoom level updates for specific user
 * 
 * 2. Admin Updates API (/api/admin/update)
 *    - Method: POST
 *    - Headers:
 *      - Content-Type: application/json
 *      - X-API-Key: A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV
 *    - Request Body:
 *      {
 *        userId: string,      // User ID for the update
 *        type: string,        // 'settings' or 'image'
 *        data: object         // Settings data or base64 image
 *      }
 *    - Response:
 *      - Success: 200 OK
 *      - Error: 400 Bad Request, 401 Unauthorized, 500 Internal Server Error
 * 
 * 3. Consent Data API (/api/admin/consent-data)
 *    - Method: GET
 *    - Purpose: Fetch user consent data
 *    - Response:
 *      Array of consent objects with:
 *      - userId: string
 *      - status: boolean
 *      - timestamp: string
 *      - receivedAt: string
 * 
 * 4. Settings Events
 *    - captureSettingsUpdate: Dispatched when settings are updated
 *      {
 *        type: 'captureSettings',
 *        userId: string,
 *        times: number,
 *        delay: number
 *      }
 * 
 *    - settingsUpdated: Dispatched after topBar is updated
 *      {
 *        type: 'settings',
 *        userId: string,
 *        settings: {
 *          times: number,
 *          delay: number
 *        }
 *      }
 * 
 *    - imageUpdate: Dispatched when image is updated
 *      {
 *        type: 'image',
 *        userId: string,
 *        image: string (base64)
 *      }
 * 
 *    - adminOverride: Dispatched when access is overridden
 *      {
 *        type: 'adminOverride',
 *        userId: string,
 *        enabled: boolean
 *      }
 */

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/Consent.module.css';
import { useConsent } from '../components/consent/ConsentContext';
import { useAdminSettings } from '../pages/collected-dataset-customized/components-gui/adminSettings';
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
  const actionButtonGroupRef = useRef(null);
  const { settings, updateSettings } = useAdminSettings(actionButtonGroupRef);
  const [tempSettings, setTempSettings] = useState(initialSettings);
  const [selectedImage, setSelectedImage] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '' });
  const [debugInfo, setDebugInfo] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('default');
  const pollingInterval = useRef(null);
  const [userProfiles, setUserProfiles] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  // Polling for settings updates
  useEffect(() => {
    const fetchSettings = async () => {
      if (!selectedUserId) return;
      
      try {
        const response = await fetch(`/api/admin/load-settings?userId=${selectedUserId}`);
        if (!response.ok) throw new Error('Failed to fetch settings');
        
        const newSettings = await response.json();
        setTempSettings(prev => ({
          ...prev,
          [selectedUserId]: newSettings
        }));
        
        // Update settings through the hook
        updateSettings(newSettings, selectedUserId);
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };

    // Initial fetch
    fetchSettings();

    // Set up polling interval
    pollingInterval.current = setInterval(fetchSettings, 3000);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [selectedUserId]);

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
      const newSettings = {
        times,
        delay: settings[selectedUserId]?.delay || 3
      };
      updateDataCenterSettings(newSettings);
    }
  };

  const handleDelayChange = (event) => {
    const delay = parseInt(event.target.value, 10);
    if (!isNaN(delay) && delay > 0) {
      const newSettings = {
        times: settings[selectedUserId]?.times || 1,
        delay
      };
      updateDataCenterSettings(newSettings);
    }
  };

  const updateDataCenterSettings = async (newSettings) => {
    try {
      // Update local settings
      const updatedSettings = {
        ...settings,
        [selectedUserId]: newSettings
      };
      
      // Update settings through the hook
      updateSettings(newSettings, selectedUserId);

      // Update global settings if they exist
      if (typeof window !== 'undefined') {
        window.captureSettings = newSettings;
        
        // Dispatch a custom event for components to listen to
        const event = new CustomEvent('captureSettingsUpdate', {
          detail: {
            type: 'settings',
            userId: selectedUserId,
            settings: newSettings
          }
        });
        window.dispatchEvent(event);
      }

      // Save to server using REST API
      const response = await fetch('/api/admin/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'X-API-Key': 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
        },
        body: JSON.stringify({
          userId: selectedUserId,
          type: 'settings',
          data: newSettings
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      showNotification('Failed to update settings. Please try again.', 'error');
    }
  };

  // Add an effect to handle settings updates
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      if (event.detail && event.detail.type === 'settings') {
        // Update index.js with new settings
        // This will run after topBar.js is updated
      }
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  const handleImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          // Save image to server using REST API
          const response = await fetch('/api/admin/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // 'X-API-Key': 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
              'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
            },
            body: JSON.stringify({
              userId: selectedUserId,
              type: 'image',
              data: e.target.result
            })
          });

          if (!response.ok) {
            throw new Error('Failed to save image');
          }

          // Dispatch event for components to listen to
          if (typeof window !== 'undefined') {
            const event = new CustomEvent('imageUpdate', {
              detail: {
                type: 'image',
                userId: selectedUserId,
                image: e.target.result
              }
            });
            window.dispatchEvent(event);
          }

          showNotification('Image saved successfully!');
        } catch (error) {
          console.error('Error saving image:', error);
          showNotification('Failed to save image. Please try again.', 'error');
        }
      };
      reader.readAsDataURL(event.target.files[0]);
    }
  };

  const handleZoomChange = async (value) => {
    try {
      const response = await fetch('/api/admin/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'X-API-Key': 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
        },
        body: JSON.stringify({
          userId: selectedUserId,
          type: 'zoom',
          data: value
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update zoom level');
      }
    } catch (error) {
      console.error('Error updating zoom level:', error);
      showNotification('Failed to update zoom level. Please try again.', 'error');
    }
  };

  const handleSaveSettings = async () => {
    try {
      // Get current settings for selected user
      const userSettings = tempSettings[selectedUserId] || { times: 1, delay: 3 };
      
      // Log what we're trying to update
      console.log(`Admin: Saving settings for user ${selectedUserId}:`, userSettings);

      // Update local settings
      setTempSettings(prev => ({
        ...prev,
        [selectedUserId]: userSettings
      }));

      // Update settings through the hook
      updateSettings(userSettings, selectedUserId);

      // Update global settings
      if (typeof window !== 'undefined') {
        window.captureSettings = userSettings;
        
        // Dispatch a custom event for components to listen to
        const event = new CustomEvent('captureSettingsUpdate', {
          detail: {
            type: 'captureSettings',
            userId: selectedUserId,
            times: userSettings.times,
            delay: userSettings.delay
          }
        });
        window.dispatchEvent(event);
      }

      // Save to server using REST API
      const response = await fetch('/api/admin/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
        },
        body: JSON.stringify({
          userId: selectedUserId,
          type: 'settings',
          data: userSettings
        }),
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

  const handleSaveImage = async () => {
    if (!selectedImage) {
      showNotification('Please select an image first', 'error');
      return;
    }

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target.result;
        
        // Send image to data center via WebSocket
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            key: `image_${selectedUserId}`,
            value: base64Image,
            data_type: 'image'
          }));
        }

        // Save to server using new unified endpoint
        const response = await fetch('/api/admin/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 'X-API-Key': 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
            'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
          },
          body: JSON.stringify({
            userId: selectedUserId,
            type: 'image',
            data: base64Image
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save image');
        }

        // Dispatch event for components to listen to
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('imageUpdate', {
            detail: {
              type: 'image',
              userId: selectedUserId,
              image: base64Image
            }
          });
          window.dispatchEvent(event);
        }

        showNotification('Image saved successfully!');
      };
      reader.readAsDataURL(selectedImage);
    } catch (error) {
      console.error('Error saving image:', error);
      showNotification('Failed to save image. Please try again.', 'error');
    }
  };

  const handleOverrideAccess = (userId) => {
    try {
      // Dispatch event to enable/disable access
      const event = new CustomEvent('adminOverride', {
        detail: {
          type: 'adminOverride',
          userId: userId,
          enabled: true
        }
      });
      window.dispatchEvent(event);
      
      // Show success notification
      showNotification(`Access granted for user ${userId}!`);
    } catch (error) {
      console.error('Error overriding access:', error);
      showNotification('Failed to override access. Please try again.', 'error');
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

  // Add effect to handle profile updates
  useEffect(() => {
    const handleAdminUpdate = (event) => {
      const { userId, profile } = event.detail;
      console.log('Admin update received:', { userId, profile });
      
      setUserProfiles(prev => ({
        ...prev,
        [userId]: profile
      }));

      // Check if profile is complete and update button state
      if (profile.isComplete) {
        const buttonEvent = new CustomEvent('buttonStateUpdate', {
          detail: {
            userId: userId,
            enabled: true
          }
        });
        window.dispatchEvent(buttonEvent);
      }
    };

    window.addEventListener('adminUpdate', handleAdminUpdate);
    return () => window.removeEventListener('adminUpdate', handleAdminUpdate);
  }, []);

  // Add user profiles to the consent data display
  const getProfileStatus = (userId) => {
    const profile = userProfiles[userId];
    if (!profile) return 'No profile';
    
    const isComplete = profile.username && profile.sex;
    return isComplete ? 
      `Complete (${profile.username}, ${profile.sex}${profile.age ? `, ${profile.age}` : ''})` : 
      'Incomplete';
  };

  const handleDeleteClick = (userId) => {
    setDeleteTarget(userId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      console.log('API Key being sent:', process.env.NEXT_PUBLIC_API_KEY);
      const response = await fetch('/api/admin/delete-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
        },
        body: JSON.stringify({
          userId: deleteTarget
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Delete error response:', errorData);
        throw new Error('Failed to delete consent data');
      }

      // Update the consent data by removing the deleted row
      setConsentData(prevData => prevData.filter(data => data.userId !== deleteTarget));
      showNotification('Consent data deleted successfully!');
    } catch (error) {
      console.error('Error deleting consent data:', error);
      showNotification('Failed to delete consent data. Please try again.', 'error');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
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
    <div className={styles.container}>
      <Head>
        <title>Admin Dashboard</title>
      </Head>
  
      <main className={styles.main}>
        <h1>Admin Dashboard</h1>
        
        {/* Notification */}
        {notification.show && (
          <div className={`${styles.notification} ${notification.type === 'error' ? styles.notificationError : styles.notificationSuccess}`}>
            {notification.message}
          </div>
        )}
        
        {/* Debug Info */}
        {debugInfo && (
          <div className={styles.debugInfo}>
            <p><small>{debugInfo}</small></p>
          </div>
        )}
  
        {/* Consent Data Section - Now First */}
        <div className={styles.settingsSection}>
          <h2>Consent Data</h2>
          <div className={styles.consentTable}>
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Consent Status</th>
                  <th>Profile</th>
                  <th>Timestamp</th>
                  <th>Received At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {consentData.map((data, index) => (
                  <tr key={index}>
                    <td>{data.userId}</td>
                    <td>{data.status ? 'Accepted' : 'Declined'}</td>
                    <td>{getProfileStatus(data.userId)}</td>
                    <td>{new Date(data.timestamp).toLocaleString()}</td>
                    <td>{new Date(data.receivedAt).toLocaleString()}</td>
                    <td>
                      <div className={styles.actionButtons}>
                        {!data.status && (
                          <button
                            className={styles.overrideButton}
                            onClick={() => handleOverrideAccess(data.userId)}
                          >
                            Grant Access
                          </button>
                        )}
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDeleteClick(data.userId)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
  
        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className={styles.confirmationDialog}>
            <div className={styles.confirmationContent}>
              <h3>Confirm Delete</h3>
              <p>Are you sure you want to delete this consent row?</p>
              <div className={styles.confirmationButtons}>
                <button
                  className={styles.confirmButton}
                  onClick={handleDeleteConfirm}
                >
                  OK
                </button>
                <button
                  className={styles.cancelButton}
                  onClick={handleDeleteCancel}
                >
                  Not
                </button>
              </div>
            </div>
          </div>
        )}
  
        {/* User Selection Section - Now Second */}
        <div className={styles.settingsSection}>
          <h2>Select User</h2>
          <div className={styles.settingItem}>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className={styles.selectInput}
            >
              <option value="">Select a user...</option>
              {consentData.map((data) => (
                <option key={data.userId} value={data.userId}>
                  User: {data.userId}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Settings Sections (only shown when a user is selected) */}
        {selectedUserId && (
          <>
            {/* Capture Settings Section */}
            <div className={styles.settingsSection}>
              <h2>Capture Settings</h2>
              <div className={styles.settingsSubScroll}>
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
  
            {/* Image Settings Section */}
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
  
            {/* Zoom Control Section */}
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
                    onChange={(e) => handleZoomChange(e.target.value)}
                  />
                  <span className={styles.zoomPercent}>%</span>
                  <button className={styles.zoomButton}>+</button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}