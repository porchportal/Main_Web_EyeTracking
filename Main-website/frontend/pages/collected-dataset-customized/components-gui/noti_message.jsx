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
  countdownValue
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
