// frontend/components/consent_ui/ConsentContext.js
import { createContext, useContext, useState, useEffect } from 'react';
import { getUserConsent, updateUserConsent, getOrCreateUserId } from '../../utils/consentManager';

const ConsentContext = createContext();

// Check if running on localhost
const isLocalhost = () => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

export function ConsentProvider({ children }) {
  const [consentState, setConsentState] = useState({
    loading: true,
    userId: null,
    consentStatus: null,
    consentUpdatedAt: null,
    consentDetails: null,
    showBanner: true,
  });

  useEffect(() => {
    // Get consent data from cookies
    const initializeConsent = async () => {
      try {
        // If running on localhost, automatically set consent
        if (isLocalhost()) {
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

          setConsentState({
            loading: false,
            userId: autoConsentData.userId,
            consentStatus: true,
            consentUpdatedAt: autoConsentData.consentUpdatedAt,
            consentDetails: autoConsentData.consentDetails,
            showBanner: false
          });

          console.log('Auto-enabled consent for localhost:', autoConsentData);
          return;
        }

        // Normal flow for non-localhost
        const consentData = await getUserConsent();
        console.log('Initial consent data:', consentData);
        
        if (!consentData || consentData.consentStatus === null) {
          // Generate userId even if no consent is set yet
          const userId = getOrCreateUserId();
          setConsentState({
            loading: false,
            userId: userId,
            consentStatus: null,
            consentUpdatedAt: null,
            consentDetails: null,
            showBanner: true
          });
          return;
        }
        
        setConsentState({
          loading: false,
          userId: consentData.userId,
          consentStatus: consentData.consentStatus,
          consentUpdatedAt: consentData.consentUpdatedAt,
          consentDetails: consentData.consentDetails,
          showBanner: false
        });
      } catch (error) {
        console.error('Error initializing consent:', error);
        // Generate userId even on error to prevent null state
        const userId = getOrCreateUserId();
        setConsentState({
          loading: false,
          userId: userId,
          consentStatus: null,
          consentUpdatedAt: null,
          consentDetails: null,
          showBanner: true
        });
      }
    };

    initializeConsent();
  }, []);

  const updateConsent = async (status) => {
    try {
      const userId = consentState.userId || getOrCreateUserId();
      console.log('Updating consent with userId:', userId);
      
      const updatedConsent = await updateUserConsent(status, { userId });
      console.log('Updated consent data:', updatedConsent);
      
      setConsentState(prev => ({
        ...prev,
        userId: updatedConsent.userId,
        consentStatus: updatedConsent.consentStatus,
        consentUpdatedAt: updatedConsent.consentUpdatedAt,
        consentDetails: updatedConsent.consentDetails,
        showBanner: false
      }));
      
      return true;
    } catch (error) {
      console.error('Error updating consent:', error);
      return false;
    }
  };

  const toggleBanner = (show) => {
    setConsentState(prev => ({
      ...prev,
      showBanner: show
    }));
  };

  return (
    <ConsentContext.Provider
      value={{
        ...consentState,
        updateConsent,
        toggleBanner
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