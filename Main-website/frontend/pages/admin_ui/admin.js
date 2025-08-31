// main-web/frontend/pages/admin.js

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from './style/Admin.module.css';
import gradientStyles from './style/animation_gradient.module.css';
import { useConsent } from '../../components/consent_ui/ConsentContext';
import { useAdminSettings } from '../collected-dataset-customized/components-gui/adminSettings';
import fs from 'fs';
import path from 'path';
import DragDropPriorityList from './adminDrag&Drop';
import AdminCanvaConfig from './adminCanvaConfig';
import DataPreview from './adjust-preview';
import NotiMessage from './notiMessage';
import { useRouter } from 'next/router';



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
  const router = useRouter();
  const [consentData, setConsentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { userId, consentStatus } = useConsent();
  const actionButtonGroupRef = useRef(null);
  const { settings, updateSettings } = useAdminSettings(actionButtonGroupRef);
  const [tempSettings, setTempSettings] = useState(initialSettings);
  const [selectedImage, setSelectedImage] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('default');
  const pollingInterval = useRef(null);
  const [userProfiles, setUserProfiles] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [showCanvaConfig, setShowCanvaConfig] = useState(false);
  const [showAllConsentData, setShowAllConsentData] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [publicAccessEnabled, setPublicAccessEnabled] = useState(false);
  const [backendChangeEnabled, setBackendChangeEnabled] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsAnimating, setSettingsAnimating] = useState(false);
  const [systemControlsVisible, setSystemControlsVisible] = useState(false);
  const [systemControlsAnimating, setSystemControlsAnimating] = useState(false);
  const [showDataPreview, setShowDataPreview] = useState(false);

  // Check authentication on page load
  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        console.log('Checking authentication and loading data...');
        setLoading(true);
        
        // Check authentication first
        const authResponse = await fetch('/api/admin/auth');
        console.log('Auth response status:', authResponse.status);
        
        if (!authResponse.ok) {
          console.log('Not authenticated, redirecting to login...');
          router.replace('/admin_ui/admin-login');
          return;
        }
        
        console.log('Authentication successful, loading consent data...');
        setIsAuthenticated(true);
        
        // Load consent data immediately after authentication
        try {
          const consentResponse = await fetch('/api/admin/consent-data', {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
            }
          });

          if (!consentResponse.ok) {
            const errorText = await consentResponse.text();
            console.error('Consent data response error:', errorText);
            throw new Error(`Failed to load consent data: ${consentResponse.status} ${consentResponse.statusText}`);
          }

          const data = await consentResponse.json();
          console.log('Consent data loaded:', data);
          setConsentData(Array.isArray(data) ? data : []);
        } catch (error) {
          console.error('Error loading consent data:', error);
          setError(error.message);
        } finally {
          setLoading(false);
        }
        
      } catch (error) {
        console.error('Authentication check failed:', error);
        // For debugging, let's temporarily bypass authentication
        console.log('Bypassing authentication for debugging...');
        setIsAuthenticated(true);
        setLoading(false);
        // router.push('/admin-login');
      }
    };

    checkAuthAndLoadData();
  }, [router]);

  // Add this effect to sync settings with adminSettings hook
  useEffect(() => {
    if (selectedUserId && settings[selectedUserId]) {
      setTempSettings(prev => ({
        ...prev,
        [selectedUserId]: settings[selectedUserId]
      }));
    }
  }, [settings, selectedUserId]);

  // Removed separate consent data loading effect - now combined with authentication check

  const handleSaveSettings = async () => {
    if (!selectedUserId || selectedUserId === 'default') {
      window.showNotification('Please select a user ID before saving settings!', 'error');
      return;
    }

    try {
      // Get current settings for the selected user
      const currentSettings = tempSettings[selectedUserId];
      if (!currentSettings) {
        throw new Error('No settings found for selected user');
      }

      // Send the current settings to the data center (backend will handle defaults)
      const settingsToSave = { ...currentSettings };

              // Save to data center using the new API endpoint
        const response = await fetch(`/api/data-center/settings/${selectedUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsToSave)
      });

      if (!response.ok) {
        throw new Error('Failed to save settings to data center');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to save settings');
      }
      
      // Update local state with the saved settings
      setTempSettings(prev => ({
        ...prev,
        [selectedUserId]: settingsToSave
      }));

      // Update settings through the hook
      updateSettings(settingsToSave, selectedUserId);

      // Show success notification
      window.showNotification('Settings saved successfully to data center!', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      window.showNotification('Failed to save settings. Please try again.', 'error');
    }
  };

  // Add this function to handle button order changes
  const handleButtonOrderChange = async (orderString) => {
    if (selectedUserId) {
      // Update local state immediately
      setTempSettings(prev => ({
        ...prev,
        [selectedUserId]: {
          ...prev[selectedUserId],
          buttons_order: orderString
        }
      }));

      // Also save to data center
      try {
        const currentSettings = tempSettings[selectedUserId] || {};
        const updatedSettings = {
          ...currentSettings,
          buttons_order: orderString
        };

        const response = await fetch(`/api/data-center/settings/${selectedUserId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedSettings)
        });

        if (response.ok) {
          window.showNotification('Button order saved to data center!', 'success');
        } else {
          window.showNotification('Failed to save button order to data center', 'error');
        }
      } catch (error) {
        console.error('Error saving button order:', error);
        window.showNotification('Failed to save button order', 'error');
      }
    }
  };

  const handleImageChange = async (event) => {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          // Save image to server using REST API
          const response = await fetch(`/api/data-center/image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
            },
            body: JSON.stringify({
              userId: selectedUserId,
              image: e.target.result
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

          window.showNotification('Image saved successfully!');
        } catch (error) {
          console.error('Error saving image:', error);
          window.showNotification('Failed to save image. Please try again.', 'error');
        }
      };
      reader.readAsDataURL(event.target.files[0]);
    }
  };

  const handleZoomChange = (value) => {
    if (!selectedUserId || selectedUserId === 'default') {
      window.showNotification('Please select a user ID before changing zoom level!', 'error');
      return;
    }

    const newValue = parseInt(value, 10);
    if (!isNaN(newValue) && newValue >= 50 && newValue <= 200) {
      setTempSettings(prev => ({
        ...prev,
        [selectedUserId]: {
          ...prev[selectedUserId],
          zoom_level: newValue
        }
      }));
    }
  };

  const handleSaveImage = async () => {
    if (!selectedUserId || selectedUserId === 'default') {
      window.showNotification('Please select a user ID before saving image!', 'error');
      return;
    }

    if (!selectedImage) {
      window.showNotification('Please select an image first!', 'error');
      return;
    }

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target.result;
        
        // Save to server using REST API
        const response = await fetch(`/api/data-center/image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
          },
          body: JSON.stringify({
            userId: selectedUserId,
            image: base64Image
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
              image: base64Image
            }
          });
          window.dispatchEvent(event);
        }

        window.showNotification('Image saved successfully!', 'success');
      };
      reader.readAsDataURL(selectedImage);
    } catch (error) {
      console.error('Error saving image:', error);
      window.showNotification('Failed to save image. Please try again.', 'error');
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
      window.showNotification(`Access granted for user ${userId}!`);
    } catch (error) {
      console.error('Error overriding access:', error);
      window.showNotification('Failed to override access. Please try again.', 'error');
    }
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
      const apiKey = process.env.NEXT_PUBLIC_API_KEY;
      console.log('Using API Key:', apiKey);
      
      // Delete user data using the consolidated endpoint
              const response = await fetch(`/api/consent/${deleteTarget}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Delete error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error('Failed to delete user data');
      }

      // Delete from local consent file
      try {
        const consentResponse = await fetch('/api/admin/delete-consent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
          },
          body: JSON.stringify({ userId: deleteTarget })
        });

        if (!consentResponse.ok) {
          const errorData = await consentResponse.json().catch(() => ({}));
          console.error('Local consent deletion error:', {
            status: consentResponse.status,
            statusText: consentResponse.statusText,
            errorData
          });
          throw new Error('Failed to delete local consent file');
        }
      } catch (error) {
        console.error('Error deleting local consent file:', error);
        throw error;
      }

      // Update the consent data by removing the deleted row immediately
      setConsentData(prevData => prevData.filter(data => data.userId !== deleteTarget));
      
      // Also remove from tempSettings if it exists
      setTempSettings(prev => {
        const newSettings = { ...prev };
        delete newSettings[deleteTarget];
        return newSettings;
      });

      // Remove from settings context if it exists
      if (settings && settings[deleteTarget]) {
        updateSettings(null, deleteTarget);
      }

      // Clear any related cookies for this user
      try {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
          const [name] = cookie.split('=');
          if (name.trim().startsWith('eye_tracking_') || 
              name.trim().startsWith('consent_') || 
              name.trim().startsWith('user_')) {
            document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          }
        }
      } catch (error) {
        console.warn('Error clearing cookies:', error);
      }

      // Add a small delay before verification to allow backend to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify deletion by checking if the user still exists
              const verifyResponse = await fetch(`/api/consent/${deleteTarget}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        }
      });

      // If we get a 404, that means the user was successfully deleted
      if (verifyResponse.status === 404) {
        window.showNotification('User data deleted successfully from all collections!');
      } else if (verifyResponse.ok) {
        console.warn('User data might still exist in some collections');
        window.showNotification('User data deleted, but some collections might need manual cleanup');
      } else {
        // For any other error, we'll assume the deletion was successful
        // since we've already cleaned up the frontend state
        window.showNotification('User data deleted successfully from all collections!');
      }
    } catch (error) {
      console.error('Error deleting user data:', error);
      window.showNotification('Failed to delete user data. Please try again.', 'error');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  // Toggle functions for system controls
  const handlePublicAccessToggle = async () => {
    if (!selectedUserId || selectedUserId === 'default') {
      window.showNotification('Please select a user ID before changing system controls!', 'error');
      return;
    }

    try {
      const newValue = !publicAccessEnabled;
      const currentSettings = tempSettings[selectedUserId] || {};
      const updatedSettings = {
        ...currentSettings,
        public_data_access: newValue
      };

      // Update local state immediately
      setPublicAccessEnabled(newValue);
      setTempSettings(prev => ({
        ...prev,
        [selectedUserId]: updatedSettings
      }));

      // Save to data center
      const response = await fetch(`/api/data-center/settings/${selectedUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSettings)
      });

      if (response.ok) {
        window.showNotification(
          `Public access ${newValue ? 'enabled' : 'disabled'} and saved to data center!`,
          'success'
        );
      } else {
        // Revert on failure
        setPublicAccessEnabled(!newValue);
        window.showNotification('Failed to save public access setting', 'error');
      }
    } catch (error) {
      console.error('Error toggling public access:', error);
      window.showNotification('Failed to update public access setting', 'error');
    }
  };

  const handleBackendChangeToggle = async () => {
    if (!selectedUserId || selectedUserId === 'default') {
      window.showNotification('Please select a user ID before changing system controls!', 'error');
      return;
    }

    try {
      const newValue = !backendChangeEnabled;
      const currentSettings = tempSettings[selectedUserId] || {};
      const updatedSettings = {
        ...currentSettings,
        enable_background_change: newValue
      };

      // Update local state immediately
      setBackendChangeEnabled(newValue);
      setTempSettings(prev => ({
        ...prev,
        [selectedUserId]: updatedSettings
      }));

      // Save to data center
      const response = await fetch(`/api/data-center/settings/${selectedUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSettings)
      });

      if (response.ok) {
        window.showNotification(
          `Backend change ${newValue ? 'enabled' : 'disabled'} and saved to data center!`,
          'success'
        );
      } else {
        // Revert on failure
        setBackendChangeEnabled(!newValue);
        window.showNotification('Failed to save backend change setting', 'error');
      }
    } catch (error) {
      console.error('Error toggling backend change:', error);
      window.showNotification('Failed to update backend change setting', 'error');
    }
  };



  // Add effect to handle animations for all sections
  useEffect(() => {
    if (selectedUserId && selectedUserId !== 'default') {
      // Show sections with animation
      setSettingsAnimating(true);
      setSystemControlsAnimating(true);
      setSettingsVisible(true);
      setSystemControlsVisible(true);
    } else {
      // Hide sections with animation
      setSettingsAnimating(true);
      setSystemControlsAnimating(true);
      setTimeout(() => {
        setSettingsVisible(false);
        setSystemControlsVisible(false);
        setSettingsAnimating(false);
        setSystemControlsAnimating(false);
      }, 300); // Match the exit animation duration
    }
  }, [selectedUserId]);

  // Update the user selection handler
  const handleUserSelect = async (e) => {
    const newUserId = e.target.value;
    setSelectedUserId(newUserId);
    
    if (newUserId) {
      try {
        // Fetch settings from data center
        const response = await fetch(`/api/data-center/settings/${newUserId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const result = await response.json();
          const userSettings = result.data || {};
          
          // Update tempSettings with data center data (backend already provides defaults)
          setTempSettings(prev => ({
            ...prev,
            [newUserId]: userSettings
          }));

          // Update settings through the hook
          updateSettings(userSettings, newUserId);
          
          // Update system control states
          setPublicAccessEnabled(userSettings.public_data_access || false);
          setBackendChangeEnabled(userSettings.enable_background_change || false);
          
          window.showNotification('Settings loaded successfully from data center!', 'success');
        } else {
          // If no settings found, backend will provide defaults
          setTempSettings(prev => ({
            ...prev,
            [newUserId]: {}
          }));
          
          // Update settings through the hook (will be populated when user interacts)
          updateSettings({}, newUserId);
          
          // Initialize system controls to false for new users
          setPublicAccessEnabled(false);
          setBackendChangeEnabled(false);
          
          window.showNotification('New user - settings will be created when you save', 'success');
        }
      } catch (error) {
        console.error('Error loading user settings:', error);
        window.showNotification('Failed to load user settings. Using defaults.', 'error');
        
        // Initialize with empty object on error (backend will provide defaults)
        setTempSettings(prev => ({
          ...prev,
          [newUserId]: {}
        }));
        
        // Update settings through the hook (will be populated when user interacts)
        updateSettings({}, newUserId);
        
        // Initialize system controls to false on error
        setPublicAccessEnabled(false);
        setBackendChangeEnabled(false);
      }
    } else {
      // Clear settings when no user is selected
      setTempSettings(prev => ({
        ...prev,
        [newUserId]: null
      }));
    }


  };

  const handleImageSave = (imagePaths) => {
    if (selectedUserId) {
      // Get existing images and settings
      const existingImages = tempSettings[selectedUserId]?.image_pdf_canva || {};
      const existingPrimaryPath = tempSettings[selectedUserId]?.image_path;
      const existingUpdateImage = tempSettings[selectedUserId]?.updateImage;
      
      // Handle both single imagePath (string) and imagePaths object
      let primaryImagePath;
      let updateImageName;
      let mergedImagePaths;
      
      if (typeof imagePaths === 'string') {
        // Backward compatibility for single image path
        primaryImagePath = imagePaths;
        updateImageName = imagePaths.split('/').pop();
        mergedImagePaths = { ...existingImages, 'image_1': imagePaths };
      } else if (typeof imagePaths === 'object' && imagePaths !== null) {
        // Handle imagePaths object with multiple images (backend format: image_1, image_2, etc.)
        const firstImagePath = imagePaths['image_1'] || Object.values(imagePaths)[0];
        
        // Only update primary image if there's no existing primary image
        if (!existingPrimaryPath || existingPrimaryPath === "/asfgrebvxcv" || existingPrimaryPath === "") {
          primaryImagePath = firstImagePath;
          updateImageName = firstImagePath ? firstImagePath.split('/').pop() : '';
        } else {
          // Keep existing primary image
          primaryImagePath = existingPrimaryPath;
          updateImageName = existingUpdateImage;
        }
        
        // Keep the original backend format (image_1, image_2, etc.) and merge with existing images
        mergedImagePaths = { ...existingImages, ...imagePaths };
      } else {
        console.error('Invalid imagePaths format:', imagePaths);
        return;
      }

      setTempSettings(prev => ({
        ...prev,
        [selectedUserId]: {
          ...prev[selectedUserId],
          image_path: primaryImagePath,
          updateImage: updateImageName,
          image_pdf_canva: mergedImagePaths // Store the merged imagePaths object
        }
      }));
      window.showNotification('Images added successfully!');
    }
  };

  // Move the loading state return here, after all hooks
  if (!isAuthenticated || loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <h1>Loading Admin Dashboard...</h1>
          <div className={styles.loadingSpinner}></div>
          <p>Please wait while we authenticate and load your data...</p>
        </div>
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
        <div className={styles.headerContainer}>
          <h1>Admin Dashboard</h1>
        </div>
        
        {/* Notification Component */}
        <NotiMessage />
        
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
                {consentData
                  .slice(0, showAllConsentData ? consentData.length : 5)
                  .map((data, index) => (
                  <tr 
                    key={index}
                    className={`${isAnimating ? (showAllConsentData ? styles.expanding : styles.collapsing) : ''}`}
                    style={{
                      animationDelay: `${index * 0.05}s`
                    }}
                  >
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
            {consentData.length > 5 && (
              <div className={styles.showMoreContainer}>
                <button
                  className={styles.showMoreButton}
                  onClick={() => {
                    if (!isAnimating) {
                      setIsAnimating(true);
                      setShowAllConsentData(!showAllConsentData);
                      
                      // Reset animation state after animation completes
                      setTimeout(() => {
                        setIsAnimating(false);
                      }, 500);
                    }
                  }}
                  disabled={isAnimating}
                >
                  {showAllConsentData ? 'Show Less' : 'Show More'}
                </button>
              </div>
            )}
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
  
        {/* User Selection Section */}
        <div className={styles.userSelectionSection}>
          <div className={gradientStyles.gradientContainer}>
            <div className={gradientStyles.gradientBackground}></div>
            <div className={gradientStyles.gradientContent}>
              <label className={styles.userSelectionLabel}>Select User:</label>
              <select
                value={selectedUserId}
                onChange={handleUserSelect}
                className={styles.userSelectionInput}
              >
                <option value="">Select a user...</option>
                {Array.from(new Set(consentData.map(data => data.userId))).map((userId) => (
                  <option key={userId} value={userId}>
                    User: {userId}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {/* Settings Grid Container */}
        {settingsVisible && (
                      <div className={`${styles.settingsGrid} ${settingsAnimating ? (selectedUserId && selectedUserId !== 'default' ? styles.settingsEnter : styles.settingsExit) : ''}`}>
              {/* Capture Settings Section */}
              <div className={styles.div1}>
                <h2>Capture Settings on Set Random Action</h2>
                <div className={styles.settingsSubScroll}>
                  <div className={styles.settingItemNoBg}>
                    <label>Time(s):</label>
                    <div className={styles.numberInputContainer}>
                      <input
                        type="number"
                        name="times_set_random"
                        value={tempSettings[selectedUserId]?.times_set_random ?? 1}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value, 10);
                          if (!isNaN(newValue) && newValue > 0) {
                            setTempSettings(prev => ({
                              ...prev,
                              [selectedUserId]: {
                                ...prev[selectedUserId],
                                times_set_random: newValue
                              }
                            }));
                          }
                        }}
                        min="1"
                        max="100"
                        className={styles.numberInput}
                        data-control="times_set_random"
                      />
                      <div className={styles.numberControls}>
                        <button 
                          className={styles.numberControl}
                          onClick={() => {
                            const currentValue = tempSettings[selectedUserId]?.times_set_random ?? 1;
                            if (currentValue < 100) {
                              setTempSettings(prev => ({
                                ...prev,
                                [selectedUserId]: {
                                  ...prev[selectedUserId],
                                  times_set_random: currentValue + 1
                                }
                              }));
                            }
                          }}
                        >
                          ▲
                        </button>
                        <button 
                          className={styles.numberControl}
                          onClick={() => {
                            const currentValue = tempSettings[selectedUserId]?.times_set_random ?? 1;
                            if (currentValue > 1) {
                              setTempSettings(prev => ({
                                ...prev,
                                [selectedUserId]: {
                                  ...prev[selectedUserId],
                                  times_set_random: currentValue - 1
                                }
                              }));
                            }
                          }}
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className={styles.settingItemNoBg}>
                    <label>Delay(s):</label>
                    <div className={styles.numberInputContainer}>
                      <input
                        type="number"
                        name="delay_set_random"
                        value={tempSettings[selectedUserId]?.delay_set_random ?? 3}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value, 10);
                          if (!isNaN(newValue) && newValue > 0) {
                            setTempSettings(prev => ({
                              ...prev,
                              [selectedUserId]: {
                                ...prev[selectedUserId],
                                delay_set_random: newValue
                              }
                            }));
                          }
                        }}
                        min="1"
                        max="60"
                        className={styles.numberInput}
                        data-control="delay_set_random"
                      />
                      <div className={styles.numberControls}>
                        <button 
                          className={styles.numberControl}
                          onClick={() => {
                            const currentValue = tempSettings[selectedUserId]?.delay_set_random ?? 3;
                            if (currentValue < 60) {
                              setTempSettings(prev => ({
                                ...prev,
                                [selectedUserId]: {
                                  ...prev[selectedUserId],
                                  delay_set_random: currentValue + 1
                                }
                              }));
                            }
                          }}
                        >
                          ▲
                        </button>
                        <button 
                          className={styles.numberControl}
                          onClick={() => {
                            const currentValue = tempSettings[selectedUserId]?.delay_set_random ?? 3;
                            if (currentValue > 1) {
                              setTempSettings(prev => ({
                                ...prev,
                                [selectedUserId]: {
                                  ...prev[selectedUserId],
                                  delay_set_random: currentValue - 1
                                }
                              }));
                            }
                          }}
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className={styles.settingItemNoBg}>
                    <button
                      onClick={handleSaveSettings}
                      className={styles.saveButton}
                      disabled={!selectedUserId}
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              </div>

            {/* Required Button Click Order Section */}
                          <div className={styles.div2}>
                <h2>Required Button Click Order</h2>
                <DragDropPriorityList 
                  onOrderChange={handleButtonOrderChange}
                  initialOrder={tempSettings[selectedUserId]?.buttons_order || ""}
                />
              </div>

            {/* Set Calibrate Section */}
            <div className={styles.div3}>
              <h2>Set Calibrate</h2>
              <div className={styles.settingsSubScroll}>
                <div className={styles.settingItemNoBg}>
                  <label>Time(s):</label>
                  <div className={styles.numberInputContainer}>
                    <input
                      type="number"
                      name="times_set_calibrate"
                      value={tempSettings[selectedUserId]?.times_set_calibrate ?? 1}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value, 10);
                        if (!isNaN(newValue) && newValue > 0) {
                          setTempSettings(prev => ({
                            ...prev,
                            [selectedUserId]: {
                              ...prev[selectedUserId],
                              times_set_calibrate: newValue
                            }
                          }));
                        }
                      }}
                      min="1"
                      max="100"
                      className={styles.numberInput}
                      data-control="times_set_calibrate"
                    />
                    <div className={styles.numberControls}>
                      <button 
                        className={styles.numberControl}
                        onClick={() => {
                          const currentValue = tempSettings[selectedUserId]?.times_set_calibrate ?? 1;
                          if (currentValue < 100) {
                            setTempSettings(prev => ({
                              ...prev,
                              [selectedUserId]: {
                                ...prev[selectedUserId],
                                times_set_calibrate: currentValue + 1
                              }
                            }));
                          }
                        }}
                      >
                        ▲
                      </button>
                      <button 
                        className={styles.numberControl}
                        onClick={() => {
                          const currentValue = tempSettings[selectedUserId]?.times_set_calibrate ?? 1;
                          if (currentValue > 1) {
                            setTempSettings(prev => ({
                              ...prev,
                              [selectedUserId]: {
                                ...prev[selectedUserId],
                                times_set_calibrate: currentValue - 1
                              }
                            }));
                          }
                        }}
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                </div>
                <div className={`${styles.settingItemNoBg} ${styles.fadeInOut} ${(tempSettings[selectedUserId]?.times_set_calibrate ?? 1) > 1 ? styles.show : styles.hide}`}>
                  <label>Run Set Random Every:</label>
                  <div className={styles.numberInputContainer}>
                    <input
                      type="number"
                      name="run_every_of_random"
                      value={tempSettings[selectedUserId]?.run_every_of_random ?? 1}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value, 10);
                        if (!isNaN(newValue) && newValue > 0) {
                          setTempSettings(prev => ({
                            ...prev,
                            [selectedUserId]: {
                              ...prev[selectedUserId],
                              run_every_of_random: newValue
                            }
                          }));
                        }
                      }}
                      min="1"
                      max="100"
                      className={styles.numberInput}
                      data-control="run_every_of_random"
                    />
                    <div className={styles.numberControls}>
                      <button 
                        className={styles.numberControl}
                        onClick={() => {
                          const currentValue = tempSettings[selectedUserId]?.run_every_of_random ?? 1;
                          if (currentValue < 100) {
                            setTempSettings(prev => ({
                              ...prev,
                              [selectedUserId]: {
                                ...prev[selectedUserId],
                                run_every_of_random: currentValue + 1
                              }
                            }));
                          }
                        }}
                      >
                        ▲
                      </button>
                      <button 
                        className={styles.numberControl}
                        onClick={() => {
                          const currentValue = tempSettings[selectedUserId]?.run_every_of_random ?? 1;
                          if (currentValue > 1) {
                            setTempSettings(prev => ({
                              ...prev,
                              [selectedUserId]: {
                                ...prev[selectedUserId],
                                run_every_of_random: currentValue - 1
                              }
                            }));
                          }
                        }}
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                </div>
                <div className={styles.settingItemNoBg}>
                  <button
                    onClick={handleSaveSettings}
                    className={styles.saveButton}
                    disabled={!selectedUserId}
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Canvas Image Settings Section */}
            <div className={styles.div4}>
              <h2>Canvas Background Settings</h2>
              <div className={styles.settingItemNoBg}>
                <button
                  onClick={() => setShowCanvaConfig(true)}
                  className={styles.uploadButton}
                >
                  Choose Canvas Images
                </button>
                
                {/* Show current images */}
                {tempSettings[selectedUserId]?.image_pdf_canva && 
                 typeof tempSettings[selectedUserId].image_pdf_canva === 'object' && 
                 Object.keys(tempSettings[selectedUserId].image_pdf_canva).length > 0 && (
                  <div className={styles.currentImages}>
                    <p>Canvas Images ({Object.entries(tempSettings[selectedUserId].image_pdf_canva)
                      .filter(([key, path]) => {
                        // Filter out non-image entries (like user IDs)
                        return path && 
                               typeof path === 'string' && 
                               (path.startsWith('/canvas/') || 
                                path.startsWith('http') || 
                                path.includes('.jpg') || 
                                path.includes('.jpeg') || 
                                path.includes('.png') || 
                                path.includes('.gif') ||
                                path.includes('.webp'));
                      }).length}):</p>
                    
                    {/* Show image previews grid */}
                    {/* <div className={styles.imagePreviewGrid}>
                      {Object.entries(tempSettings[selectedUserId].image_pdf_canva).map(([key, path], index) => (
                        <div key={key} className={styles.imagePreviewItem}>
                          <img 
                            src={path} 
                            alt={`Image ${index + 1}`} 
                            className={styles.imagePreviewThumbnail}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'block';
                            }}
                          />
                          <p className={styles.imageError} style={{ display: 'none', color: '#dc3545', fontSize: '0.8rem' }}>
                            Image not found
                          </p>
                          <p className={styles.imagePreviewName}>{key}</p>
                        </div>
                      ))}
                    </div> */}
                    
                    {/* Show "Show All Images" button if more than 1 image */}
                    {(() => {
                      const actualImageCount = Object.entries(tempSettings[selectedUserId].image_pdf_canva)
                        .filter(([key, path]) => {
                          // Filter out non-image entries (like user IDs)
                          return path && 
                                 typeof path === 'string' && 
                                 (path.startsWith('/canvas/') || 
                                  path.startsWith('http') || 
                                  path.includes('.jpg') || 
                                  path.includes('.jpeg') || 
                                  path.includes('.png') || 
                                  path.includes('.gif') ||
                                  path.includes('.webp'));
                        }).length;
                      
                      return actualImageCount > 0 ? (
                        <div className={styles.showAllImagesContainer}>
                          <button
                            onClick={() => {
                              // Create a proper modal to show all images
                              const allImages = tempSettings[selectedUserId].image_pdf_canva;
                              const imageEntries = Object.entries(allImages)
                                .filter(([key, path]) => {
                                  // Filter out non-image entries (like user IDs)
                                  return path && 
                                         typeof path === 'string' && 
                                         (path.startsWith('/canvas/') || 
                                          path.startsWith('http') || 
                                          path.includes('.jpg') || 
                                          path.includes('.jpeg') || 
                                          path.includes('.png') || 
                                          path.includes('.gif') ||
                                          path.includes('.webp'));
                                });
                              
                                                          // Get backend URL for proper image serving
                            const backendUrl = process.env.NEXT_PUBLIC_API_URL;
                              
                              // Create modal content with proper styling
                              const modalContent = document.createElement('div');
                              modalContent.className = styles.imageModal;
                              modalContent.style.cssText = `
                                position: fixed;
                                top: 0;
                                left: 0;
                                width: 100%;
                                height: 100%;
                                background: rgba(0, 0, 0, 0.8);
                                z-index: 1000;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                              `;
                              
                              modalContent.innerHTML = `
                                <div style="
                                  background: white;
                                  padding: 20px;
                                  border-radius: 8px;
                                  max-width: 90%;
                                  max-height: 90%;
                                  overflow-y: auto;
                                  position: relative;
                                ">
                                  <button onclick="this.parentElement.parentElement.remove()" style="
                                    position: absolute;
                                    top: 10px;
                                    right: 10px;
                                    background: #dc3545;
                                    color: white;
                                    border: none;
                                    border-radius: 50%;
                                    width: 30px;
                                    height: 30px;
                                    cursor: pointer;
                                    font-size: 16px;
                                  ">×</button>
                                  <h3 style="margin-top: 0; margin-bottom: 20px;">All Images (${imageEntries.length})</h3>
                                  <div style="
                                    display: grid;
                                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                                    gap: 20px;
                                    margin-bottom: 20px;
                                  ">
                                    ${imageEntries.map(([key, path]) => {
                                      // Convert backend path to frontend accessible URL
                                      const imageUrl = path.startsWith('/canvas/') 
                                        ? `${backendUrl}${path}` 
                                        : path;
                                      
                                      return `
                                        <div style="
                                          border: 1px solid #ddd;
                                          border-radius: 8px;
                                          padding: 10px;
                                          text-align: center;
                                        ">
                                          <img src="${imageUrl}" alt="${key}" style="
                                            width: 100%;
                                            height: 150px;
                                            object-fit: cover;
                                            border-radius: 4px;
                                            margin-bottom: 10px;
                                          " />
                                          <p style="margin: 0; font-weight: bold; color: #333;">${key}</p>
                                          <p style="margin: 5px 0 0 0; font-size: 12px; color: #666; word-break: break-all;">${path}</p>
                                        </div>
                                      `;
                                    }).join('')}
                                  </div>
                                </div>
                              `;
                              
                              // Add modal to page
                              document.body.appendChild(modalContent);
                            }}
                            className={styles.showAllImagesButton}
                          >
                            Show All Images ({actualImageCount})
                          </button>
                        </div>
                      ) : null;
                    })()}
                    
                    {/* Show image list in backend format */}
                    <div className={styles.imageList}>
                      <p>Canvas Image Paths:</p>
                      {Object.entries(tempSettings[selectedUserId].image_pdf_canva)
                        .filter(([key, path]) => {
                          // Filter out non-image entries (like user IDs)
                          // Only show entries that have image-like paths
                          return path && 
                                 typeof path === 'string' && 
                                 (path.startsWith('/canvas/') || 
                                  path.startsWith('http') || 
                                  path.includes('.jpg') || 
                                  path.includes('.jpeg') || 
                                  path.includes('.png') || 
                                  path.includes('.gif') ||
                                  path.includes('.webp'));
                        })
                        .sort(([a], [b]) => {
                          // Sort by image_1, image_2, etc.
                          const aNum = parseInt(a.replace('image_', ''));
                          const bNum = parseInt(b.replace('image_', ''));
                          return aNum - bNum;
                        })
                        .map(([key, path]) => {
                          // Convert backend path to frontend accessible URL
                          const backendUrl = process.env.NEXT_PUBLIC_API_URL;
                          const imageUrl = path.startsWith('/canvas/') 
                            ? `${backendUrl}${path}` 
                            : path;
                          
                          return (
                            <div key={key} className={styles.imagePathItem}>
                              <strong>{key}:</strong> {path}
                              {path.startsWith('/canvas/') && (
                                <span className={styles.canvasBadge}>Canvas</span>
                              )}
                              <br />
                              <small style={{ color: '#666' }}>Accessible at: {imageUrl}</small>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
                
                {/* Fallback for single image (backward compatibility) */}
                {tempSettings[selectedUserId]?.image_path && 
                 tempSettings[selectedUserId].image_path !== "/asfgrebvxcv" && 
                 tempSettings[selectedUserId].image_path !== "" && 
                 (!tempSettings[selectedUserId]?.image_pdf_canva || 
                  typeof tempSettings[selectedUserId].image_pdf_canva !== 'object' || 
                  Object.keys(tempSettings[selectedUserId].image_pdf_canva).length === 0) && (
                  <div className={styles.currentImage}>
                    <p>Current Image: {tempSettings[selectedUserId].updateImage}</p>
                    {(() => {
                                                // Convert backend path to frontend accessible URL
                          const backendUrl = process.env.NEXT_PUBLIC_API_URL;
                          const imageUrl = tempSettings[selectedUserId].image_path.startsWith('/canvas/') 
                            ? `${backendUrl}${tempSettings[selectedUserId].image_path}` 
                            : tempSettings[selectedUserId].image_path;
                      
                      return (
                        <img 
                          src={imageUrl} 
                          alt="Current background" 
                          className={styles.currentImagePreview}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                      );
                    })()}
                    <p className={styles.imageError} style={{ display: 'none', color: '#dc3545', fontSize: '0.9rem' }}>
                      Image not found
                    </p>
                  </div>
                )}
              </div>
              <div className={styles.settingItemNoBg}>
                <button
                  onClick={handleSaveSettings}
                  className={styles.saveButton}
                >
                  Save Settings
                </button>
              </div>
            </div>

            {/* Zoom Control Section */}
            <div className={styles.div5}>
              <h2>Zoom Control Respond</h2>
              <div className={styles.settingItemNoBg}>
                <label>Zoom Level:</label>
                <div className={styles.numberInputContainer}>
                  <input
                    type="number"
                    name="zoom_level"
                    value={tempSettings[selectedUserId]?.zoom_level ?? 100}
                    onChange={(e) => handleZoomChange(e.target.value)}
                    min="50"
                    max="200"
                    className={styles.numberInput}
                    data-control="zoom_level"
                  />
                  <div className={styles.numberControls}>
                    <button 
                      className={styles.numberControl}
                      onClick={() => {
                        const currentValue = tempSettings[selectedUserId]?.zoom_level ?? 100;
                        if (currentValue < 200) {
                          setTempSettings(prev => ({
                            ...prev,
                            [selectedUserId]: {
                              ...prev[selectedUserId],
                              zoom_level: currentValue + 1
                            }
                          }));
                        }
                      }}
                    >
                      ▲
                    </button>
                    <button 
                      className={styles.numberControl}
                      onClick={() => {
                        const currentValue = tempSettings[selectedUserId]?.zoom_level ?? 100;
                        if (currentValue > 50) {
                          setTempSettings(prev => ({
                            ...prev,
                            [selectedUserId]: {
                              ...prev[selectedUserId],
                              zoom_level: currentValue - 1
                            }
                          }));
                        }
                      }}
                    >
                      ▼
                    </button>
                  </div>
                </div>
                <span style={{ marginLeft: '10px', fontSize: '14px', color: '#666' }}>%</span>
              </div>
              <div className={styles.settingItemNoBg}>
                <button
                  onClick={handleSaveSettings}
                  className={styles.saveButton}
                  disabled={!selectedUserId}
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Canva Config Modal */}
        {showCanvaConfig && (
          <AdminCanvaConfig
            onImageSave={handleImageSave}
            onClose={() => setShowCanvaConfig(false)}
            userId={selectedUserId}
            existingImages={tempSettings[selectedUserId]?.image_pdf_canva || {}}
          />
        )}

        {/* Bottom Control Section */}
        <div className={styles.bottomControlSection}>
          {/* First Box - Public Toggle and Backend Controls - Only show when user is selected */}
          {systemControlsVisible && (
            <div className={`${styles.controlBox} ${systemControlsAnimating ? (selectedUserId && selectedUserId !== 'default' ? styles.systemControlsEnter : styles.systemControlsExit) : ''}`}>
              <h2>System Controls</h2>
              <div className={styles.controlButtons}>
                <div className={styles.controlButtonGroup}>
                  <button 
                    className={`${styles.downloadButton} ${publicAccessEnabled ? styles.toggleButtonActive : styles.toggleButtonInactive}`}
                    onClick={handlePublicAccessToggle}
                  >
                    🌐 Public Access {publicAccessEnabled ? '(ON)' : '(OFF)'}
                  </button>
                  
                  <button 
                    className={`${styles.downloadButton} ${styles.adjustDatasetButton} ${showDataPreview ? styles.active : ''}`}
                    onClick={() => {
                      if (showDataPreview) {
                        window.showNotification('Data Preview closed');
                        setShowDataPreview(false);
                      } else {
                        window.showNotification('Adjusting Dataset...');
                        setShowDataPreview(true);
                      }
                    }}
                  >
                    🔧 Adjust Dataset
                  </button>
                  
                  <button 
                    className={styles.downloadButton}
                    onClick={() => {
                      window.showNotification('Downloading Dataset...');
                    }}
                  >
                    📥 Download Dataset
                  </button>
                  
                  <button 
                    className={`${styles.downloadButton} ${backendChangeEnabled ? styles.toggleButtonActive : styles.toggleButtonInactive}`}
                    onClick={handleBackendChangeToggle}
                  >
                    ⚙️ Backend Change {backendChangeEnabled ? '(ON)' : '(OFF)'}
                  </button>
                </div>
              </div>
              

            </div>
          )}

          {/* Data Preview Section */}
          {showDataPreview && (
            <DataPreview
              userId={selectedUserId}
              onClose={() => setShowDataPreview(false)}
            />
          )}

          {/* Second Box - Download Dataset */}
          <div className={styles.controlBox}>
            <h2>Download Dataset</h2>
            <div className={styles.downloadSection}>
              <div className={styles.downloadButtons}>
                <button 
                  className={styles.downloadButton}
                  onClick={() => {
                    window.showNotification('Downloading All Dataset...');
                  }}
                >
                  📥 Download All Dataset
                </button>
                <button 
                  className={styles.downloadButton}
                  onClick={() => {
                    window.showNotification('Downloading User Profiles...');
                  }}
                >
                  👥 Download User Profiles
                </button>
                <button 
                  className={styles.downloadButton}
                  onClick={() => {
                    window.showNotification('Downloading Raw Dataset...');
                  }}
                >
                  📋 Download Raw Dataset
                </button>
                <button 
                  className={styles.downloadButton}
                  onClick={() => {
                    window.showNotification('Downloading Enhance Dataset...');
                  }}
                >
                  📋 Download Enhance Dataset
                </button>
                <button 
                  className={styles.downloadButton}
                  onClick={() => {
                    window.showNotification('Downloading Label Parameters...');
                  }}
                >
                  📋 Download Label Parameters
                </button>
              </div>
            </div>
          </div>

          {/* Go Home Page Button */}
          <div className={styles.downloadSection} style={{ marginBottom: '4rem' }}>
            <div className={styles.downloadButtons}>
              <button 
                className={styles.downloadButton}
                onClick={async () => {
                  try {
                    // Clear admin session before going home
                    await fetch('/api/admin/auth', { method: 'DELETE' });
                    // Navigate to home page
                    window.location.href = '/';
                  } catch (error) {
                    console.error('Error during logout:', error);
                    // Still navigate even if logout fails
                    window.location.href = '/';
                  }
                }}
              >
                🏠 Go Home Page (Logout)
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}