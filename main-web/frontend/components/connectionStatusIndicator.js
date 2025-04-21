// components/ConnectionStatusIndicator.js
import { useState, useEffect } from 'react';
import { useBackendConnection } from '../utils/stateManager';
import styles from '../styles/ConnectionIndicator.module.css';

export default function ConnectionStatusIndicator() {
  const { 
    isConnected, 
    authValid, 
    isChecking, 
    error, 
    checkConnection,
    serverInfo
  } = useBackendConnection();
  
  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Database connection status
  const dbConnected = serverInfo?.database?.connected === true;
  
  // Auto-hide the status after successful connection
  useEffect(() => {
    let timeoutId;
    
    // Only auto-hide if everything is working properly
    if (isConnected && authValid && !error && 
       (dbConnected || !serverInfo?.database)) { // Don't hide if db is disconnected
      // Start hiding after 5 seconds of successful connection
      timeoutId = setTimeout(() => {
        setVisible(false);
      }, 5000);
    } else {
      // Keep visible if there are issues
      setVisible(true);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isConnected, authValid, error, dbConnected, serverInfo]);

  // Get status message and color based on connection state
  const getStatusInfo = () => {
    if (isChecking) {
      return { 
        message: "Checking backend connection...",
        color: "#3b82f6" // blue
      };
    }
    
    if (!isConnected) {
      return { 
        message: "Backend not connected", 
        color: "#ef4444" // red
      };
    }
    
    if (!authValid) {
      return { 
        message: "Connected, but authentication failed", 
        color: "#f59e0b" // amber
      };
    }
    
    if (serverInfo?.database && !dbConnected) {
      return {
        message: "Backend connected, but database is disconnected",
        color: "#f59e0b" // amber
      };
    }
    
    return { 
      message: "Backend connected", 
      color: "#10b981" // green
    };
  };

  const { message, color } = getStatusInfo();

  // If not visible, show a minimal indicator that expands on hover
  if (!visible && !expanded) {
    return (
      <div 
        className={styles.minimizedIndicator} 
        style={{ backgroundColor: color }}
        onMouseEnter={() => setExpanded(true)}
        onClick={() => setExpanded(true)}
      />
    );
  }

  return (
    <div 
      className={styles.container}
      onMouseLeave={() => {
        if (isConnected && authValid && !error && 
           (dbConnected || !serverInfo?.database)) {
          setExpanded(false);
        }
      }}
    >
      <div className={styles.statusBar}>
        <div className={styles.indicator} style={{ backgroundColor: color }}></div>
        <div className={styles.message}>{message}</div>
        
        <div className={styles.actions}>
          <button 
            className={styles.actionButton}
            onClick={() => checkConnection(true)}
            disabled={isChecking}
          >
            {isChecking ? "Checking..." : "Check Now"}
          </button>
          
          <button 
            className={styles.actionButton}
            onClick={() => {
              if (isConnected && authValid && !error) {
                setVisible(false);
                setExpanded(false);
              }
            }}
            disabled={!isConnected || !authValid || !!error || 
                     (serverInfo?.database && !dbConnected)}
          >
            Dismiss
          </button>
        </div>
      </div>
      
      {error && (
        <div className={styles.errorMessage}>
          Error: {error}
        </div>
      )}
      
      {isConnected && serverInfo && (
        <div className={styles.detailsPanel}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>API Version:</span>
            <span className={styles.detailValue}>{serverInfo.version || 'Unknown'}</span>
          </div>
          
          {serverInfo.database && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Database:</span>
              <span className={styles.detailValue} style={{ 
                color: dbConnected ? '#10b981' : '#ef4444' 
              }}>
                {dbConnected ? 'Connected' : 'Disconnected'}
                {serverInfo.database.status && serverInfo.database.status !== 'ok' && 
                 !dbConnected && ` (${serverInfo.database.status})`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}