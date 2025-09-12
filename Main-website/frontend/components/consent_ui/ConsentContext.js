// frontend/components/consent_ui/ConsentContext.js
import { createContext, useContext, useState, useEffect, startTransition } from 'react';
import { getUserConsent, updateUserConsent, getOrCreateUserId } from '../../utils/consentManager';

const ConsentContext = createContext();

// Check if running on localhost
const isLocalhost = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  console.log('🔍 Checking hostname:', hostname);
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '192.168.1.156';
  console.log('🔍 Is localhost/IP:', isLocal);
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
        console.log('🚀 Initializing consent...');
        // If running on localhost, automatically set consent
        // DISABLED: Allow banner to show for testing
        if (false && isLocalhost()) {
          console.log('🏠 Running on localhost/IP - auto-enabling consent (DISABLED)');
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
        console.log('🌐 Running normal flow - banner should appear if no consent found');
        const userId = getOrCreateUserId();
        console.log('🆔 Generated/retrieved userId:', userId);
        
        // Enhanced consent checking
        const consentCheck = await checkConsentStatus(userId);
        console.log('🔍 Enhanced consent check result:', consentCheck);
        
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
          console.log('❌ No consent found - showing banner');
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
          console.log('Fallback consent data:', consentData);
          
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

  const updateConsent = async (status) => {
    try {
      const userId = consentState.userId || getOrCreateUserId();
      console.log('Updating consent with userId:', userId);
      
      const updatedConsent = await updateUserConsent(status, { userId });
      console.log('Updated consent data:', updatedConsent);
      
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
            console.log('User initialization status:', checkData);
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
          showBanner: false
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
      console.log('Recheck consent result:', consentCheck);
      
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