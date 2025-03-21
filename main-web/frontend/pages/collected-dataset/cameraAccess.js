import React, { useRef, useState, useEffect } from 'react';

const CameraAccess = ({ isShowing, onClose, onCameraReady }) => {
  const videoRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);
  const [constraints, setConstraints] = useState({
    video: { 
      width: { ideal: 1920 }, 
      height: { ideal: 1080 },
      facingMode: "user" 
    }
  });

  useEffect(() => {
    if (!isShowing) {
      stopCamera();
    }
  }, [isShowing]);

  const requestCameraAccess = async () => {
    setShowPrompt(false);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasPermission(true);
        
        // Get video track settings to provide dimensions
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        
        onCameraReady({
          width: settings.width,
          height: settings.height
        });
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setHasPermission(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  if (!isShowing) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full">
        {showPrompt ? (
          <div className="text-center">
            <h3 className="text-lg font-medium mb-4">Camera Access Required</h3>
            <p className="mb-6">This application needs access to your camera to function properly.</p>
            <div className="flex justify-center space-x-4">
              <button 
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
              >
                Deny
              </button>
              <button 
                onClick={requestCameraAccess}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Agree
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 relative">
              {hasPermission ? (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline
                  className="w-full rounded"
                />
              ) : (
                <div className="bg-gray-100 h-64 rounded flex items-center justify-center">
                  <p className="text-red-500">Camera access denied or unavailable</p>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CameraAccess;