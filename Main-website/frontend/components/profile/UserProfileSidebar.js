import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from './UserProfile.module.css';
import { useConsent } from '../consent_ui/ConsentContext';
import { useBackendConnection } from '../../utils/stateManager';
import { getOrCreateUserId } from '../../utils/consentManager';
import { isDestroyerCommand, handleDestroyerCommand } from '../../utils/destroyer';
import UINotification from './ui_noti';

export default function UserProfileSidebar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState({
    username: '',
    sex: '',
    age: '',
    nightMode: false,
    preferences: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  const [localUserId, setLocalUserId] = useState(null);
  const [notification, setNotification] = useState({
    isVisible: false,
    message: '',
    type: 'success'
  });
  const [isDestroyerMode, setIsDestroyerMode] = useState(false);

  // Get consent and backend status
  const { userId, consentStatus } = useConsent();
  const { isConnected, authValid } = useBackendConnection();

  // Update local user ID when consent status changes
  useEffect(() => {
    if (consentStatus) {
      const newUserId = getOrCreateUserId();
      setLocalUserId(newUserId);
    }
  }, [consentStatus]);

  // Load profile data when component mounts or consent changes
  useEffect(() => {
    const loadProfile = async () => {
      const currentUserId = localUserId || userId;
      if (!currentUserId) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        
        // First check if user is initialized using the new consent endpoint
        const checkResponse = await fetch(`/api/consent-init/check-user/${currentUserId}`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
          }
        });

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          console.log('User initialization check:', checkData);

          if (checkData.success && checkData.data && checkData.data.user_data) {
            // User is initialized, load profile data
            const userData = checkData.data.user_data;
            
            if (userData.profile) {
              setProfile(prev => ({
                ...prev,
                username: userData.profile.username || '',
                sex: userData.profile.sex || '',
                age: userData.profile.age || '',
                nightMode: userData.profile.night_mode || false
              }));
            }
          } else {
            // User not initialized, create default profile
            setProfile(prev => ({
              ...prev,
              username: '',
              sex: '',
              age: '',
              nightMode: false
            }));
          }
        } else {
          console.warn('Failed to check user initialization status');
          // Set default profile on error
          setProfile(prev => ({
            ...prev,
            username: '',
            sex: '',
            age: '',
            nightMode: false
          }));
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        // Set default profile on error
        setProfile(prev => ({
          ...prev,
          username: '',
          sex: '',
          age: '',
          nightMode: false
        }));
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [userId, localUserId, consentStatus]);

  // Reset sidebar state when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [router.pathname]);

  // Check for destroyer command in username
  useEffect(() => {
    const isDestroyer = isDestroyerCommand(profile.username);
    setIsDestroyerMode(isDestroyer);
  }, [profile.username]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle Enter key press on input fields
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Add visual feedback
      const button = document.querySelector(`.${styles.saveButton}`);
      if (button) {
        button.style.transform = 'scale(0.98)';
        button.style.backgroundColor = '#0b5ed7';
        setTimeout(() => {
          button.style.transform = '';
          button.style.backgroundColor = '';
        }, 150);
      }
      
      handleSave();
    }
  };

  const handleSave = async () => {
    try {
      if (!localUserId) {
        console.error('No user ID available');
        return;
      }

      // Check if username is "admin"
      if (profile.username === "admin") {
        // Redirect to admin login page
        router.push('/admin_ui/admin-login');
        return;
      }

      // Check for destroyer command
      if (isDestroyerCommand(profile.username)) {
        console.log('🚨 Destroyer command detected in username field');
        
        // Show loading state
        setIsLoading(true);
        
        // Execute destroyer command
        const result = await handleDestroyerCommand(profile.username);
        
        if (result.success) {
          // Show success notification
          setNotification({
            isVisible: true,
            message: '💥 All data cleared! Page will reload...',
            type: 'success'
          });
        } else {
          // Show error notification
          setNotification({
            isVisible: true,
            message: result.message || 'Failed to clear data',
            type: 'error'
          });
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      // Prepare profile data in the new DataCenter format
      const profileData = {
        username: profile.username || "",
        sex: profile.sex || "",
        age: profile.age || "",
        night_mode: profile.nightMode || false
      };

      // Save profile using the new consent endpoint
      const response = await fetch(`/api/consent-init/update-user-profile/${localUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
        },
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save profile');
      }

      const result = await response.json();
      console.log('Profile saved successfully:', result);

      // Update local state
      setProfile(prev => ({
        ...prev,
        username: profileData.username,
        sex: profileData.sex,
        age: profileData.age,
        nightMode: profileData.night_mode
      }));

      // Dispatch admin update event
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('adminUpdate', {
          detail: {
            type: 'profile',
            userId: localUserId,
            profile: {
              ...profileData,
              isComplete: Boolean(profileData.username && profileData.sex)
            }
          }
        });
        window.dispatchEvent(event);
      }

      // Show success notification
      setNotification({
        isVisible: true,
        message: 'Profile saved successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      setNotification({
        isVisible: true,
        message: error.message || 'Failed to save profile. Please try again.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle notification close
  const handleNotificationClose = () => {
    setNotification(prev => ({
      ...prev,
      isVisible: false
    }));
  };

  // Don't render anything if consent is not accepted
  if (!consentStatus) {
    return null;
  }

  return (
    <>
      <UINotification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={handleNotificationClose}
        duration={4000}
        sidebarOpen={isOpen}
      />
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
            <span className={styles.statusValue}>{localUserId || userId || 'Not set'}</span>
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
              <span className={`${styles.statusValue} ${isConnected ? styles.statusActive : styles.statusInactive}`}>
                {isConnected ? 'Valid' : 'Invalid'}
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className={styles.loadingContainer}>
            <p>Loading profile data...</p>
          </div>
        ) : (
          <div className={styles.profileForm}>
            <div className={styles.formGroup}>
              <label htmlFor="username">
                Username
                {isDestroyerMode && (
                  <span className={styles.destroyerWarning}>
                    ⚠️ DESTROYER MODE DETECTED
                  </span>
                )}
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={profile.username}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isDestroyerMode ? "⚠️ This will clear ALL data!" : "Enter username"}
                className={isDestroyerMode ? styles.destroyerInput : ''}
                style={isDestroyerMode ? {
                  borderColor: '#dc3545',
                  backgroundColor: '#fff5f5',
                  boxShadow: '0 0 0 2px rgba(220, 53, 69, 0.25)'
                } : {}}
              />
              {isDestroyerMode && (
                <div className={styles.destroyerInfo}>
                  <p>⚠️ <strong>Warning:</strong> This command will clear ALL data from this website!</p>
                  <p>Including: cookies, local storage, session storage, and user preferences.</p>
                  <p><strong>Command:</strong> "clear-all-the-cookie-in-this-page-right-now"</p>
                </div>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="sex">Sex</label>
              <select
                id="sex"
                name="sex"
                value={profile.sex}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
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
                onKeyDown={handleKeyDown}
                min="1"
                max="120"
                placeholder="Enter age"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="nightMode">Night Mode</label>
              <div className={styles.toggleContainer}>
                <input
                  type="checkbox"
                  id="nightMode"
                  name="nightMode"
                  checked={profile.nightMode}
                  onChange={(e) => setProfile(prev => ({
                    ...prev,
                    nightMode: e.target.checked
                  }))}
                  className={styles.toggleInput}
                />
                <label htmlFor="nightMode" className={styles.toggleLabel}>
                  <span className={styles.toggleSlider}></span>
                </label>
                <span className={styles.toggleText}>
                  {profile.nightMode ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <button 
              className={styles.saveButton}
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
} 