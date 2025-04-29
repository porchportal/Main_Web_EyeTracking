import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/UserProfile.module.css';
import { getUserProfile, updateUserProfile } from '../utils/consentManager';
import { useConsent } from './consent/ConsentContext';
import { useBackendConnection } from '../utils/stateManager';

export default function UserProfileSidebar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState({
    username: '',
    sex: '',
    age: '',
    image_background: '',
    preferences: {}
  });
  const [statusMessage, setStatusMessageLocal] = useState('');

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
  }, [router.pathname]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    try {
      if (!userId) {
        console.error('No user ID available');
        return;
      }

      // Check if username is "admin"
      if (profile.username === "admin") {
        // Redirect to admin login page
        router.push('/admin-login');
        return;
      }

      // Prepare profile data
      const profileData = {
        preferences: {
          username: profile.username,
          sex: profile.sex,
          age: profile.age
        }
      };

      // Save to backend
      const response = await fetch(`/api/user-preferences/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
        },
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        throw new Error('Failed to save profile');
      }

      const result = await response.json();
      console.log('Profile saved successfully:', result);

      // Update local state
      setProfile(prev => ({
        ...prev,
        ...profileData.preferences
      }));

      // Dispatch admin update event
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('adminUpdate', {
          detail: {
            type: 'profile',
            userId: userId,
            profile: {
              ...profileData.preferences,
              isComplete: Boolean(profileData.preferences.username && profileData.preferences.sex)
            }
          }
        });
        window.dispatchEvent(event);
      }

      // Show success message
      alert('Profile saved successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    }
  };

  const updateStatusMessage = (message) => {
    if (setStatusMessage) {
      setStatusMessage(message);
    }
    setStatusMessageLocal(message);
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
        </div>
      </div>
    </div>
  );
} 