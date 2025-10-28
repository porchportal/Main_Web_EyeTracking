// frontend/pages/index.js
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import { useProcessStatus, useBackendConnection } from '../utils/stateManager';
import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useConsent } from '../components/consent_ui/ConsentContext';
import { isProfileComplete } from '../utils/consentManager';
import Image from 'next/image';

// Stable constants to prevent object recreation
const BUTTONS_REQUIRING_CONSENT = ['collected-dataset-custom', 'collected-dataset'];
const MAX_RETRIES = 3;

// Memoized ButtonOverlay component
const ButtonOverlay = memo(({ enabled, isReady }) => {
  // Don't show overlay while still checking (prevents flash)
  if (!isReady) return null;
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
  const { isProcessReady } = useProcessStatus();
  const { isConnected, authValid, checkConnection } = useBackendConnection();
  const { consentStatus, userId, loading, consentChecked, recheckConsent, showBanner } = useConsent();

  // Initialize buttonStates from localStorage to prevent flash on load
  const [buttonStates, setButtonStates] = useState(() => {
    if (typeof window === 'undefined') return {};
    // Try to get initial state from localStorage during initialization
    const savedStates = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('buttonState_')) {
          const userId = key.replace('buttonState_', '');
          const value = localStorage.getItem(key);
          savedStates[userId] = value === 'true';
        }
      }
    } catch (e) {
      console.error('Error loading button states:', e);
    }
    return savedStates;
  });

  const [mounted, setMounted] = useState(false);
  const [userData, setUserData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [publicDataAccess, setPublicDataAccess] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userInConsentData, setUserInConsentData] = useState(null);
  const [consentDataChecked, setConsentDataChecked] = useState(false);

  // Check if user ID exists in consent_data.json
  const checkUserInConsentData = async () => {
    if (!userId) {
      console.log('checkUserInConsentData: No userId, skipping check');
      return;
    }

    try {
      console.log('checkUserInConsentData: Checking userId:', userId);

      // Fetch consent data from backend
      const response = await fetch('/api/consent/check', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        const data = await response.json();
        const userExists = data.exists || false;
        const previousState = userInConsentData;

        console.log('checkUserInConsentData: Result - userExists:', userExists);

        setUserInConsentData(userExists);
        setConsentDataChecked(true); // Mark check as complete

        // If user is not in consent data, trigger the consent banner
        // But only if this is the first check (not a background verification)
        if (!userExists && previousState !== true) {
          console.log('User not found in consent_data.json, showing consent banner');
          recheckConsent();
          // Clear any existing consent cookies
          document.cookie.split(";").forEach((c) => {
            const cookieName = c.trim().split("=")[0];
            if (cookieName.includes('consent') || cookieName.includes('userId')) {
              document.cookie = cookieName + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
            }
          });
        } else if (!userExists && previousState === true) {
          // This is a verification check and user is not found - log error
          console.error('Verification failed: User not found in consent_data.json after accepting consent');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to check consent data:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        setUserInConsentData(false);
        setConsentDataChecked(true); // Mark check as complete even on error
      }
    } catch (error) {
      console.error('Error checking consent data:', {
        message: error.message,
        stack: error.stack
      });
      setUserInConsentData(false);
      setConsentDataChecked(true); // Mark check as complete even on error
    }
  };

  // Fetch user data from MongoDB
  const fetchUserData = async () => {
    if (!userId) {
      return;
    }

    try {
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

        // Don't retry on server errors (500, 501, 505) - these indicate backend problems
        if (response.status >= 500 && response.status < 600) {
          console.error(`Server error ${response.status}, not retrying. Please check backend services.`);
          throw new Error(`Server error! status: ${response.status}`);
        }

        if (response.status === 404) {
          // User profile doesn't exist, try to create it
          if (retryCount >= MAX_RETRIES) {
            console.error('Max retries reached for profile creation');
            throw new Error(`Max retries reached, unable to create user profile`);
          }

          console.log(`User profile not found, creating new profile (attempt ${retryCount + 1}/${MAX_RETRIES})`);

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

            // Don't retry on server errors
            if (createResponse.status >= 500 && createResponse.status < 600) {
              console.error(`Server error ${createResponse.status} during profile creation, not retrying`);
              throw new Error(`Server error during profile creation: ${createResponse.status}`);
            }

            // Retry for other errors (network issues, etc.)
            const nextRetry = retryCount + 1;
            setRetryCount(nextRetry);
            setTimeout(() => {
              console.log(`Retrying profile creation (attempt ${nextRetry + 1}/${MAX_RETRIES})`);
              fetchUserData();
            }, 2000);
            return;
          }

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
          setUserData(data);

          // Fetch public_data_access from data center settings
          await fetchPublicDataAccess();

          setRetryCount(0); // Reset retry count on success
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } else {
        const data = await response.json();
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

      // Only retry on network errors or transient issues, not on server errors
      const isServerError = error.message && error.message.includes('Server error');

      if (!isServerError && retryCount < MAX_RETRIES) {
        const nextRetry = retryCount + 1;
        setRetryCount(nextRetry);
        console.log(`Retrying fetchUserData (attempt ${nextRetry + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          fetchUserData();
        }, 2000);
      } else {
        if (isServerError) {
          console.error('Server error detected, not retrying. Please check backend MongoDB connection.');
        } else {
          console.error('Max retries reached, giving up');
        }
        setRetryCount(0);
      }
    }
  };

  // Fetch public_data_access from data center settings
  const fetchPublicDataAccess = async () => {
    if (!userId) {
      return;
    }

    try {
      const response = await fetch(`/api/data-center/settings/${userId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.data) {
          const publicAccess = data.data.public_data_access || false;
          setPublicDataAccess(publicAccess);
        } else {
          setPublicDataAccess(false);
        }
      } else {
        setPublicDataAccess(false);
      }
    } catch (error) {
      console.error('Error fetching public data access:', error);
      setPublicDataAccess(false);
    }
  };

  // Check if user exists in consent data when userId changes
  useEffect(() => {
    if (userId) {
      checkUserInConsentData();
    }
  }, [userId]);

  // Fetch user data when userId changes
  useEffect(() => {
    if (userId && retryCount === 0) {
      fetchUserData();
    }
  }, [userId]); // Only depend on userId to avoid circular dependency

  // Reset retry count when userId changes
  useEffect(() => {
    setRetryCount(0);
    setConsentDataChecked(false); // Reset check state when userId changes
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
      
      setButtonStates(prev => ({
        ...prev,
        [userId]: enabled
      }));
      // Save to local storage
      localStorage.setItem(`buttonState_${userId}`, enabled.toString());
    };

    // Load button state from local storage on mount (only if not already loaded)
    if (userId && buttonStates[userId] === undefined) {
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
      if (event.detail && event.detail.type === 'adminOverride') {
        setButtonStates(prev => {
          const newState = {
            ...prev,
            [event.detail.userId]: event.detail.enabled
          };
          return newState;
        });
      }
    };

    const handlePublicAccessUpdate = (event) => {
      if (event.detail && event.detail.type === 'publicAccessUpdate') {
        // Check if this update is for the current user
        if (event.detail.userId === userId) {
          setPublicDataAccess(event.detail.enabled);
        }
      }
    };

    const handleConsentAccepted = (event) => {
      // When consent is accepted, immediately update the state and recheck
      console.log('Consent accepted event received, updating state');
      if (userId) {
        // Immediately set userInConsentData to true to unlock buttons
        setUserInConsentData(true);
        setConsentDataChecked(true);

        // Force a recheck of consent status from ConsentContext
        recheckConsent();

        // Also recheck in the background to verify (with delay to ensure backend has saved)
        setTimeout(() => {
          checkUserInConsentData();
        }, 1500);
      }
    };

    window.addEventListener('adminOverride', handleAdminOverride);
    window.addEventListener('publicAccessUpdate', handlePublicAccessUpdate);
    window.addEventListener('consentAccepted', handleConsentAccepted);

    return () => {
      window.removeEventListener('adminOverride', handleAdminOverride);
      window.removeEventListener('publicAccessUpdate', handlePublicAccessUpdate);
      window.removeEventListener('consentAccepted', handleConsentAccepted);
    };
  }, [userId]);

  // Enhanced consent checking effect
  useEffect(() => {
    // Recheck consent when component mounts and consent hasn't been checked yet
    if (mounted && !consentChecked && !loading) {
      recheckConsent();
    }
  }, [mounted, consentChecked, loading, recheckConsent]);

  // Reset navigation state when component unmounts
  useEffect(() => {
    return () => {
      setIsNavigating(false);
    };
  }, []);

  // Reset navigation state when route changes (Next.js 16 compatible)
  useEffect(() => {
    setIsNavigating(false);
  }, [router.pathname, router.asPath]);

  // Memoize button disabled check for better performance
  const isButtonDisabled = useCallback((destination) => {
    // Special case for collected-dataset-custom
    if (destination === 'collected-dataset-custom') {
      // Button is disabled if user is not in consent data OR buttonStates is false
      return userInConsentData !== true || !buttonStates[userId];
    }

    // Default case for other buttons
    return false;
  }, [buttonStates, userId, userInConsentData]);

  const handleButtonClick = async (destination) => {
    // Check if button is disabled
    if (isButtonDisabled(destination)) {
      return;
    }

    // Check if user exists in consent data for buttons that require consent
    if (BUTTONS_REQUIRING_CONSENT.includes(destination)) {
      if (userInConsentData === false || consentStatus === null) {
        // User not in consent data or consent not given, show banner
        console.log('User not authorized or consent not given, showing banner');
        recheckConsent();
        return;
      }
    }

    // Handle navigation based on destination
    switch (destination) {
      case 'collected-dataset-custom':
        // Set loading state and add animation
        setIsNavigating(true);
        
        // Add a small delay to show the animation
        await new Promise(resolve => setTimeout(resolve, 300));
        
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
        router.push('/realtime');
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
    // Show loading state while checks are in progress
    const checksComplete = consentChecked && consentDataChecked;

    if (destination === 'collected-dataset-custom') {
      // While checking, return empty string to keep default appearance
      if (!checksComplete) return '';

      // After checks complete, show appropriate state
      const isEnabled = userInConsentData === true && (buttonStates[userId] || false);
      const baseClass = isEnabled ? styles.buttonEnabled : styles.buttonDisabled;
      if (isNavigating) return `${baseClass} ${styles.buttonLoading}`;
      return baseClass;
    }

    if (destination === 'collected-dataset') {
      // While checking, return empty string to keep default appearance
      if (!checksComplete) return '';

      // After checks complete, show appropriate state
      const isEnabled = userInConsentData === true && consentStatus === true;
      return isEnabled ? styles.buttonEnabled : styles.buttonDisabled;
    }

    return styles.buttonEnabled; // Default for other buttons
  }, [buttonStates, userId, consentStatus, userInConsentData, isNavigating, consentChecked, consentDataChecked, styles.buttonEnabled, styles.buttonDisabled, styles.buttonLoading]);

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={`${styles.logoContainer} ${showBanner ? styles.logoContainerWithBanner : ''}`}>
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
        <p className={styles.description}>This website is for collecting datasets only. Select one of the options below to get started.</p>

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
            disabled={!consentChecked || !consentDataChecked || userInConsentData !== true || !buttonStates[userId] || isNavigating}
          >
            <h2>
              {isNavigating ? 'Loading...' : 'Collected Dataset with customization'}
            </h2>
            <ButtonOverlay
              enabled={userInConsentData === true && buttonStates[userId]}
              isReady={consentChecked && consentDataChecked}
            />
            {isNavigating && (
              <div className={styles.loadingSpinner}>
                <div className={styles.spinner}></div>
              </div>
            )}
          </button>
          <button
            className={`${styles.menuButton} ${getButtonClass('collected-dataset')}`}
            onClick={() => handleButtonClick('collected-dataset')}
            disabled={!consentChecked || !consentDataChecked || userInConsentData !== true || consentStatus !== true}
          >
            <h2>Collected Dataset</h2>
            <ButtonOverlay
              enabled={userInConsentData === true && consentStatus === true}
              isReady={consentChecked && consentDataChecked}
            />
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