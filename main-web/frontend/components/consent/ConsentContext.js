// frontend/components/consent/ConsentContext.js
import { createContext, useContext, useState, useEffect } from 'react';
import { getUserConsent, updateUserConsent, getOrCreateUserId } from '../../utils/consentManager';

const ConsentContext = createContext();

export function ConsentProvider({ children }) {
  const [consentState, setConsentState] = useState({
    loading: true,
    userId: null,
    consentStatus: null,
    consentUpdatedAt: null,
    consentDetails: null,
    showBanner: false,
  });

  useEffect(() => {
    // Get consent data from localStorage
    const initializeConsent = async () => {
      try {
        const consentData = await getUserConsent();
        
        // If no consent data exists or consentStatus is null, show the banner
        if (consentData.consentStatus === null) {
          setConsentState({
            loading: false,
            userId: null,
            consentStatus: null,
            consentUpdatedAt: null,
            consentDetails: null,
            showBanner: true
          });
          return;
        }
        
        // Try to get detailed consent preferences if available
        let consentDetails = null;
        try {
          const detailsStr = localStorage.getItem('consent_details');
          if (detailsStr) {
            consentDetails = JSON.parse(detailsStr);
          }
        } catch (e) {
          console.error('Error parsing consent details:', e);
        }
        
        setConsentState({
          loading: false,
          userId: consentData.userId,
          consentStatus: consentData.consentStatus,
          consentUpdatedAt: consentData.consentUpdatedAt,
          consentDetails,
          showBanner: false
        });
      } catch (error) {
        console.error('Error initializing consent:', error);
        // If there's an error, show the banner
        setConsentState({
          loading: false,
          userId: null,
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
      const updatedConsent = await updateUserConsent(status);
      
      setConsentState(prev => ({
        ...prev,
        consentStatus: updatedConsent.consentStatus,
        consentUpdatedAt: updatedConsent.consentUpdatedAt,
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