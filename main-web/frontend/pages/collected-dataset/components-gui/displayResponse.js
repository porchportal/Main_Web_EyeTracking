import React, { useState, useEffect } from 'react';

const DisplayResponse = ({ width, height, distance }) => {
  const [screenSize, setScreenSize] = useState({
    width: width || '---',
    height: height || '---'
  });
  
  // Listen for window resize to update screen dimensions
  useEffect(() => {
    const updateSize = () => {
      // Only update if we're showing screen dimensions
      // rather than camera dimensions
      if (width === '---') {
        setScreenSize({
          width: window.innerWidth,
          height: window.innerHeight
        });
      } else {
        // If we have camera dimensions, use those instead
        setScreenSize({
          width: width,
          height: height
        });
      }
    };

    // Call once immediately
    updateSize();
    
    // Set up listener for window resize
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateSize);
    }
    
    // Clean up
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateSize);
      }
    };
  }, [width, height]);

  // Update values if props change
  useEffect(() => {
    if (width !== '---') {
      setScreenSize({
        width: width,
        height: height
      });
    }
  }, [width, height]);

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-3"
      style={{ 
        borderRadius: '7px',
        position: 'absolute',
        right: '10px',
        top: '10px',
        padding: '10px',
        backgroundColor: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
    >
      <div className="text-sm text-center font-roboto">
        <p>W: {screenSize.width} (pixels) H: {screenSize.height} (pixels)</p>
        <p>Distance: {distance || '---'} (cm)</p>
      </div>
    </div>
  );
};

export default DisplayResponse;