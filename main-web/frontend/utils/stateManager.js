import { createContext, useState, useContext, useEffect } from 'react';

// Create a context for the process status
const ProcessStatusContext = createContext();

// Create a context for the backend connection status
const BackendConnectionContext = createContext();

// Time constants (in milliseconds)
const CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds
const CONNECTION_CHECK_TIMEOUT = 5000;   // 5 seconds

// Create a provider component for process status
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

// Create a provider component for backend connection
export function BackendConnectionProvider({ children }) {
  const [connectionState, setConnectionState] = useState({
    isConnected: false,
    authValid: false,
    isChecking: false,
    lastChecked: null,
    serverInfo: {},
    error: null
  });
  const [checkTimer, setCheckTimer] = useState(null);

  // Function to check backend connection
  const checkConnection = async (force = false) => {
    // Prevent frequent checks unless forced
    if (connectionState.isChecking || 
        (!force && 
         connectionState.lastChecked && 
         Date.now() - connectionState.lastChecked < 5000)) {
      return;
    }

    // Update checking state
    setConnectionState(prev => ({
      ...prev,
      isChecking: true,
      error: null
    }));

    try {
      console.log("Checking backend connection...");
      const response = await fetch('/api/check-backend-connection');
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Backend connection response:", data);
      
      setConnectionState({
        isConnected: data.connected,
        authValid: data.authValid || false,
        isChecking: false,
        lastChecked: Date.now(),
        serverInfo: data.serverInfo || {},
        error: null
      });
    } catch (err) {
      console.error("Backend connection check failed:", err);
      
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        authValid: false,
        isChecking: false,
        lastChecked: Date.now(),
        error: err.message || "Failed to connect to backend"
      }));
    }
  };

  // Initial connection check on mount and set up periodic checks
  useEffect(() => {
    // Check immediately on first load
    checkConnection(true);
    
    // Set up periodic checks
    const intervalId = setInterval(() => {
      checkConnection();
    }, CONNECTION_CHECK_INTERVAL);
    
    // Clean up on unmount
    return () => {
      clearInterval(intervalId);
      if (checkTimer) clearTimeout(checkTimer);
    };
  }, []);

  // Auto-reconnect when disconnected
  useEffect(() => {
    if (!connectionState.isConnected && !connectionState.isChecking && !checkTimer) {
      // Wait 5 seconds before retrying
      const timer = setTimeout(() => {
        checkConnection(true);
        setCheckTimer(null);
      }, 5000);
      
      setCheckTimer(timer);
      return () => clearTimeout(timer);
    }
  }, [connectionState.isConnected, connectionState.isChecking]);

  // Check connection when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 
          (!connectionState.lastChecked || 
           Date.now() - connectionState.lastChecked > CONNECTION_CHECK_INTERVAL)) {
        checkConnection();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connectionState.lastChecked]);

  return (
    <BackendConnectionContext.Provider
      value={{
        ...connectionState,
        checkConnection
      }}
    >
      {children}
    </BackendConnectionContext.Provider>
  );
}

// Combined provider for convenience
export function AppStateProvider({ children }) {
  return (
    <ProcessStatusProvider>
      <BackendConnectionProvider>
        {children}
      </BackendConnectionProvider>
    </ProcessStatusProvider>
  );
}

// Create custom hooks to use the contexts
export function useProcessStatus() {
  const context = useContext(ProcessStatusContext);
  if (context === undefined) {
    throw new Error('useProcessStatus must be used within a ProcessStatusProvider');
  }
  return context;
}

export function useBackendConnection() {
  const context = useContext(BackendConnectionContext);
  if (context === undefined) {
    throw new Error('useBackendConnection must be used within a BackendConnectionProvider');
  }
  return context;
}