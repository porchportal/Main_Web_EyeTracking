// frontend/components/consent/ConsentContext.js
import { createContext, useContext, useState, useEffect } from 'react';
import { getUserConsent, updateUserConsent } from '../../utils/consentManager';

const ConsentContext = createContext();

export function ConsentProvider({ children }) {
  const [consentState, setConsentState] = useState({
    loading: true,
    userId: null,
    consentStatus: null,
    consentUpdatedAt: null,
    showBanner: false,
  });

  useEffect(() => {
    // Get consent data from localStorage
    const initializeConsent = async () => {
      try {
        const consentData = await getUserConsent();
        
        setConsentState({
          loading: false,
          userId: consentData.userId,
          consentStatus: consentData.consentStatus,
          consentUpdatedAt: consentData.consentUpdatedAt,
          showBanner: consentData.consentStatus === null
        });
      } catch (error) {
        console.error('Error initializing consent:', error);
        setConsentState(prev => ({
          ...prev,
          loading: false,
          showBanner: true
        }));
      }
    };

    initializeConsent();
  }, []);

  const updateConsent = async (status) => {
    try {
      const updatedConsent = await updateUserConsent(consentState.userId, status);
      
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