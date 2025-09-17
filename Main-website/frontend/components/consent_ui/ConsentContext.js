// frontend/components/consent_ui/ConsentContext.js
import { createContext, useContext, useState, useEffect, startTransition } from 'react';
import { getUserConsent, updateUserConsent, getOrCreateUserId } from '../../utils/consentManager';

const ConsentContext = createContext();

// Check if running on localhost
const isLocalhost = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '192.168.1.156';
  return isLocal;
};

// Optimized consent checking function with timeout
const checkConsentStatus = async (userId) => {
  try {
    // First check local cookies (fastest)
    const localConsent = getUserConsent();
    
    // If we have local consent data, use it immediately
    if (localConsent && localConsent.consentStatus !== null) {
      return {
        hasConsent: localConsent.consentStatus,
        source: 'local',
        data: localConsent
      };
    }
    
    // If no local consent, check backend with timeout
    if (userId) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      try {
        const response = await fetch(`/api/user-preferences/${userId}`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-API-Key': process.env.NEXT_PUBLIC_API_KEY 
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          const backendConsent = data.data?.cookie ?? false;
          
          return {
            hasConsent: backendConsent,
            source: 'backend',
            data: data
          };
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.warn('Consent check timed out, using local fallback');
        }
        throw fetchError;
      }
    }
    
    // No consent found
    return {
      hasConsent: false,
      source: 'none',
      data: null
    };
  } catch (error) {
    console.error('Error checking consent status:', error);
    return {
      hasConsent: false,
      source: 'error',
      data: null
    };
  }
};

export function ConsentProvider({ children }) {
  const [consentState, setConsentState] = useState({
    loading: true,
    userId: null,
    consentStatus: null,
    consentUpdatedAt: null,
    consentDetails: null,
    showBanner: true,
    consentChecked: false,
  });
  const [isHydrated, setIsHydrated] = useState(false);

  // Ensure we're hydrated before running consent logic
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    // Only run after hydration is complete
    if (!isHydrated) return;
    
    // Get consent data from cookies
    const initializeConsent = async () => {
      try {
        // If running on localhost, automatically set consent
        // DISABLED: Allow banner to show for testing
        if (false && isLocalhost()) {
          const userId = getOrCreateUserId();
          const autoConsentData = {
            userId,
            consentStatus: true,
            consentUpdatedAt: new Date().toISOString(),
            consentDetails: {
              userId,
              status: true,
              timestamp: new Date().toISOString(),
              autoEnabled: true
            }
          };

          // Update cookies with auto-consent
          await updateUserConsent(true, { userId });

          startTransition(() => {
            setConsentState({
              loading: false,
              userId: autoConsentData.userId,
              consentStatus: true,
              consentUpdatedAt: autoConsentData.consentUpdatedAt,
              consentDetails: autoConsentData.consentDetails,
              showBanner: false,
              consentChecked: true
            });
          });

          return;
        }

        // Normal flow for non-localhost (or when auto-consent is disabled)
        const userId = getOrCreateUserId();
        
        // Enhanced consent checking
        const consentCheck = await checkConsentStatus(userId);
        
        if (consentCheck.hasConsent) {
          // User has already given consent
          startTransition(() => {
            setConsentState({
              loading: false,
              userId: userId,
              consentStatus: true,
              consentUpdatedAt: consentCheck.data?.consentUpdatedAt || new Date().toISOString(),
              consentDetails: consentCheck.data?.consentDetails || consentCheck.data,
              showBanner: false,
              consentChecked: true
            });
          });
        } else if (consentCheck.source === 'none') {
          // No consent found, show banner
          startTransition(() => {
            setConsentState({
              loading: false,
              userId: userId,
              consentStatus: null,
              consentUpdatedAt: null,
              consentDetails: null,
              showBanner: true,
              consentChecked: true
            });
          });
        } else {
          // Fallback to original logic
          const consentData = await getUserConsent();
          
          if (!consentData || consentData.consentStatus === null) {
            startTransition(() => {
              setConsentState({
                loading: false,
                userId: userId,
                consentStatus: null,
                consentUpdatedAt: null,
                consentDetails: null,
                showBanner: true,
                consentChecked: true
              });
            });
          } else {
            startTransition(() => {
              setConsentState({
                loading: false,
                userId: consentData.userId,
                consentStatus: consentData.consentStatus,
                consentUpdatedAt: consentData.consentUpdatedAt,
                consentDetails: consentData.consentDetails,
                showBanner: false,
                consentChecked: true
              });
            });
          }
        }
      } catch (error) {
        console.error('Error initializing consent:', error);
        // Generate userId even on error to prevent null state
        const userId = getOrCreateUserId();
        startTransition(() => {
          setConsentState({
            loading: false,
            userId: userId,
            consentStatus: null,
            consentUpdatedAt: null,
            consentDetails: null,
            showBanner: true,
            consentChecked: true
          });
        });
      }
    };

    initializeConsent();
  }, [isHydrated]);

  // Listen for consent reset events
  useEffect(() => {
    const handleConsentReset = () => {
      startTransition(() => {
        setConsentState(prev => ({
          ...prev,
          consentStatus: null,
          showBanner: true,
          consentChecked: true,
          loading: false
        }));
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('consentReset', handleConsentReset);
      return () => {
        window.removeEventListener('consentReset', handleConsentReset);
      };
    }
  }, []);

  const updateConsent = async (status) => {
    try {
      const userId = consentState.userId || getOrCreateUserId();
      
      const updatedConsent = await updateUserConsent(status, { userId });
      
      // If consent is being accepted, check if user data is initialized
      if (status === true) {
        try {
          const checkResponse = await fetch(`/api/consent-init/check-user/${userId}`, {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': process.env.NEXT_PUBLIC_API_KEY 
            }
          });
          
          if (checkResponse.ok) {
            const checkData = await checkResponse.json();
          }
        } catch (error) {
          console.warn('Could not check user initialization status:', error);
        }
      }
      
      startTransition(() => {
        setConsentState(prev => ({
          ...prev,
          userId: updatedConsent.userId,
          consentStatus: updatedConsent.consentStatus,
          consentUpdatedAt: updatedConsent.consentUpdatedAt,
          consentDetails: updatedConsent.consentDetails,
          showBanner: status === false ? true : false // Keep banner visible if declined
        }));
      });
      
      return true;
    } catch (error) {
      console.error('Error updating consent:', error);
      return false;
    }
  };

  const toggleBanner = (show) => {
    startTransition(() => {
      setConsentState(prev => ({
        ...prev,
        showBanner: show
      }));
    });
  };

  // New function to recheck consent status
  const recheckConsent = async () => {
    if (!consentState.userId) return;
    
    startTransition(() => {
      setConsentState(prev => ({ ...prev, loading: true }));
    });
    
    try {
      const consentCheck = await checkConsentStatus(consentState.userId);
      
      startTransition(() => {
        setConsentState(prev => ({
          ...prev,
          loading: false,
          consentStatus: consentCheck.hasConsent ? true : null,
          showBanner: !consentCheck.hasConsent,
          consentChecked: true
        }));
      });
    } catch (error) {
      console.error('Error rechecking consent:', error);
      startTransition(() => {
        setConsentState(prev => ({ ...prev, loading: false }));
      });
    }
  };

  return (
    <ConsentContext.Provider
      value={{
        ...consentState,
        updateConsent,
        toggleBanner,
        recheckConsent
      }}
    >
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent() {
  const context = useContext(ConsentContext);
  if (context === undefined) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
}