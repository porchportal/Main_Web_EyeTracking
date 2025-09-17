import { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';

// Create a context for the process status
const ProcessStatusContext = createContext();

// Create a context for the backend connection status
const BackendConnectionContext = createContext();

// Time constants (in milliseconds) - optimized for better performance
const CONNECTION_CHECK_INTERVAL = 60000; // 60 seconds (reduced frequency)
const CONNECTION_CHECK_TIMEOUT = 3000;   // 3 seconds (faster timeout)

// Create a provider component for process status
export function ProcessStatusProvider({ children }) {
  // This state will determine if the process is ready (true) or not (false)
  const [isProcessReady, setIsProcessReady] = useState(false);
  // Add a flag to prevent automatic updates
  const [isInitialized, setIsInitialized] = useState(false);

  // Function to toggle the state - memoized to prevent recreation
  const toggleProcessStatus = useCallback(() => {
    const newStatus = !isProcessReady;
    setIsProcessReady(newStatus);
    // Save to localStorage when explicitly toggled
    localStorage.setItem('processStatus', String(newStatus));
  }, [isProcessReady]);
  
  // Function to set the status directly - memoized to prevent recreation
  const setProcessStatus = useCallback((status) => {
    setIsProcessReady(status);
    // Save to localStorage when explicitly set
    localStorage.setItem('processStatus', String(status));
  }, []);

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

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    isProcessReady,
    toggleProcessStatus,
    setProcessStatus
  }), [isProcessReady, toggleProcessStatus, setProcessStatus]);

  return (
    <ProcessStatusContext.Provider value={contextValue}>
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

  // Function to check backend connection with timeout - memoized to prevent recreation
  const checkConnection = useCallback(async (force = false) => {
    // Prevent frequent checks unless forced
    if (connectionState.isChecking || 
        (!force && 
         connectionState.lastChecked && 
         Date.now() - connectionState.lastChecked < 10000)) { // Increased to 10 seconds
      return;
    }

    // Skip backend checks if disabled (e.g., after data clearing)
    if (typeof window !== 'undefined' && window.disableBackendChecks) {
      console.log('🔧 Backend checks disabled - skipping connection check');
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        authValid: false,
        isChecking: false,
        error: 'Backend checks temporarily disabled'
      }));
      return;
    }

    // Update checking state
    setConnectionState(prev => ({
      ...prev,
      isChecking: true,
      error: null
    }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONNECTION_CHECK_TIMEOUT);
      
      const response = await fetch('/api/check-backend-connection', {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 503) {
          throw new Error('Backend service unavailable (503). Please check if all services are running.');
        } else if (response.status === 404) {
          throw new Error('Backend endpoint not found (404). Please check service configuration.');
        } else {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
      }
      
      const data = await response.json();
      
      setConnectionState({
        isConnected: data.connected,
        authValid: data.authValid || false,
        isChecking: false,
        lastChecked: Date.now(),
        serverInfo: data.serverInfo || {},
        error: null
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        // Backend connection check timed out
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          authValid: false,
          isChecking: false,
          lastChecked: Date.now(),
          error: 'Connection timeout. Please check if the backend service is running.'
        }));
      } else {
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
    }
  }, [connectionState.isChecking, connectionState.lastChecked]);

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

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    ...connectionState,
    checkConnection
  }), [connectionState, checkConnection]);

  return (
    <BackendConnectionContext.Provider value={contextValue}>
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