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
    error: null,
    retryCount: 0,
    connectionStatus: 'disconnected' // 'connected', 'disconnected', 'checking', 'error'
  });
  const [checkTimer, setCheckTimer] = useState(null);

  // Function to check backend connection with timeout - memoized to prevent recreation
  const checkConnection = useCallback(async (force = false) => {
    // Prevent frequent checks unless forced
    if (connectionState.isChecking || 
        (!force && 
         connectionState.lastChecked && 
         Date.now() - connectionState.lastChecked < 5000)) { // Reduced to 5 seconds for better responsiveness
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
      error: null,
      connectionStatus: 'checking'
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
        // Handle specific error codes with more graceful degradation
        if (response.status === 503) {
          // Service temporarily unavailable - don't treat as critical error
          setConnectionState(prev => ({
            ...prev,
            isConnected: false,
            authValid: false,
            isChecking: false,
            lastChecked: Date.now(),
            error: 'Backend service temporarily unavailable. Some features may be limited.'
          }));
          return; // Don't throw error, just update state
        } else if (response.status === 404) {
          throw new Error('Backend endpoint not found (404). Please check service configuration.');
        } else if (response.status === 502) {
          throw new Error('Bad Gateway (502). Backend service may be starting up.');
        } else if (response.status === 504) {
          throw new Error('Gateway Timeout (504). Backend service is not responding.');
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
        error: null,
        retryCount: 0, // Reset retry count on successful connection
        connectionStatus: data.connected ? 'connected' : 'disconnected'
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
          error: 'Connection timeout. Please check if the backend service is running.',
          connectionStatus: 'error'
        }));
      } else {
        console.error("Backend connection check failed:", err);
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          authValid: false,
          isChecking: false,
          lastChecked: Date.now(),
          error: err.message || "Failed to connect to backend",
          connectionStatus: 'error'
        }));
      }
    }
  }, [connectionState.isChecking, connectionState.lastChecked]);

  // Initial connection check on mount and set up periodic checks
  useEffect(() => {
    // Check if this is a page refresh
    const isPageRefresh = performance.navigation && performance.navigation.type === 1;
    
    // Check immediately on first load, with slight delay for page refresh
    if (isPageRefresh) {
      // Small delay for page refresh to allow services to stabilize
      setTimeout(() => checkConnection(true), 1000);
    } else {
      checkConnection(true);
    }
    
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

  // Auto-reconnect when disconnected with exponential backoff
  useEffect(() => {
    if (!connectionState.isConnected && !connectionState.isChecking && !checkTimer) {
      // Use exponential backoff: 2s, 4s, 8s, 16s, max 30s
      const retryCount = connectionState.retryCount || 0;
      const delay = Math.min(2000 * Math.pow(2, retryCount), 30000);
      
      const timer = setTimeout(() => {
        checkConnection(true);
        setCheckTimer(null);
        // Increment retry count for exponential backoff
        setConnectionState(prev => ({
          ...prev,
          retryCount: (prev.retryCount || 0) + 1
        }));
      }, delay);
      
      setCheckTimer(timer);
      return () => clearTimeout(timer);
    }
  }, [connectionState.isConnected, connectionState.isChecking, connectionState.retryCount]);

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