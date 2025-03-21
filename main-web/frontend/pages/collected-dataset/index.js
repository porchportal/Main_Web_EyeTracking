import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import TopBar from './components-gui/topBar';
import DisplayResponse from './components-gui/displayResponse';
import CameraAccess from './components-gui/cameraAccess';

export default function CollectedDatasetPage() {
  const [showCamera, setShowCamera] = useState(false);
  const [metrics, setMetrics] = useState({
    width: '---',
    height: '---',
    distance: '---'
  });
  const previewAreaRef = useRef(null);
  const [isCompactMode, setIsCompactMode] = useState(false);

  // Check if we're in compact mode based on screen size
  useEffect(() => {
    const handleResize = () => {
      setIsCompactMode(window.innerWidth < 768);
    };
    
    // Set initial state
    if (typeof window !== 'undefined') {
      handleResize();
      window.addEventListener('resize', handleResize);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  // Update metrics when component mounts or window resizes
  useEffect(() => {
    const updateScreenSize = () => {
      if (previewAreaRef.current) {
        const width = previewAreaRef.current.offsetWidth;
        const height = previewAreaRef.current.offsetHeight;
        setMetrics(prev => ({
          ...prev,
          width,
          height
        }));
      }
    };

    // Initial calculation
    if (typeof window !== 'undefined') {
      updateScreenSize();
      window.addEventListener('resize', updateScreenSize);
    }
    
    // Clean up
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateScreenSize);
      }
    };
  }, []);

  const handleCameraAccess = () => {
    setShowCamera(true);
  };

  const handleCameraClose = () => {
    setShowCamera(false);
  };

  const handleCameraReady = (dimensions) => {
    setMetrics({
      width: dimensions.width,
      height: dimensions.height,
      distance: dimensions.distance || '---'
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <Head>
        <title>Collected Dataset - Eye Tracking App</title>
        <meta name="description" content="Collected dataset for eye tracking application" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css?family=Roboto&display=swap" rel="stylesheet" />
      </Head>

      <TopBar isCompactMode={isCompactMode} />
      
      <main className="container mx-auto px-4 py-2">
        <div className="flex flex-col space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {/* Left column buttons */}
            <div>
              <button
                className="w-full py-2 px-4 rounded-md text-sm"
                style={{ backgroundColor: 'rgba(124, 255, 218, 0.5)' }}
              >
                {isCompactMode ? 'Head pose' : 'Draw Head pose'}
              </button>
            </div>
            <div>
              <button
                className="w-full py-2 px-4 rounded-md text-sm"
                style={{ backgroundColor: 'rgba(124, 255, 218, 0.5)' }}
              >
                {isCompactMode ? '☐ Box' : 'Show Bounding Box'}
              </button>
            </div>
            <div></div>
            
            <div>
              <button
                className="w-full py-2 px-4 rounded-md text-sm"
                style={{ backgroundColor: 'rgba(124, 255, 218, 0.5)' }}
                onClick={handleCameraAccess}
              >
                {isCompactMode ? 'Preview' : 'Show Preview'}
              </button>
            </div>
            <div>
              <button
                className="w-full py-2 px-4 rounded-md text-sm"
                style={{ backgroundColor: 'rgba(124, 255, 218, 0.5)' }}
              >
                {isCompactMode ? '😷 Mask' : '😷 Show Mask'}
              </button>
            </div>
            <div>
              <button
                className="w-full py-2 px-4 rounded-md text-sm"
                style={{ backgroundColor: 'rgba(124, 255, 218, 0.5)' }}
              >
                {isCompactMode ? 'Values' : 'Parameters'}
              </button>
            </div>
          </div>
          
          <div 
            ref={previewAreaRef}
            className="border border-gray-200 rounded-lg h-80 md:h-96 flex items-center justify-center"
            style={{ 
              backgroundColor: 'rgba(124, 255, 183, 0.3)', 
              borderRadius: '7px'
            }}
          >
            <div className="text-center">
              <p className="text-gray-500">Camera preview will appear here</p>
              <button 
                onClick={handleCameraAccess}
                className="mt-4 px-4 py-2 rounded-md hover:bg-mint-green-dark"
                style={{ backgroundColor: 'rgba(124, 255, 218, 0.5)' }}
              >
                Access Camera
              </button>
            </div>
          </div>
          
          <DisplayResponse 
            width={metrics.width} 
            height={metrics.height} 
            distance={metrics.distance} 
          />
        </div>
      </main>
      
      <CameraAccess 
        isShowing={showCamera} 
        onClose={handleCameraClose}
        onCameraReady={handleCameraReady}
      />
    </div>
  );
}