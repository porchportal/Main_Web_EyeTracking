import React, { useState, useEffect } from 'react';

const DisplayResponse = ({ width, height, distance, isVisible = true }) => {
  // Animation state for visibility transitions
  const [animationState, setAnimationState] = useState(isVisible ? 'visible' : 'hidden');
  
  // State for canvas dimensions
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  
  // Update animation state when visibility changes
  useEffect(() => {
    setAnimationState(isVisible ? 'visible' : 'hidden');
  }, [isVisible]);
  
  // Function to get canvas dimensions
  const getCanvasDimensions = () => {
    if (typeof window !== 'undefined') {
      // Try to get the main canvas first
      const mainCanvas = document.querySelector('#main-canvas');
      if (mainCanvas) {
        const width = mainCanvas.width;
        const height = mainCanvas.height;
        
        // Only return dimensions if they're not the default 300x150
        if (width > 300 && height > 150) {
          return { width, height };
        }
        
        // If canvas has default dimensions, try offsetWidth/offsetHeight
        const offsetWidth = mainCanvas.offsetWidth;
        const offsetHeight = mainCanvas.offsetHeight;
        
        if (offsetWidth > 300 && offsetHeight > 150) {
          return { width: offsetWidth, height: offsetHeight };
        }
        
        // If still default dimensions, return 0
        return { width: 0, height: 0 };
      }
      
      // Fallback to tracking canvas
      const canvas = document.querySelector('#tracking-canvas');
      if (canvas) {
        const width = canvas.width;
        const height = canvas.height;
        
        // Only return dimensions if they're not the default 300x150
        if (width > 300 && height > 150) {
          return { width, height };
        }
        
        // If canvas has default dimensions, try offsetWidth/offsetHeight
        const offsetWidth = canvas.offsetWidth;
        const offsetHeight = canvas.offsetHeight;
        
        if (offsetWidth > 300 && offsetHeight > 150) {
          return { width: offsetWidth, height: offsetHeight };
        }
        
        // If still default dimensions, return 0
        return { width: 0, height: 0 };
      }
    }
    return { width: 0, height: 0 };
  };
  
  // Update canvas dimensions periodically
  useEffect(() => {
    const updateCanvasDimensions = () => {
      const dimensions = getCanvasDimensions();
      setCanvasDimensions(dimensions);
    };
    
    // Update immediately
    updateCanvasDimensions();
    
    // Update on window resize
    const handleResize = () => {
      updateCanvasDimensions();
    };
    
    window.addEventListener('resize', handleResize);
    
    // Update periodically to catch any canvas size changes
    const interval = setInterval(updateCanvasDimensions, 1000);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
    };
  }, []);
  
  // Format values with units and handle missing values
  // Only show actual canvas dimensions, not fallback values or default 300x150
  const formattedWidth = (canvasDimensions.width > 0 && canvasDimensions.width !== 300) ? canvasDimensions.width : (width > 0 && width !== 300 ? width : 0);
  const formattedHeight = (canvasDimensions.height > 0 && canvasDimensions.height !== 150) ? canvasDimensions.height : (height > 0 && height !== 150 ? height : 0);
  const formattedDistance = distance || '---';
  
  return (
    <div 
      className={`metrics-display ${animationState}`}
      style={{
        position: 'fixed',
        right: '20px',
        top: '140px',
        backgroundColor: 'rgba(0, 102, 204, 0.8)',
        color: 'white',
        padding: '10px 15px',
        borderRadius: '8px',
        fontSize: '14px',
        fontFamily: 'monospace',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.3s ease',
        opacity: animationState === 'visible' ? 1 : 0,
        transform: animationState === 'visible' 
          ? 'translateX(0)' 
          : 'translateX(50px)',
        pointerEvents: animationState === 'visible' ? 'auto' : 'none',
        zIndex: 20,
        display: animationState === 'hidden' ? 'none' : 'block',
        width: '240px',
        border: 'none',
        outline: 'none'
      }}
    >
      <div 
        className="metrics-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
          paddingBottom: '5px'
        }}
      >
        <span style={{ fontWeight: 'bold' }}>Canvas Metrics</span>
        <div 
          className="metrics-indicator"
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
        className="metrics-content"
        style={{ lineHeight: '1.5' }}
      >
        <p>
          <span style={{ display: 'inline-block', width: '80px' }}>Width:</span> 
          <span style={{ fontWeight: 'bold' }}>{formattedWidth}</span> 
          <span style={{ opacity: 0.8, fontSize: '12px' }}> pixels</span>
        </p>
        <p>
          <span style={{ display: 'inline-block', width: '80px' }}>Height:</span> 
          <span style={{ fontWeight: 'bold' }}>{formattedHeight}</span> 
          <span style={{ opacity: 0.8, fontSize: '12px' }}> pixels</span>
        </p>
        <p>
          <span style={{ display: 'inline-block', width: '80px' }}>Distance:</span> 
          <span style={{ fontWeight: 'bold' }}>{formattedDistance}</span> 
          <span style={{ opacity: 0.8, fontSize: '12px' }}> cm</span>
        </p>
      </div>
    </div>
  );
};

export default DisplayResponse;
