import React, { useEffect, useRef, useState } from 'react';
// Remove the CSS import - it's now in _app.js

const CameraAccess = ({ isShowing, onClose, onCameraReady }) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [permissionStatus, setPermissionStatus] = useState('pending'); // 'pending', 'granted', 'denied'
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  useEffect(() => {
    if (isShowing) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [isShowing]);

  const startCamera = async () => {
    setPermissionStatus('pending');
    setErrorMessage('');
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      
      setStream(mediaStream);
      setPermissionStatus('granted');
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Wait for video to load metadata to get dimensions
        videoRef.current.onloadedmetadata = () => {
          const videoWidth = videoRef.current.videoWidth;
          const videoHeight = videoRef.current.videoHeight;
          
          // Calculate a reasonable distance estimation (this is a placeholder)
          // In a real app, you would use depth sensing or face size heuristics
          const estimatedDistance = Math.round(120 * (windowSize.width / videoWidth));
          
          onCameraReady({
            width: videoWidth,
            height: videoHeight,
            distance: estimatedDistance
          });
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setPermissionStatus('denied');
      
      if (error.name === 'NotAllowedError') {
        setErrorMessage('Camera access denied. Please enable camera permissions in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        setErrorMessage('No camera device found. Please connect a camera and try again.');
      } else {
        setErrorMessage('Failed to access camera. Error: ' + error.message);
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setPermissionStatus('pending');
  };

  const renderPermissionPending = () => (
    <div className="permission-pending">
      <div className="permission-pending-icon">📷</div>
      <h2>Waiting for Camera Permission</h2>
      <p className="permission-instructions">
        Please allow access to your camera when prompted by your browser.
        This app needs camera access to analyze eye movement data.
      </p>
      <div className="permission-tip">
        Look for a permission dialog near the top of your browser window.
        If you don't see it, check if it was blocked or click the camera icon in the address bar.
      </div>
      <button 
        onClick={startCamera}
        className="btn"
      >
        Try Again
      </button>
    </div>
  );

  if (!isShowing) {
    return null;
  }

  return (
    <div className="camera-container">
      <div className="camera-controls">
        <button onClick={onClose} className="btn">
          Close Camera
        </button>
      </div>
      
      {permissionStatus === 'pending' && renderPermissionPending()}
      
      {errorMessage && (
        <div className="camera-error">
          <p className="error-message">{errorMessage}</p>
          <button 
            onClick={startCamera}
            className="btn"
          >
            Try Again
          </button>
        </div>
      )}
      
      {permissionStatus === 'granted' && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
        />
      )}
      
      {permissionStatus === 'granted' && (
        <div className="camera-settings">
          <div className="settings-title">Camera Settings</div>
          <div className="settings-row">
            <span className="settings-label">Resolution:</span>
            <span id="resolution-value">Detecting...</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Frame Rate:</span>
            <span id="framerate-value">30 fps</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraAccess;