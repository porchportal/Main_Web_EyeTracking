import React, { useState } from 'react';
import TopBar from './topBar';
import { ActionButtonGroup } from './actionButton';
import DisplayResponse from './displayResponse';
import CameraAccess from './cameraAccess';

export default function Home() {
  const [showCamera, setShowCamera] = useState(false);
  const [metrics, setMetrics] = useState({
    width: null,
    height: null,
    distance: null
  });

  const handleCameraAccess = () => {
    setShowCamera(true);
  };

  const handleCameraClose = () => {
    setShowCamera(false);
  };

  const handleCameraReady = (dimensions) => {
    setMetrics({
      ...metrics,
      width: dimensions.width,
      height: dimensions.height
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <TopBar />
      
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="md:w-1/4">
            <ActionButtonGroup triggerCameraAccess={handleCameraAccess} />
          </div>
          
          <div className="md:w-3/4 bg-mint-50 border border-mint-100 rounded-lg h-96 flex items-center justify-center">
            <p className="text-gray-500">Camera preview will appear here</p>
          </div>
        </div>
        
        <DisplayResponse 
          width={metrics.width} 
          height={metrics.height} 
          distance={metrics.distance} 
        />
      </div>
      
      <CameraAccess 
        isShowing={showCamera} 
        onClose={handleCameraClose}
        onCameraReady={handleCameraReady}
      />
    </div>
  );
}