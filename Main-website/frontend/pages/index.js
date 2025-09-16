// frontend/pages/index.js
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import { useProcessStatus, useBackendConnection } from '../utils/stateManager';
import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useConsent } from '../components/consent_ui/ConsentContext';
import { isProfileComplete } from '../utils/consentManager';
import Image from 'next/image';
import dynamic from 'next/dynamic';

// Dynamic import for heavy components
const Truck = dynamic(() => import('lucide-react').then(mod => ({ default: mod.Truck })), { ssr: false });

// Use relative URLs for browser compatibility

// Stable constants to prevent object recreation
const BUTTONS_REQUIRING_CONSENT = ['collected-dataset-custom', 'collected-dataset'];
const MAX_RETRIES = 3;

// Memoized ButtonOverlay component
const ButtonOverlay = memo(({ enabled }) => {
  // Only show overlay when button is disabled (enabled = false)
  if (enabled) return null;
  return (
    <div className={styles.buttonOverlay}>
      <span className={styles.overlayIcon}>✕</span>
    </div>
  );
});

ButtonOverlay.displayName = 'ButtonOverlay';

export default function HomePage() {
  const router = useRouter();
  const { isProcessReady, toggleProcessStatus } = useProcessStatus();
  const { isConnected, authValid, checkConnection } = useBackendConnection();
  const { consentStatus, userId, loading, consentChecked, recheckConsent } = useConsent();
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [buttonStates, setButtonStates] = useState({});
  const [mounted, setMounted] = useState(false);
  const [userData, setUserData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [publicDataAccess, setPublicDataAccess] = useState(false);

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
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
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
              'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
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
              'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
            }
          });
          if (!newResponse.ok) {
            throw new Error('Failed to fetch newly created profile');
          }
          
          const data = await newResponse.json();
          console.log('Fetched new user data:', data);
          setUserData(data);
          
          // Fetch public_data_access from data center settings
          await fetchPublicDataAccess();
          
          setRetryCount(0); // Reset retry count on success
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } else {
        const data = await response.json();
        console.log('Successfully fetched user data:', data);
        setUserData(data);
        
        // Fetch public_data_access from data center settings
        await fetchPublicDataAccess();
        
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

  // Fetch public_data_access from data center settings
  const fetchPublicDataAccess = async () => {
    if (!userId) {
      console.log('No userId available for public data access fetch');
      return;
    }

    try {
      console.log(`Fetching public data access for user: ${userId}`);
      const response = await fetch(`/api/data-center/settings/${userId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Data center settings response:', data);
        
        if (data.success && data.data) {
          const publicAccess = data.data.public_data_access || false;
          console.log(`Setting public data access to: ${publicAccess}`);
          setPublicDataAccess(publicAccess);
        } else {
          console.log('No data center settings found, defaulting to false');
          setPublicDataAccess(false);
        }
      } else {
        console.log('Failed to fetch data center settings, defaulting to false');
        setPublicDataAccess(false);
      }
    } catch (error) {
      console.error('Error fetching public data access:', error);
      setPublicDataAccess(false);
    }
  };

  // Fetch user data when userId changes
  useEffect(() => {
    if (userId && retryCount === 0) {
      fetchUserData();
    }
  }, [userId]); // Only depend on userId to avoid circular dependency

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

    const handlePublicAccessUpdate = (event) => {
      console.log('Received public access update:', event.detail);
      if (event.detail && event.detail.type === 'publicAccessUpdate') {
        // Check if this update is for the current user
        if (event.detail.userId === userId) {
          console.log(`Updating public data access for current user to: ${event.detail.enabled}`);
          setPublicDataAccess(event.detail.enabled);
        }
      }
    };

    window.addEventListener('adminOverride', handleAdminOverride);
    window.addEventListener('publicAccessUpdate', handlePublicAccessUpdate);
    
    return () => {
      window.removeEventListener('adminOverride', handleAdminOverride);
      window.removeEventListener('publicAccessUpdate', handlePublicAccessUpdate);
    };
  }, [userId]);

  // Enhanced consent checking effect
  useEffect(() => {
    // Recheck consent when component mounts and consent hasn't been checked yet
    if (mounted && !consentChecked && !loading) {
      console.log('Rechecking consent status on mount');
      recheckConsent();
    }
  }, [mounted, consentChecked, loading, recheckConsent]);

  // Memoize button disabled check for better performance
  const isButtonDisabled = useCallback((destination) => {
    // Special case for collected-dataset-custom
    if (destination === 'collected-dataset-custom') {
      return !buttonStates[userId];
    }
    
    // Default case for other buttons
    return false;
  }, [buttonStates, userId]);

  const handleButtonClick = (destination) => {
    // Check if button is disabled
    if (isButtonDisabled(destination)) {
      console.log(`Button ${destination} is disabled`);
      return;
    }

    // Check consent status only for buttons that require it
    if (BUTTONS_REQUIRING_CONSENT.includes(destination) && consentStatus === null) {
      console.log('Consent not set, showing banner');
      // Trigger consent recheck before showing banner
      recheckConsent();
      return;
    }

    // Handle navigation based on destination
    switch (destination) {
      case 'collected-dataset-custom':
        // Navigate with only userId - the target page will fetch userData itself
        router.push({
          pathname: '/collected-dataset-customized',
          query: { userId: userId }
        });
        break;

      case 'collected-dataset':
        router.push({
          pathname: '/collected-dataset',
          query: { userId: userId }
        });
        break;

      case 'testing-model':
        router.push('/testing-image');
        break;

      case 'realtime-model':
        setShowComingSoon(true);
        break;

      case 'process-set':
        router.push({
          pathname: '/process_set',
          query: { userId: userId }
        });
        break;

      default:
        console.warn(`Unknown destination: ${destination}`);
    }
  };

  // Memoize button class for better performance and stability
  const getButtonClass = useCallback((destination) => {
    if (destination === 'collected-dataset-custom') {
      const isEnabled = buttonStates[userId] || false;
      return isEnabled ? styles.buttonEnabled : styles.buttonDisabled;
    }
    
    if (destination === 'collected-dataset') {
      const isEnabled = consentStatus !== null;
      return isEnabled ? styles.buttonEnabled : styles.buttonDisabled;
    }
    
    return styles.buttonEnabled; // Default for other buttons
  }, [buttonStates, userId, consentStatus, mounted, loading, styles.buttonEnabled, styles.buttonDisabled]);

  // Memoize process button class to prevent unnecessary re-renders
  const getProcessButtonClass = useMemo(() => {
    if (!mounted) return `${styles.menuButton} ${styles.largerButton}`;

    const readyClass =
      isProcessReady && isConnected && authValid
        ? styles.readyButton
        : styles.notReadyButton;

    return `${styles.menuButton} ${styles.largerButton} ${readyClass}`;
  }, [mounted, isProcessReady, isConnected, authValid, styles.menuButton, styles.largerButton, styles.readyButton, styles.notReadyButton]);

  

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.logoContainer}>
          <Image
            src="/logo.png"
            alt="Logo"
            width={60}
            height={60}
            className={styles.logo}
            priority
            quality={75}
            unoptimized={true}
          />
          <Image
            src="/superai_logo.png"
            alt="Super AI Logo"
            width={160}
            height={160}
            className={styles.logoLarge}
            priority
            quality={75}
            unoptimized={true}
          />
        </div>
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
            className={`${styles.menuButton} ${getButtonClass('collected-dataset-custom')}`} 
            onClick={() => handleButtonClick('collected-dataset-custom')}
            disabled={!buttonStates[userId]}
          >
            <h2>Collected Dataset with customization</h2>
            <ButtonOverlay enabled={buttonStates[userId]} />
          </button>
          <button 
            className={`${styles.menuButton} ${getButtonClass('collected-dataset')}`} 
            onClick={() => handleButtonClick('collected-dataset')}
            disabled={consentStatus === null}
          >
            <h2>Collected Dataset</h2>
            <ButtonOverlay enabled={consentStatus !== null} />
          </button>
        </div>

        {/* Third row: Process Folder Button - Only show if public_data_access is true */}
        {publicDataAccess && (
          <div className={styles.centerButtonContainer}>
            <button className={`${styles.menuButton} ${styles.largerButton}`} onClick={() => handleButtonClick('process-set')}>
              <h2>Process Image Folder</h2>
            </button>
          </div>
        )}
        
      </main>

      {/* Coming Soon Popup */}
      {showComingSoon && (
        <div className={styles.popupOverlay} onClick={() => setShowComingSoon(false)}>
          <div className={styles.popupContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.popupHeader}>
              <h3>Coming Soon!</h3>
            </div>
            <div className={styles.popupBody}>
              <p>The Realtime Model feature is currently under development.</p>
              <p>Please check back later for updates!</p>
            </div>
            <div className={styles.popupFooter}>
              <button 
                className={styles.okButton}
                onClick={() => setShowComingSoon(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

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