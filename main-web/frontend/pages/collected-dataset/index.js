import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import TopBar from './components-gui/topBar';
import CameraAccess from './components-gui/cameraAccess';

export default function CollectedDatasetPage() {
  const [showCamera, setShowCamera] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [metrics, setMetrics] = useState({
    width: '---',
    height: '---',
    distance: '---'
  });
  const previewAreaRef = useRef(null);

  // Update metrics and check window width for responsive layout
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
      
      // Set compact mode if window width is less than 1200px
      setIsCompact(window.innerWidth < 1200);
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100%',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      {/* Header/Navigation Area */}
      <div style={{
        display: 'flex',
        flexDirection: isCompact ? 'column' : 'row',
        borderBottom: '1px solid #ccc',
        backgroundColor: '#fff',
        padding: isCompact ? '5px' : '10px'
      }}>
        {/* Logo and Time/Delay Controls */}
        <div style={{
          display: 'flex',
          flexDirection: isCompact ? 'row' : 'column',
          alignItems: isCompact ? 'center' : 'flex-start',
          marginRight: isCompact ? '0' : '20px'
        }}>
          <div style={{
            fontSize: '32px',
            fontWeight: 'bold',
            marginRight: isCompact ? '20px' : '0',
            marginBottom: isCompact ? '0' : '15px'
          }}>
            Logo
          </div>
          
          <div style={{
            display: 'flex',
            flexDirection: isCompact ? 'column' : 'row',
            marginBottom: isCompact ? '5px' : '10px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginRight: isCompact ? '0' : '10px',
              marginBottom: isCompact ? '5px' : '0'
            }}>
              <span style={{ 
                marginRight: '5px',
                minWidth: isCompact ? '15px' : '60px'
              }}>
                {isCompact ? 'T:' : 'Time(s):'}
              </span>
              <input
                type="text"
                defaultValue="1"
                style={{
                  backgroundColor: '#7CFFDA',
                  width: '40px',
                  textAlign: 'center',
                  padding: '5px',
                  border: 'none'
                }}
              />
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ 
                marginRight: '5px',
                minWidth: isCompact ? '15px' : '60px'
              }}>
                {isCompact ? 'D:' : 'Delay(s):'}
              </span>
              <input
                type="text"
                defaultValue="3"
                style={{
                  backgroundColor: '#7CFFDA',
                  width: '40px',
                  textAlign: 'center',
                  padding: '5px',
                  border: 'none'
                }}
              />
            </div>
          </div>
        </div>
        
        {/* Button Groups */}
        <div style={{
          display: 'flex',
          flexDirection: isCompact ? 'column' : 'row',
          flex: 1
        }}>
          {/* First Button Group */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            marginRight: isCompact ? '0' : '20px',
            borderRight: isCompact ? 'none' : '1px solid #ccc',
            paddingRight: isCompact ? '0' : '15px'
          }}>
            <div style={{
              display: 'flex',
              marginBottom: '5px'
            }}>
              <button style={{
                backgroundColor: '#7CFFDA',
                padding: '5px 10px',
                margin: '0 5px 0 0',
                border: 'none',
                cursor: 'pointer'
              }}>
                {isCompact ? 'SRandom' : 'Set Random'}
              </button>
              <button style={{
                backgroundColor: '#7CFFDA',
                padding: '5px 10px',
                margin: '0 5px 0 0',
                border: 'none',
                cursor: 'pointer'
              }}>
                {isCompact ? 'Random' : 'Random Dot'}
              </button>
            </div>
            
            <div style={{
              display: 'flex',
              marginBottom: '5px'
            }}>
              <button style={{
                backgroundColor: '#7CFFDA',
                padding: '5px 10px',
                margin: '0 5px 0 0',
                border: 'none',
                cursor: 'pointer'
              }}>
                {isCompact ? 'Calibrate' : 'Set Calibrate'}
              </button>
              <button style={{
                backgroundColor: '#7CFFDA',
                padding: '5px 10px',
                margin: '0 5px 0 0',
                border: 'none',
                cursor: 'pointer'
              }}>
                {isCompact ? 'Clear' : 'Clear All'}
              </button>
            </div>
          </div>
          
          {/* Second Button Group */}
          <div style={{
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex',
              marginBottom: '5px'
            }}>
              <button style={{
                backgroundColor: '#7CFFDA',
                padding: '5px 10px',
                margin: '0 5px 0 0',
                border: 'none',
                cursor: 'pointer'
              }}>
                {isCompact ? 'Head pose' : 'Draw Head pose'}
              </button>
              <button style={{
                backgroundColor: '#7CFFDA',
                padding: '5px 10px',
                margin: '0 5px 0 0',
                border: 'none',
                cursor: 'pointer'
              }}>
                {isCompact ? '☐ Box' : 'Show Bounding Box'}
              </button>
            </div>
            
            <div style={{
              display: 'flex',
              marginBottom: '5px'
            }}>
              <button style={{
                backgroundColor: '#7CFFDA',
                padding: '5px 10px',
                margin: '0 5px 0 0',
                border: 'none',
                cursor: 'pointer'
              }}>
                {isCompact ? 'Preview' : 'Show Preview'}
              </button>
              <button style={{
                backgroundColor: '#7CFFDA',
                padding: '5px 10px',
                margin: '0 5px 0 0',
                border: 'none',
                cursor: 'pointer'
              }}>
                {isCompact ? '😊 Mask' : '😊 Show Mask'}
              </button>
              <button style={{
                backgroundColor: '#7CFFDA',
                padding: '5px 10px',
                margin: '0 5px 0 0',
                border: 'none',
                cursor: 'pointer'
              }}>
                {isCompact ? 'Values' : 'Parameters'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Only show textarea in full version */}
        {!isCompact && (
          <div style={{
            display: 'flex',
            marginLeft: '20px'
          }}>
            <textarea style={{
              width: '250px',
              height: '80px',
              marginRight: '10px',
              border: '1px solid #ccc'
            }}></textarea>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <button style={{
                backgroundColor: '#7CFFDA',
                width: '40px',
                height: '35px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer'
              }}>
                <span style={{fontSize: '20px'}}>≡</span>
              </button>
              
              <button style={{
                backgroundColor: '#7CFFDA',
                width: '40px',
                height: '35px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer'
              }}>
                <span style={{fontSize: '20px'}}>⚫</span>
              </button>
            </div>
          </div>
        )}
        
        {/* Menu buttons for compact view (right-aligned) */}
        {isCompact && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <button style={{
              backgroundColor: '#7CFFDA',
              width: '35px',
              height: '35px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '5px',
              border: 'none',
              cursor: 'pointer'
            }}>
              <span style={{fontSize: '20px'}}>≡</span>
            </button>
            
            <button style={{
              backgroundColor: '#7CFFDA',
              width: '35px',
              height: '35px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer'
            }}>
              <span style={{fontSize: '20px'}}>⚫</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Main preview area */}
      <div 
        ref={previewAreaRef}
        style={{
          flex: 1,
          backgroundColor: '#e0f5f0',
          position: 'relative'
        }}
      >
        {!showCamera && (
          <div style={{
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}>
            <p style={{marginBottom: '15px'}}>Camera preview will appear here</p>
            <button 
              onClick={handleCameraAccess}
              style={{
                backgroundColor: '#7CFFDA',
                padding: '5px 10px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Access Camera
            </button>
          </div>
        )}
        
        {/* Metrics info */}
        <div style={{
          position: 'absolute',
          right: '10px',
          top: '10px',
          padding: '10px',
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '5px'
        }}>
          <p>W: {metrics.width} (pixels) H: {metrics.height} (pixels)</p>
          <p>Distance: {metrics.distance} (cm)</p>
        </div>
      </div>
      
      <CameraAccess 
        isShowing={showCamera} 
        onClose={handleCameraClose}
        onCameraReady={handleCameraReady}
      />
    </div>
  );
}