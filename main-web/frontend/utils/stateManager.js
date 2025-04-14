import { createContext, useState, useContext, useEffect } from 'react';

// Create a context for the process status
const ProcessStatusContext = createContext();

// Create a provider component
export function ProcessStatusProvider({ children }) {
  // This state will determine if the process is ready (true) or not (false)
  const [isProcessReady, setIsProcessReady] = useState(false);
  // Add a flag to prevent automatic updates
  const [isInitialized, setIsInitialized] = useState(false);

  // Function to toggle the state
  const toggleProcessStatus = () => {
    const newStatus = !isProcessReady;
    setIsProcessReady(newStatus);
    // Save to localStorage when explicitly toggled
    localStorage.setItem('processStatus', String(newStatus));
  };
  
  // Function to set the status directly
  const setProcessStatus = (status) => {
    setIsProcessReady(status);
    // Save to localStorage when explicitly set
    localStorage.setItem('processStatus', String(status));
  };

  // Only load from localStorage on initial mount, don't auto-save on every render
  useEffect(() => {
    // Only run this once on component mount
    if (!isInitialized) {
      const storedValue = localStorage.getItem('processStatus');
      if (storedValue !== null) {
        setIsProcessReady(storedValue === 'true');
      }
      setIsInitialized(true);
    }
  }, [isInitialized]);

  return (
    <ProcessStatusContext.Provider value={{ isProcessReady, toggleProcessStatus, setProcessStatus }}>
      {children}
    </ProcessStatusContext.Provider>
  );
}

// Create a custom hook to use the context
export function useProcessStatus() {
  const context = useContext(ProcessStatusContext);
  if (context === undefined) {
    throw new Error('useProcessStatus must be used within a ProcessStatusProvider');
  }
  return context;
}