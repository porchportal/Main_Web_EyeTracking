import React, { useState, useEffect } from 'react';

const DisplayResponse = ({ width, height, distance, isVisible = true }) => {
  // Animation state for visibility transitions
  const [animationState, setAnimationState] = useState(isVisible ? 'visible' : 'hidden');
  
  // Update animation state when visibility changes
  useEffect(() => {
    console.log('🔍 DisplayResponse: isVisible changed to', isVisible);
    setAnimationState(isVisible ? 'visible' : 'hidden');
  }, [isVisible]);
  
  // Format values with units and handle missing values
  const formattedWidth = width || '---';
  const formattedHeight = height || '---';
  const formattedDistance = distance || '---';
  
  console.log('🔍 DisplayResponse: rendering with isVisible:', isVisible, 'animationState:', animationState);
  
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
        display: animationState === 'hidden' ? 'none' : 'block'
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
        <span style={{ fontWeight: 'bold' }}>Display Metrics</span>
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