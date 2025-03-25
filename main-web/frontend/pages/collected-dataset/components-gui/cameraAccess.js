import React, { useEffect, useRef, useState } from 'react';
import CameraProcessor from './CameraProcessor';

const CameraAccess = ({ 
  isShowing, 
  onClose, 
  onCameraReady,
  showHeadPose = false,
  showBoundingBox = false,
  showMask = false,
  showParameters = false
}) => {
  console.log('CameraAccess component initialized');
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [permissionStatus, setPermissionStatus] = useState('pending'); // 'pending', 'granted', 'denied'
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  });
  const [metrics, setMetrics] = useState({
    resolution: 'Detecting...',
    frameRate: '30 fps',
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    faceDetected: false
  });

  // Handle window resize
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
  // At the beginning of your CameraAccess component:
  useEffect(() => {
    alert('CameraAccess component loaded');
  }, []);

  // Start/stop camera based on isShowing prop
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

  // Simplified camera start function
  const startCamera = async () => {
    setPermissionStatus('pending');
    setErrorMessage('');
    console.log('Starting camera with simplified approach...');
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log('Available cameras:', videoDevices.length);
      videoDevices.forEach((device, index) => {
        console.log(`Camera ${index+1}:`, device.label || 'Label not available (requires permission)');
      });
    } catch (enumError) {
      console.error('Error enumerating devices:', enumError);
    }
    try {
      // Simple direct approach to camera access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      });
      
      console.log('Camera stream obtained successfully');
      setStream(mediaStream);
      
      if (videoRef.current) {
        console.log('Setting video source to stream');
        videoRef.current.srcObject = mediaStream;
        
        try {
          // Explicitly attempt to play the video
          await videoRef.current.play();
          console.log('Video is now playing');
          setPermissionStatus('granted');
        } catch (playError) {
          console.error('Error playing video:', playError);
          setErrorMessage('Error playing video: ' + playError.message);
        }
        
        // Handle metadata loaded for dimensions
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          const videoWidth = videoRef.current.videoWidth;
          const videoHeight = videoRef.current.videoHeight;
          
          console.log(`Video dimensions: ${videoWidth}x${videoHeight}`);
          
          // Update metrics
          setMetrics(prev => ({
            ...prev,
            resolution: `${videoWidth}x${videoHeight}`
          }));
          
          // Call the onCameraReady callback
          if (onCameraReady) {
            onCameraReady({
              width: videoWidth,
              height: videoHeight,
              distance: Math.round(120 * (windowSize.width / videoWidth))
            });
          }
        };
        
        // Add error handler for video element
        videoRef.current.onerror = (e) => {
          console.error('Video element error:', e);
          setErrorMessage(`Video error: ${e.target.error ? e.target.error.message : 'Unknown error'}`);
        };
      } else {
        console.error('Video ref is null!');
        setErrorMessage('Video element not found. Please refresh the page.');
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setPermissionStatus('denied');
      
      if (error.name === 'NotAllowedError') {
        setErrorMessage('Camera access denied. Please enable camera permissions in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        setErrorMessage('No camera device found. Please connect a camera and try again.');
      } else if (error.name === 'NotReadableError') {
        setErrorMessage('Camera is already in use by another application. Please close other apps using the camera.');
      } else {
        setErrorMessage('Failed to access camera. Error: ' + error.message);
      }
    }
  };

  const stopCamera = () => {
    console.log('Stopping camera...');
    if (stream) {
      console.log('Stopping all tracks in stream');
      stream.getTracks().forEach(track => {
        console.log(`Stopping track: ${track.kind}`);
        track.stop();
      });
      setStream(null);
    }
    
    if (videoRef.current) {
      console.log('Clearing video source');
      videoRef.current.srcObject = null;
    }
    
    setPermissionStatus('pending');
  };

  const handleProcessedFrame = (frameData) => {
    if (frameData.metrics) {
      setMetrics(prev => ({
        ...prev,
        frameRate: `${frameData.fps} fps`,
        headPose: frameData.metrics.head_pose || prev.headPose,
        faceDetected: frameData.metrics.face_detected !== undefined 
          ? frameData.metrics.face_detected 
          : prev.faceDetected
      }));
    }
  };

  if (!isShowing) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '320px',
      height: '240px',
      background: 'black',
      border: '2px solid #0066cc',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
      zIndex: 999
    }}>
      {permissionStatus === 'pending' && (
        <div style={{
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '10px', 
          textAlign: 'center',
          backgroundColor: '#f0f8ff'
        }}>
          <div style={{
            fontSize: '48px', 
            marginBottom: '15px', 
            animation: 'pulse 2s infinite'
          }}>
            📷
          </div>
          <p style={{
            fontSize: '16px', 
            margin: '0 0 15px',
            fontWeight: 'bold',
            color: '#0066cc'
          }}>
            Waiting for camera permission...
          </p>
          <p style={{
            fontSize: '14px', 
            margin: '0 0 15px',
            color: '#444'
          }}>
            Please allow camera access when prompted by your browser
          </p>
          <button 
            onClick={startCamera}
            style={{
              padding: '8px 16px', 
              background: '#0066cc', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Try Again
          </button>
        </div>
      )}
      
      {errorMessage && (
        <div style={{
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '10px', 
          textAlign: 'center', 
          backgroundColor: '#fff0f0'
        }}>
          <p style={{
            fontSize: '14px', 
            color: 'red', 
            margin: '0 0 10px', 
            fontWeight: 'bold'
          }}>
            {errorMessage}
          </p>
          <button 
            onClick={startCamera}
            style={{
              padding: '8px 16px', 
              background: '#0066cc', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer', 
              fontWeight: 'bold'
            }}
          >
            Try Again
          </button>
        </div>
      )}
      
      {permissionStatus === 'granted' && (
        <>
          <div style={{position: 'absolute', top: '5px', right: '5px', zIndex: 12}}>
            <button 
              onClick={onClose} 
              style={{
                padding: '2px 6px', 
                background: '#cc0000', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                fontSize: '12px', 
                cursor: 'pointer'
              }}
            >
              X
            </button>
          </div>
          
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onPlay={() => console.log("Video is now playing!")}
            onError={(e) => console.error("Video element error event:", e)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              backgroundColor: 'black',
              zIndex: 1000
            }}
          >
            <p style={{color: 'white', textAlign: 'center'}}>Your browser doesn't support video.</p>
          </video>
          
          <CameraProcessor
            isShowing={permissionStatus === 'granted'}
            stream={stream}
            videoRef={videoRef}
            onProcessedFrame={handleProcessedFrame}
            showHeadPose={showHeadPose}
            showBoundingBox={showBoundingBox}
            showMask={showMask}
            showParameters={showParameters}
          />
          
          {showParameters && (
            <div style={{
              position: 'absolute', 
              bottom: '0', 
              left: '0', 
              right: '0', 
              background: 'rgba(255,255,255,0.7)', 
              padding: '5px', 
              fontSize: '10px'
            }}>
              <div style={{fontWeight: 'bold', marginBottom: '2px'}}>Camera Info</div>
              <div>Resolution: {metrics.resolution}</div>
              <div>FPS: {metrics.frameRate}</div>
              {metrics.faceDetected && (
                <div>Face: {metrics.faceDetected ? '✓' : '✗'}</div>
              )}
            </div>
          )}
          
          {/* Debug information */}
          <div style={{
            position: 'absolute', 
            bottom: '5px', 
            left: '5px', 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            color: 'white',
            padding: '3px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            zIndex: 1005
          }}>
            Stream: {stream ? 'Active' : 'None'} | Video: {videoRef.current && videoRef.current.readyState > 0 ? 'Playing' : 'Not Ready'}
          </div>
        </>
      )}
    </div>
  );
};

export default CameraAccess;