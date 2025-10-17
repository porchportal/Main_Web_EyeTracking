import React, { useState, useEffect, useMemo } from 'react';

const DisplayResponse = ({
  width,
  height,
  distance,
  isVisible = true,
  isTopBarShown = true,
  isCanvasVisible = true,
  outputText = '',
  isCameraActivated = false,
  isCameraActive = false
}) => {
  // Animation state for visibility transitions
  const [animationState, setAnimationState] = useState(isVisible ? 'visible' : 'hidden');

  // State for canvas dimensions
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  // State for window size to enable responsive design
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

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

  // Update canvas dimensions and window size
  useEffect(() => {
    const updateDimensions = () => {
      const canvasDims = getCanvasDimensions();
      setCanvasDimensions(canvasDims);

      // Update window size
      if (typeof window !== 'undefined') {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight
        });
      }
    };

    // Update immediately
    updateDimensions();

    // Debounce resize handler
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateDimensions, 150);
    };

    window.addEventListener('resize', handleResize);

    // Update periodically to catch any canvas size changes
    const interval = setInterval(updateDimensions, 1000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
      clearTimeout(resizeTimeout);
    };
  }, []);

  // Calculate responsive styles based on window size
  const responsiveStyles = useMemo(() => {
    const screenWidth = windowSize.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
    const screenHeight = windowSize.height || (typeof window !== 'undefined' ? window.innerHeight : 1080);

    // Define breakpoints
    let scale = 1;
    let containerWidth = 240;
    let baseFontSize = 14;
    let padding = '10px 15px';
    let rightOffset = 20;
    let topOffset = 140;

    // Mobile portrait (< 480px)
    if (screenWidth < 480) {
      scale = 0.7;
      containerWidth = 180;
      baseFontSize = 11;
      padding = '6px 10px';
      rightOffset = 10;
      topOffset = 100;
    }
    // Mobile landscape / Small tablets (480px - 768px)
    else if (screenWidth < 768) {
      scale = 0.8;
      containerWidth = 200;
      baseFontSize = 12;
      padding = '8px 12px';
      rightOffset = 15;
      topOffset = 120;
    }
    // Tablets (768px - 1024px)
    else if (screenWidth < 1024) {
      scale = 0.9;
      containerWidth = 220;
      baseFontSize = 13;
      padding = '9px 13px';
      rightOffset = 18;
      topOffset = 130;
    }
    // Small desktops (1024px - 1366px)
    else if (screenWidth < 1366) {
      scale = 1;
      containerWidth = 240;
      baseFontSize = 14;
      padding = '10px 15px';
      rightOffset = 20;
      topOffset = 140;
    }
    // Large desktops (1366px - 1920px)
    else if (screenWidth < 1920) {
      scale = 1.1;
      containerWidth = 260;
      baseFontSize = 15;
      padding = '11px 16px';
      rightOffset = 22;
      topOffset = 145;
    }
    // Extra large screens (>= 1920px)
    else {
      scale = 1.2;
      containerWidth = 280;
      baseFontSize = 16;
      padding = '12px 18px';
      rightOffset = 25;
      topOffset = 150;
    }

    // Adjust for very small heights
    if (screenHeight < 600) {
      topOffset = Math.min(topOffset, 80);
      scale *= 0.9;
    }

    return {
      scale,
      containerWidth: `${containerWidth}px`,
      baseFontSize: `${baseFontSize}px`,
      smallFontSize: `${baseFontSize - 2}px`,
      tinyFontSize: `${baseFontSize - 3}px`,
      padding,
      rightOffset: `${rightOffset}px`,
      topOffset: `${topOffset}px`,
      borderRadius: `${Math.round(8 * scale)}px`,
      labelWidth: `${Math.round(80 * scale)}px`,
      indicatorSize: `${Math.round(10 * scale)}px`
    };
  }, [windowSize]);

  // Format values with units and handle missing values
  // Only show actual canvas dimensions, not fallback values or default 300x150
  const formattedWidth = (canvasDimensions.width > 0 && canvasDimensions.width !== 300) ? canvasDimensions.width : (width > 0 && width !== 300 ? width : 0);
  const formattedHeight = (canvasDimensions.height > 0 && canvasDimensions.height !== 150) ? canvasDimensions.height : (height > 0 && height !== 150 ? height : 0);
  const formattedDistance = distance || '---';

  // Status message for processing output
  const statusMessage = `TopBar ${isTopBarShown ? 'shown' : 'hidden'}, Canvas: ${isCanvasVisible ? 'Visible' : 'Hidden'}`;

  return (
    <div
      className={`metrics-display ${animationState}`}
      style={{
        position: 'fixed',
        right: responsiveStyles.rightOffset,
        top: responsiveStyles.topOffset,
        backgroundColor: 'rgba(0, 102, 204, 0.8)',
        color: 'white',
        padding: responsiveStyles.padding,
        borderRadius: responsiveStyles.borderRadius,
        fontSize: responsiveStyles.baseFontSize,
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
        width: responsiveStyles.containerWidth,
        border: 'none',
        outline: 'none',
        maxWidth: '95vw', // Prevent overflow on very small screens
        boxSizing: 'border-box'
      }}
    >
      {/* Canvas Metrics Header */}
      <div
        className="metrics-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: `${Math.round(8 * responsiveStyles.scale)}px`,
          borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
          paddingBottom: `${Math.round(5 * responsiveStyles.scale)}px`
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: responsiveStyles.baseFontSize }}>Canvas Metrics</span>
        <div
          className="metrics-indicator"
          style={{
            width: responsiveStyles.indicatorSize,
            height: responsiveStyles.indicatorSize,
            borderRadius: '50%',
            backgroundColor: '#00ff00',
            boxShadow: '0 0 5px rgba(0, 255, 0, 0.8)',
            flexShrink: 0
          }}
        />
      </div>

      {/* Canvas Metrics Content */}
      <div
        className="metrics-content"
        style={{ lineHeight: '1.5', marginBottom: `${Math.round(12 * responsiveStyles.scale)}px` }}
      >
        <p style={{ margin: `${Math.round(4 * responsiveStyles.scale)}px 0` }}>
          <span style={{ display: 'inline-block', width: responsiveStyles.labelWidth, fontSize: responsiveStyles.baseFontSize }}>Width:</span>
          <span style={{ fontWeight: 'bold', fontSize: responsiveStyles.baseFontSize }}>{formattedWidth}</span>
          <span style={{ opacity: 0.8, fontSize: responsiveStyles.smallFontSize }}> pixels</span>
        </p>
        <p style={{ margin: `${Math.round(4 * responsiveStyles.scale)}px 0` }}>
          <span style={{ display: 'inline-block', width: responsiveStyles.labelWidth, fontSize: responsiveStyles.baseFontSize }}>Height:</span>
          <span style={{ fontWeight: 'bold', fontSize: responsiveStyles.baseFontSize }}>{formattedHeight}</span>
          <span style={{ opacity: 0.8, fontSize: responsiveStyles.smallFontSize }}> pixels</span>
        </p>
        <p style={{ margin: `${Math.round(4 * responsiveStyles.scale)}px 0` }}>
          <span style={{ display: 'inline-block', width: responsiveStyles.labelWidth, fontSize: responsiveStyles.baseFontSize }}>Distance:</span>
          <span style={{ fontWeight: 'bold', fontSize: responsiveStyles.baseFontSize }}>{formattedDistance}</span>
          <span style={{ opacity: 0.8, fontSize: responsiveStyles.smallFontSize }}> cm</span>
        </p>
      </div>

      {/* Processing Output Section */}
      <div
        className="output-section"
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.3)',
          paddingTop: `${Math.round(10 * responsiveStyles.scale)}px`,
          marginTop: `${Math.round(10 * responsiveStyles.scale)}px`
        }}
      >
        <div
          className="output-header"
          style={{
            fontWeight: 'bold',
            marginBottom: `${Math.round(8 * responsiveStyles.scale)}px`,
            fontSize: responsiveStyles.smallFontSize
          }}
        >
          Processing Output
        </div>
        <div style={{
          fontSize: responsiveStyles.tinyFontSize,
          lineHeight: '1.5',
          opacity: 0.9,
          marginBottom: `${Math.round(6 * responsiveStyles.scale)}px`,
          wordBreak: 'break-word'
        }}>
          {statusMessage}
        </div>
        <div style={{
          fontSize: responsiveStyles.tinyFontSize,
          lineHeight: '1.5',
          opacity: 0.9,
          marginBottom: `${Math.round(8 * responsiveStyles.scale)}px`,
          wordBreak: 'break-word'
        }}>
          {outputText || 'Processing output will appear here...'}
        </div>
        <div style={{
          fontSize: responsiveStyles.tinyFontSize,
          color: isCameraActivated ? '#00ff00' : '#ffcc00',
          fontWeight: 'bold',
          paddingTop: `${Math.round(8 * responsiveStyles.scale)}px`,
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          wordBreak: 'break-word'
        }}>
          📷 Camera: {isCameraActivated ? (isCameraActive ? 'Active' : 'Activated (Click Preview to Start)') : 'Not Activated (Deactivates on Refresh)'}
        </div>
      </div>
    </div>
  );
};

export default DisplayResponse;
