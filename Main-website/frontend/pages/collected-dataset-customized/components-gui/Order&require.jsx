import React, { useState, useEffect } from 'react';

const OrderRequire = ({
  isHydrated,
  showOrderRequire,
  orderRequireMessage,
  orderRequireList = [],
  isManualShow = false, // New prop to indicate if this is a manual show (user clicked button)
  clickedButtons = new Set() // Track which buttons have been clicked
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [animationState, setAnimationState] = useState('hidden');

  useEffect(() => {
    if (showOrderRequire) {
      setIsVisible(true);
      setAnimationState('visible');
      
      // Only auto-hide if this is NOT a manual show (user clicked button)
      // If it's a manual show, let the user control when to hide it
      if (!isManualShow) {
        // Auto-hide after 8 seconds only for automatic shows
        const timer = setTimeout(() => {
          setAnimationState('hidden');
          setTimeout(() => setIsVisible(false), 300); // Wait for animation to complete
        }, 8000);
        return () => clearTimeout(timer);
      }
    } else {
      setAnimationState('hidden');
      setTimeout(() => setIsVisible(false), 300); // Wait for animation to complete
    }
  }, [showOrderRequire, isManualShow]);

  // Check if Canvas Metrics is visible to adjust positioning
  const isCanvasMetricsVisible = () => {
    if (typeof window !== 'undefined') {
      const metricsDisplay = document.querySelector('.metrics-display');
      if (!metricsDisplay) return false;
      
      // Check if element is visible by checking computed styles
      const computedStyle = window.getComputedStyle(metricsDisplay);
      const isDisplayed = computedStyle.display !== 'none';
      const isOpaque = parseFloat(computedStyle.opacity) > 0;
      const isVisible = computedStyle.visibility !== 'hidden';
      
      return isDisplayed && isOpaque && isVisible;
    }
    return false;
  };

  const [canvasMetricsVisible, setCanvasMetricsVisible] = useState(false);

  useEffect(() => {
    const checkMetricsVisibility = () => {
      const isVisible = isCanvasMetricsVisible();
      setCanvasMetricsVisible(prev => {
        // Only update state if the value actually changed to prevent unnecessary re-renders
        if (prev !== isVisible) {
          return isVisible;
        }
        return prev;
      });
    };

    // Initial check
    checkMetricsVisibility();

    // Use MutationObserver to watch for changes in the metrics display
    let observer;
    if (typeof window !== 'undefined') {
      const metricsDisplay = document.querySelector('.metrics-display');
      if (metricsDisplay) {
        observer = new MutationObserver(() => {
          checkMetricsVisibility();
        });
        
        observer.observe(metricsDisplay, {
          attributes: true,
          attributeFilter: ['style', 'class']
        });
      }
    }

    // Fallback interval for cases where MutationObserver doesn't catch changes
    const interval = setInterval(checkMetricsVisibility, 1000);
    
    return () => {
      if (observer) {
        observer.disconnect();
      }
      clearInterval(interval);
    };
  }, []);

  if (!isHydrated || !isVisible) {
    return null;
  }

  return (
    <>
      {/* Button Sequence notification - positioned on top right */}
      <div 
        className={`order-require-banner ${animationState}`}
        style={{
          position: 'fixed',
          right: '20px',
          top: canvasMetricsVisible ? '240px' : '140px', // Stack below Canvas Metrics if visible
          backgroundColor: 'rgba(0, 102, 204, 0.8)', // Match displayResponse color
          color: 'white',
          padding: '10px 15px', // Match displayResponse padding
          borderRadius: '8px', // Match displayResponse border radius
          fontSize: '14px',
          fontFamily: 'monospace', // Match displayResponse font
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)', // Match displayResponse shadow
          transition: 'all 0.3s ease, top 0.5s ease', // Smooth transition for position changes
          opacity: animationState === 'visible' ? 1 : 0,
          transform: animationState === 'visible' 
            ? 'translateX(0)' 
            : 'translateX(50px)', // Match displayResponse transform
          pointerEvents: animationState === 'visible' ? 'auto' : 'none',
          zIndex: 20, // Lower than original to not interfere
          display: animationState === 'hidden' ? 'none' : 'block',
          width: '240px', // Match displayResponse width
          maxHeight: '300px',
          overflowY: 'auto'
        }}
      >
        <div 
          className="notification-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
            paddingBottom: '5px'
          }}
        >
          <span style={{ 
            fontWeight: 'bold', 
            fontSize: '14px'
          }}>
            🔄 Button Sequence
            {isManualShow && (
              <span style={{ 
                fontSize: '10px', 
                color: '#90EE90', 
                marginLeft: '8px',
                fontStyle: 'italic'
              }}>
                (Manual)
              </span>
            )}
            {clickedButtons.size > 0 && (
              <span style={{ 
                fontSize: '10px', 
                color: '#00ff00', 
                marginLeft: '8px',
                fontStyle: 'italic'
              }}>
                💾 Saved
              </span>
            )}
          </span>
          <div 
            className="notification-indicator"
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
          className="notification-content"
          style={{ lineHeight: '1.5' }}
        >
          {/* Requirements list only */}
          {orderRequireList && orderRequireList.length > 0 && (
            <div>
              <ul style={{ 
                margin: '0', 
                paddingLeft: '20px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {orderRequireList.map((item, index) => {
                  const isClicked = clickedButtons.has(item);
                  return (
                    <li key={index} style={{ 
                      marginBottom: '6px',
                      fontSize: '13px',
                      color: isClicked ? '#90EE90' : '#ffffff', // Green text for clicked items
                      textDecoration: isClicked ? 'line-through' : 'none', // Strike through for clicked items
                      opacity: isClicked ? 0.8 : 1
                    }}>
                      <span style={{ 
                        display: 'inline-block',
                        width: '20px',
                        height: '20px',
                        backgroundColor: isClicked ? '#00ff00' : '#4CAF50', // Green background for clicked items
                        color: 'white',
                        borderRadius: '50%',
                        textAlign: 'center',
                        lineHeight: '20px',
                        fontSize: isClicked ? '12px' : '10px',
                        fontWeight: 'bold',
                        marginRight: '8px',
                        boxShadow: isClicked ? '0 0 5px rgba(0, 255, 0, 0.8)' : 'none' // Glow effect for clicked items
                      }}>
                        {isClicked ? '✓' : index + 1}
                      </span>
                      {item}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Default message if no requirements */}
          {(!orderRequireList || orderRequireList.length === 0) && (
            <div style={{ 
              textAlign: 'center',
              padding: '20px 0',
              color: '#fff3cd'
            }}>
              <p style={{ margin: '0', fontSize: '13px' }}>
                🔄 No button sequence configured.
              </p>
            </div>
          )}
        </div>

        {/* Close button */}
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          cursor: 'pointer',
          fontSize: '18px',
          color: 'rgba(255, 255, 255, 0.7)',
          transition: 'color 0.2s ease'
        }}
        onMouseEnter={(e) => e.target.style.color = 'white'}
        onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.7)'}
        onClick={() => {
          setAnimationState('hidden');
          setTimeout(() => setIsVisible(false), 300);
        }}
        >
          ×
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        .order-require-banner::-webkit-scrollbar {
          width: 6px;
        }

        .order-require-banner::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        .order-require-banner::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
        }

        .order-require-banner::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </>
  );
};

export default OrderRequire;