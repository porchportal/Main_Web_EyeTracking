import React, { useState, useEffect } from 'react';

const OrderRequire = ({
  isHydrated,
  showOrderRequire,
  orderRequireMessage,
  orderRequireList = []
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (showOrderRequire) {
      setIsVisible(true);
      // Auto-hide after 8 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [showOrderRequire]);

  if (!isHydrated || !isVisible) {
    return null;
  }

  return (
    <>
      {/* Order & Requirements notification - positioned on top right */}
      <div 
        className="order-require-banner" 
        style={{
          position: 'fixed',
          right: '20px',
          top: '140px', // Position below topbar
          backgroundColor: 'rgba(255, 152, 0, 0.9)',
          color: 'white',
          padding: '15px 20px',
          borderRadius: '12px',
          fontSize: '14px',
          fontFamily: 'Arial, sans-serif',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
          pointerEvents: 'auto',
          zIndex: 30,
          display: 'block',
          width: '320px',
          maxHeight: '400px',
          overflowY: 'auto',
          animation: isVisible ? 'slideInFromRight 0.4s ease-out' : 'slideOutToRight 0.3s ease-in'
        }}
      >
        <div 
          className="notification-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            borderBottom: '2px solid rgba(255, 255, 255, 0.4)',
            paddingBottom: '8px'
          }}
        >
          <span style={{ 
            fontWeight: 'bold', 
            fontSize: '16px',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
          }}>
            📋 Order & Requirements
          </span>
          <div 
            className="notification-indicator"
            style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: '#00ff00',
              boxShadow: '0 0 8px rgba(0, 255, 0, 0.8)',
              animation: 'pulse 2s infinite'
            }} 
          />
        </div>
        
        <div 
          className="notification-content"
          style={{ lineHeight: '1.6' }}
        >
          {/* Main message */}
          {orderRequireMessage && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ 
                margin: '0 0 8px 0',
                fontWeight: '500',
                color: '#fff3cd'
              }}>
                <span style={{ display: 'inline-block', width: '80px', fontWeight: 'bold' }}>Status:</span> 
                <span style={{ fontWeight: 'bold' }}>
                  {orderRequireMessage}
                </span>
              </p>
            </div>
          )}

          {/* Requirements list */}
          {orderRequireList && orderRequireList.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <h4 style={{ 
                margin: '0 0 8px 0', 
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#fff3cd',
                borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
                paddingBottom: '4px'
              }}>
                📝 Requirements List:
              </h4>
              <ul style={{ 
                margin: '0', 
                paddingLeft: '20px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {orderRequireList.map((item, index) => (
                  <li key={index} style={{ 
                    marginBottom: '6px',
                    fontSize: '13px',
                    color: '#ffffff'
                  }}>
                    <span style={{ 
                      display: 'inline-block',
                      width: '20px',
                      height: '20px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      borderRadius: '50%',
                      textAlign: 'center',
                      lineHeight: '20px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      marginRight: '8px'
                    }}>
                      {index + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Default message if no specific content */}
          {!orderRequireMessage && (!orderRequireList || orderRequireList.length === 0) && (
            <div style={{ 
              textAlign: 'center',
              padding: '20px 0',
              color: '#fff3cd'
            }}>
              <p style={{ margin: '0', fontSize: '13px' }}>
                📋 No specific requirements configured.
                <br />
                <span style={{ fontSize: '12px', opacity: 0.8 }}>
                  Configure your order requirements in admin settings.
                </span>
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
        onClick={() => setIsVisible(false)}
        >
          ×
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOutToRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 8px rgba(0, 255, 0, 0.8);
          }
          50% {
            box-shadow: 0 0 15px rgba(0, 255, 0, 1);
          }
          100% {
            box-shadow: 0 0 8px rgba(0, 255, 0, 0.8);
          }
        }

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
