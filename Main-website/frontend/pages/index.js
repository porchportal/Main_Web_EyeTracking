// frontend/pages/index.js
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import { useProcessStatus, useBackendConnection } from '../utils/stateManager';
import { useEffect, useState } from 'react';
import { useConsent } from '../components/consent/ConsentContext';
import { isProfileComplete } from '../utils/consentManager';

// const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';

export default function HomePage() {
  const router = useRouter();
  const { isProcessReady, toggleProcessStatus } = useProcessStatus();
  const { isConnected, authValid, checkConnection } = useBackendConnection();
  const { consentStatus, userId } = useConsent();
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [buttonStates, setButtonStates] = useState({});
  const [mounted, setMounted] = useState(false);
  const [userData, setUserData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  // Fetch user data from MongoDB
  const fetchUserData = async () => {
    if (!userId) {
      console.log('No userId available, skipping fetch');
      return;
    }
    
    try {
      console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES}: Fetching user data for ID: ${userId}`);
      // FIX: Use relative URL for browser fetch
      const response = await fetch(`/api/user-preferences/${userId}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          url: `/api/user-preferences/${userId}`
        });

        if (response.status === 404 && retryCount < MAX_RETRIES) {
          console.log('User not found, attempting to create new profile');
          // Create new user profile
          const createResponse = await fetch(`/api/user-preferences/${userId}`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
            },
            body: JSON.stringify({
              userId: userId,
              username: '',
              sex: '',
              age: '',
              image_background: '',
              preferences: {}
            })
          });
          
          if (!createResponse.ok) {
            const createErrorData = await createResponse.json().catch(() => ({}));
            console.error('Failed to create profile:', {
              status: createResponse.status,
              statusText: createResponse.statusText,
              errorData: createErrorData,
              url: `/api/user-preferences/${userId}`
            });
            
            if (retryCount < MAX_RETRIES) {
              setRetryCount(prev => prev + 1);
              setTimeout(() => {
                console.log(`Retrying profile creation (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                fetchUserData();
              }, 2000);
              return;
            }
            
            throw new Error(`Failed to create user profile: ${createErrorData.detail || 'Unknown error'}`);
          }
          
          console.log('Successfully created new profile');
          // Fetch the newly created profile
          const newResponse = await fetch(`/api/user-preferences/${userId}`, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
            }
          });
          if (!newResponse.ok) {
            throw new Error('Failed to fetch newly created profile');
          }
          
          const data = await newResponse.json();
          console.log('Fetched new user data:', data);
          setUserData(data);
          setRetryCount(0); // Reset retry count on success
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } else {
        const data = await response.json();
        console.log('Successfully fetched user data:', data);
        setUserData(data);
        
        // Check both profile completion and local storage
        const savedState = localStorage.getItem(`buttonState_${userId}`);
        const isComplete = data.isComplete || savedState === 'true';
        
        if (isComplete) {
          setButtonStates(prev => ({
            ...prev,
            [userId]: true
          }));
          localStorage.setItem(`buttonState_${userId}`, 'true');
        }
        
        setRetryCount(0);
      }
    } catch (error) {
      console.error('Error in fetchUserData:', error);
      if (retryCount < MAX_RETRIES) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          console.log(`Retrying fetch (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          fetchUserData();
        }, 2000);
      } else {
        console.error('Max retries reached, giving up');
        setRetryCount(0);
      }
    }
  };

  // Fetch user data when userId changes
  useEffect(() => {
    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  // Reset retry count when userId changes
  useEffect(() => {
    setRetryCount(0);
  }, [userId]);

  // Check profile completion on mount
  useEffect(() => {
    setMounted(true);
    checkConnection(true);

    // Check if profile is complete
    const profileComplete = isProfileComplete();
    if (profileComplete && userId) {
      setButtonStates(prev => ({
        ...prev,
        [userId]: true
      }));
    }

    // Add effect to handle profile updates
    const handleAdminUpdate = (event) => {
      const { userId, profile } = event.detail;
      console.log('Admin update received:', { userId, profile });
      
      // Check if profile is complete and update button state
      if (profile.isComplete) {
        setButtonStates(prev => ({
          ...prev,
          [userId]: true
        }));
        // Save to local storage
        localStorage.setItem(`buttonState_${userId}`, 'true');
      }
    };

    const handleButtonStateUpdate = (event) => {
      const { userId, enabled } = event.detail;
      console.log('Button state update received:', { userId, enabled });
      
      setButtonStates(prev => ({
        ...prev,
        [userId]: enabled
      }));
      // Save to local storage
      localStorage.setItem(`buttonState_${userId}`, enabled.toString());
    };

    // Load button state from local storage on mount
    if (userId) {
      const savedState = localStorage.getItem(`buttonState_${userId}`);
      if (savedState !== null) {
        setButtonStates(prev => ({
          ...prev,
          [userId]: savedState === 'true'
        }));
      }
    }

    window.addEventListener('adminUpdate', handleAdminUpdate);
    window.addEventListener('buttonStateUpdate', handleButtonStateUpdate);
    
    return () => {
      window.removeEventListener('adminUpdate', handleAdminUpdate);
      window.removeEventListener('buttonStateUpdate', handleButtonStateUpdate);
    };
  }, [userId]);

  // Add effect to handle admin override events
  useEffect(() => {
    const handleAdminOverride = (event) => {
      console.log('Received admin override:', event.detail);
      if (event.detail && event.detail.type === 'adminOverride') {
        setButtonStates(prev => {
          const newState = {
            ...prev,
            [event.detail.userId]: event.detail.enabled
          };
          console.log('Updated button states from admin:', newState);
          return newState;
        });
      }
    };

    window.addEventListener('adminOverride', handleAdminOverride);
    return () => window.removeEventListener('adminOverride', handleAdminOverride);
  }, []);

  // Add this function before handleButtonClick
  const isButtonDisabled = (destination) => {
    // Special case for collected-dataset-custom
    if (destination === 'collected-dataset-custom') {
      return !buttonStates[userId];
    }
    
    // Default case for other buttons
    return false;
  };

  const handleButtonClick = (destination) => {
    // Check if button is disabled
    if (isButtonDisabled(destination)) {
      console.log(`Button ${destination} is disabled`);
      return;
    }

    // Check consent status
    if (consentStatus === null) {
      console.log('Consent not set, showing banner');
      return;
    }

    // Handle navigation based on destination
    switch (destination) {
      case 'collected-dataset-custom':
        // Fetch user data before navigation
        const fetchAndNavigate = async () => {
          try {
            const response = await fetch(`${API_BASE_URL}/api/user-preferences/${userId}`, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
              }
            });
            if (!response.ok) {
              throw new Error('Failed to fetch user data');
            }
            const userData = await response.json();
            
            // Navigate with both userId and userData
            router.push({
              pathname: '/collected-dataset-customized',
              query: {
                userId: userId,
                userData: JSON.stringify(userData)
              }
            });
          } catch (error) {
            console.error('Error fetching user data:', error);
            // Fallback to just userId if fetch fails
            router.push({
              pathname: '/collected-dataset-customized',
              query: { userId: userId }
            });
          }
        };
        
        fetchAndNavigate();
        break;

      case 'collected-dataset':
        router.push('/collected-dataset');
        break;

      case 'testing-model':
        router.push('/testing-model');
        break;

      case 'realtime-model':
        router.push('/realtime-model');
        break;

      case 'process-set':
        router.push('/process_set');
        break;

      default:
        console.warn(`Unknown destination: ${destination}`);
    }
  };

  // Get button class based on consent status and admin override
  const getButtonClass = (destination) => {
    const isEnabled = buttonStates[userId] || false;
    console.log('Button state check:', { destination, userId, isEnabled });
    
    return isEnabled ? styles.buttonEnabled : styles.buttonDisabled;
  };

  const getProcessButtonClass = () => {
    if (!mounted) return `${styles.menuButton} ${styles.largerButton}`;

    const readyClass =
      isProcessReady && isConnected && authValid
        ? styles.readyButton
        : styles.notReadyButton;

    return `${styles.menuButton} ${styles.largerButton} ${readyClass}`;
  };

  // Add button overlay component
  const ButtonOverlay = ({ enabled }) => {
    if (enabled) return null;
    return (
      <div className={styles.buttonOverlay}>
        <span className={styles.overlayIcon}>✕</span>
      </div>
    );
  };
  

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Eye Tracking Application</h1>
        <p className={styles.description}>Select one of the options below to get started</p>

        <div className={styles.buttonGrid}>
          <button className={styles.menuButton} onClick={() => handleButtonClick('testing-model')}>
            <h2>Testing Single Model</h2>
          </button>
          <button className={styles.menuButton} onClick={() => handleButtonClick('realtime-model')}>
            <h2>Realtime Model</h2>
          </button>
          <button 
            className={getButtonClass('collected-dataset-custom')} 
            onClick={() => handleButtonClick('collected-dataset-custom')}
            style={{ height: '180px' }}
          >
            <h2>Collected Dataset with customization</h2>
            <ButtonOverlay enabled={buttonStates[userId] || false} />
          </button>
          <button className={styles.menuButton} onClick={() => handleButtonClick('collected-dataset')}>
            <h2>Collected Dataset</h2>
          </button>
        </div>

        {/* Third row: Process Folder Button */}
        <div className={styles.centerButtonContainer}>
          <button className={getProcessButtonClass()} onClick={() => handleButtonClick('process-set')}>
            <h2>Process Image Folder</h2>
          </button>
        </div>

        {mounted && userId && (
          <div className={styles.userInfo}>
            <p>User ID: {userId}</p>
            <p>Consent Status: {consentStatus === null ? 'Not set' : consentStatus ? 'Accepted' : 'Declined'}</p>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <a 
          href="https://www.facebook.com/profile.php?id=61557265122746" 
          target="_blank" 
          rel="noopener noreferrer"
          className={styles.footerLink}
          onClick={(e) => {
            e.preventDefault();
            window.open('https://www.facebook.com/profile.php?id=61557265122746', '_blank');
          }}
        >
          Powered by Porch
        </a>
      </footer>
    </div>
  );
}