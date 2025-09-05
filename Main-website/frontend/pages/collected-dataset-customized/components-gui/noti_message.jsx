import React from 'react';

const NotificationMessage = ({
  isHydrated,
  backendStatus,
  showTopBar,
  showWarning,
  warningMessage,
  showCameraNotification,
  cameraNotificationMessage,
  showCountdown,
  countdownValue,
  showCanvasNotification,
  canvasNotificationMessage
}) => {
  return (
    <>
      {/* Backend connection status banner */}
      {isHydrated && backendStatus === 'disconnected' && (
        <div className="backend-connection-banner">
          ⚠️ Backend disconnected. Hurry up, Make ONLINE please and Using mock mode
        </div>
      )}
      
      {/* Warning message banner */}
      {isHydrated && showWarning && (
        <div 
          className="warning-banner" 
          style={{
            top: showTopBar ? (backendStatus === 'disconnected' ? '32px' : '60px') : '0'
          }}
        >
          <strong>⚠️ {warningMessage}</strong>
        </div>
      )}

      {/* Camera activation notification */}
      {isHydrated && showCameraNotification && (
        <div 
          className="camera-notification-banner" 
          style={{
            top: showTopBar ? (backendStatus === 'disconnected' ? '60px' : '90px') : '30px'
          }}
        >
          <strong>📷 {cameraNotificationMessage}</strong>
        </div>
      )}

      {/* Canvas notification - positioned below displayResponse on top right */}
      {isHydrated && showCanvasNotification && (
        <div 
          className="canvas-notification-banner" 
          style={{
            position: 'fixed',
            right: '20px',
            top: '240px', // Position below displayResponse (which is at 140px + ~100px height)
            backgroundColor: 'rgba(0, 102, 204, 0.8)',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'monospace',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s ease',
            opacity: 1,
            transform: 'translateX(0)',
            pointerEvents: 'auto',
            zIndex: 25,
            display: 'block',
            width: '240px',
            animation: 'slideInFromRight 0.3s ease-out'
          }}
        >
          <div 
            className="notification-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
              paddingBottom: '5px'
            }}
          >
            <span style={{ fontWeight: 'bold' }}>Canvas Notification</span>
            <div 
              className="notification-indicator"
              style={{ 
                width: '10px', 
                height: '10px', 
                borderRadius: '50%', 
                backgroundColor: '#00ff00',
                boxShadow: '0 0 5px rgba(0, 255, 0, 0.8)'
              }} 
            />
          </div>
          
          <div 
            className="notification-content"
            style={{ lineHeight: '1.5' }}
          >
            <p>
              <span style={{ display: 'inline-block', width: '60px' }}>Status:</span> 
              <span style={{ fontWeight: 'bold' }}>
                {canvasNotificationMessage.includes('default background') || canvasNotificationMessage.includes('Default background') ? (
                  <span style={{ color: '#ffc107', textShadow: '0 0 5px rgba(255, 193, 7, 0.8)' }}>
                    Default Background
                  </span>
                ) : (
                  canvasNotificationMessage
                )}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Camera activation countdown */}
      {isHydrated && showCountdown && (
        <div className="camera-countdown-overlay">
          <div className="countdown-container">
            <div className="countdown-icon">
              📷
            </div>
            <div className="countdown-number">
              {countdownValue}
            </div>
            <div className="countdown-message">
              Activating...
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationMessage;
