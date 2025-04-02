// components-gui/WhiteScreenMain.js
import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

// Import the shared functionality
import { 
  getRandomPosition, 
  drawRedDot, 
  captureAndPreviewProcess,
  initializeCanvas,
  captureImages,
  showCapturePreview
} from './Action/countSave';

// Create a client-only version of the component
const WhiteScreenMain = ({ 
  onStatusUpdate, 
  triggerCameraAccess,
  onButtonClick,
  canvasRef = null,
  toggleTopBar
}) => {
  // Use provided canvasRef or create a new one
  const internalCanvasRef = useRef(null);
  const activeCanvasRef = canvasRef || internalCanvasRef;
  
  // Current dot state
  const [currentDot, setCurrentDot] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdownValue, setCountdownValue] = useState(null);
  const [remainingCaptures, setRemainingCaptures] = useState(0);
  const [processStatus, setProcessStatus] = useState('');
  
  // Track capture session
  const [captureCounter, setCaptureCounter] = useState(1);
  const [captureFolder] = useState('eye_tracking_captures'); // Fixed folder name
  
  // Configuration state
  const [randomTimes, setRandomTimes] = useState(1);
  const [delaySeconds, setDelaySeconds] = useState(3);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const [currentCalibrationIndex, setCurrentCalibrationIndex] = useState(0);
  
  // Debug state to make visibility easier to track
  const [canvasVisible, setCanvasVisible] = useState(false);
  const [forceShowCountdown, setForceShowCountdown] = useState(false);
  
  // Set up canvas when component mounts
  useEffect(() => {
    // Skip if this runs during SSR
    if (typeof window === 'undefined') return;
    
    const canvas = activeCanvasRef.current;
    if (!canvas) {
      console.error("Canvas ref is null in setup effect");
      return;
    }
    
    console.log("Canvas setup effect running", { 
      hasCanvas: !!canvas, 
      canvasHeight: canvas.height,
      canvasWidth: canvas.width
    });
    
    // Function to update canvas dimensions
    const updateDimensions = () => {
      const parent = canvas.parentElement;
      if (!parent) {
        console.error("Canvas parent is null");
        return;
      }
      
      // Get the parent container dimensions
      const parentWidth = parent.clientWidth;
      const parentHeight = parent.clientHeight;
      
      console.log("Resizing canvas to:", { parentWidth, parentHeight });
      
      canvas.width = parentWidth;
      canvas.height = parentHeight;
      
      // Clear the canvas and set background
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Redraw current dot if exists
      if (currentDot) {
        console.log("Redrawing dot after resize:", currentDot);
        drawDot(currentDot.x, currentDot.y, 'red', 8);
      }
      
      setCanvasVisible(true);
    };
    
    // Initial sizing
    updateDimensions();
    
    // Listen for window resize
    window.addEventListener('resize', updateDimensions);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, [activeCanvasRef, currentDot]);
  
  // Draw a dot on the canvas
  const drawDot = (x, y, color = 'red', radius = 12) => { // Increased radius
    console.log("Drawing dot at:", { x, y, color, radius });
    
    const canvas = activeCanvasRef.current;
    if (!canvas) {
      console.error("Canvas ref is null in drawDot");
      return null;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw dot with glow effect
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Add glow effect
    ctx.beginPath();
    ctx.arc(x, y, radius + 5, 0, Math.PI * 2); // Increased glow
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; // More visible glow
    ctx.lineWidth = 3; // Thicker line
    ctx.stroke();
    
    // Store current dot position - using callback form to ensure it updates
    setCurrentDot(prev => {
      console.log("Updating currentDot state from:", prev, "to:", { x, y });
      return { x, y };
    });
    
    return { x, y };
  };
  
  // Clear the canvas
  const clearCanvas = () => {
    console.log("Clearing canvas");
    
    const canvas = activeCanvasRef.current;
    if (!canvas) {
      console.error("Canvas ref is null in clearCanvas");
      return;
    }
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    setCurrentDot(null);
    setCountdownValue(null);
    setForceShowCountdown(false);
    setProcessStatus('Canvas cleared');
    
    // Clear the message after a delay
    setTimeout(() => {
      setProcessStatus('');
    }, 1500);
  };
  
  // Save an image to the server
  const saveImageToServer = async (imageData, filename, type) => {
    try {
      console.log(`Attempting to save ${type} image: ${filename}`);
      
      const response = await fetch('/api/save-capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageData,
          filename,
          type,
          folder: captureFolder
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`Saved ${type} image:`, result);
      
      // If the server returns a new capture number, update our counter
      if (result.captureNumber) {
        setCaptureCounter(result.captureNumber + 1);
      }
      
      return result;
    } catch (error) {
      console.error(`Error saving ${type} image:`, error);
      throw error;
    }
  };
  
  // Updated captureImage function using countSave module
  const captureImage = async () => {
    console.log("Capturing images...");
    setIsCapturing(true);
    
    try {
      // Use the shared capture function
      const captureResult = await captureImages({
        canvasRef: activeCanvasRef,
        position: currentDot,
        captureCounter,
        saveImageToServer,
        setCaptureCounter,
        setProcessStatus,
        toggleTopBar,
        captureFolder: 'eye_tracking_captures'
      });
      
      // Show preview using the shared function
      showCapturePreview(
        captureResult.screenImage,
        captureResult.webcamImage,
        currentDot
      );
      
      // Update status
      setIsCapturing(false);
      setProcessStatus(`Captured with dot at: x=${currentDot?.x}, y=${currentDot?.y}`);
      
      // Update parent component
      if (onStatusUpdate) {
        onStatusUpdate(`Images and parameters saved for capture #${captureCounter}`);
      }
      
      // Show TopBar again after capture with a delay to let preview finish
      setTimeout(() => {
        console.log("Showing TopBar after capture");
        if (typeof toggleTopBar === 'function') {
          toggleTopBar(true);
        } else if (typeof window !== 'undefined' && window.toggleTopBar) {
          window.toggleTopBar(true);
        }
      }, 2500);
    } catch (error) {
      console.error('Error during capture:', error);
      setIsCapturing(false);
      setProcessStatus('Error capturing images: ' + error.message);
    }
    
    // Clear status after a delay
    setTimeout(() => {
      setProcessStatus('');
    }, 3000);
  };
  
  // Random Dot action
  const handleRandomDot = () => {
    // Hide the TopBar before showing dot
    if (typeof toggleTopBar === 'function') {
      toggleTopBar(false);
    } else if (typeof window !== 'undefined' && window.toggleTopBar) {
      toggleTopBar(false);
    }
    
    setIsCapturing(true);
    setProcessStatus('Generating random dot...');
    
    // Give the component time to update
    setTimeout(async () => {
      const canvas = activeCanvasRef.current;
      if (canvas) {
        // Make sure canvas dimensions are properly set
        const parent = canvas.parentElement;
        initializeCanvas(canvas, parent);
        
        // Generate random position
        const position = getRandomPosition(canvas);
        
        // Draw the dot
        const ctx = canvas.getContext('2d');
        drawRedDot(ctx, position.x, position.y);
        
        // Store current dot position directly
        setCurrentDot(position);
        
        try {
          // Use the shared capture and preview process
          await captureAndPreviewProcess({
            canvasRef: activeCanvasRef,
            position,
            captureCounter,
            saveImageToServer,
            setCaptureCounter,
            setProcessStatus,
            toggleTopBar,
            onStatusUpdate: (status) => {
              if (onStatusUpdate) {
                onStatusUpdate(status);
              }
            },
            captureFolder: 'eye_tracking_captures'
          });
          
          // Set capturing state to false after a delay
          setTimeout(() => {
            setIsCapturing(false);
          }, 2200);
        } catch (error) {
          console.error("Error in capture and preview process:", error);
          setIsCapturing(false);
          setProcessStatus('Error capturing images: ' + error.message);
          
          // Clear error message after a delay
          setTimeout(() => {
            setProcessStatus('');
          }, 3000);
        }
      }
    }, 200);
  };
  
  // Multiple random dots sequence - also updated to use countSave functions
  const handleSetRandom = () => {
    if (isCapturing) return;
    
    // Parse input values (use defaults if invalid)
    const times = parseInt(randomTimes) || 1;
    const delay = parseInt(delaySeconds) || 3;
    
    if (times <= 0 || delay <= 0) {
      setProcessStatus('Please use positive values for times and delay');
      return;
    }
    
    setIsCapturing(true);
    setRemainingCaptures(times);
    setProcessStatus(`Starting ${times} random captures...`);
    
    // Start sequence
    scheduleRandomCaptures(times, times, delay);
  };
  
  // Schedule sequence of random captures - updated with countSave
  const scheduleRandomCaptures = (remaining, total, delay) => {
    if (remaining <= 0) {
      setIsCapturing(false);
      setRemainingCaptures(0);
      setProcessStatus('Random capture sequence completed');
      
      // Clear status after a delay
      setTimeout(() => {
        setProcessStatus('');
      }, 2000);
      
      return;
    }
    
    setRemainingCaptures(remaining);
    setProcessStatus(`Capture ${total - remaining + 1} of ${total}`);
    
    // Generate random position and draw
    const canvas = activeCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const position = getRandomPosition(canvas);
    drawRedDot(ctx, position.x, position.y);
    setCurrentDot(position);
    
    // Use shared capture and preview process
    captureAndPreviewProcess({
      canvasRef: activeCanvasRef,
      position,
      captureCounter,
      saveImageToServer,
      setCaptureCounter,
      setProcessStatus,
      toggleTopBar,
      onStatusUpdate: (status) => {
        if (onStatusUpdate) {
          onStatusUpdate(status);
        }
      },
      captureFolder: 'eye_tracking_captures'
    }).then(() => {
      // Schedule next capture
      setTimeout(() => {
        scheduleRandomCaptures(remaining - 1, total, delay);
      }, delay * 1000);
    }).catch(error => {
      console.error('Error during random capture:', error);
      setIsCapturing(false);
      setProcessStatus('Error: ' + error.message);
      
      // Clear error message after a delay
      setTimeout(() => {
        setProcessStatus('');
      }, 3000);
    });
  };
  
  // Generate calibration points based on canvas dimensions
  const generateCalibrationPoints = (width, height) => {
    if (!width || !height || width <= 0 || height <= 0) {
      console.error("generateCalibrationPoints: Invalid canvas dimensions", { width, height });
      return [];
    }
  
    const conditionalRound = (dimension, percentage) => Math.round(dimension * percentage);
  
    // Outer frame (12% from edges)
    const xLeftOuter = conditionalRound(width, 0.12);
    const xRightOuter = width - xLeftOuter;
    const yTopOuter = conditionalRound(height, 0.12);
    const yBottomOuter = height - yTopOuter;
  
    // Inner frame (26% from edges)
    const xLeftInner = conditionalRound(width, 0.26);
    const xRightInner = width - xLeftInner;
    const yTopInner = conditionalRound(height, 0.26);
    const yBottomInner = height - yTopInner;
  
    const xCenter = Math.floor(width / 2);
    const yCenter = Math.floor(height / 2);
  
    return [
      // Outer frame (8 points)
      { x: xLeftOuter, y: yTopOuter, label: "Outer Top-Left" },
      { x: xCenter, y: yTopOuter, label: "Outer Top-Center" },
      { x: xRightOuter, y: yTopOuter, label: "Outer Top-Right" },
      { x: xLeftOuter, y: yCenter, label: "Outer Middle-Left" },
      { x: xRightOuter, y: yCenter, label: "Outer Middle-Right" },
      { x: xLeftOuter, y: yBottomOuter, label: "Outer Bottom-Left" },
      { x: xCenter, y: yBottomOuter, label: "Outer Bottom-Center" },
      { x: xRightOuter, y: yBottomOuter, label: "Outer Bottom-Right" },
  
      // Inner frame (8 points)
      { x: xLeftInner, y: yTopInner, label: "Inner Top-Left" },
      { x: xCenter, y: yTopInner, label: "Inner Top-Center" },
      { x: xRightInner, y: yTopInner, label: "Inner Top-Right" },
      { x: xLeftInner, y: yCenter, label: "Inner Middle-Left" },
      { x: xRightInner, y: yCenter, label: "Inner Middle-Right" },
      { x: xLeftInner, y: yBottomInner, label: "Inner Bottom-Left" },
      { x: xCenter, y: yBottomInner, label: "Inner Bottom-Center" },
      { x: xRightInner, y: yBottomInner, label: "Inner Bottom-Right" }
    ];
  };
  
  // Handle Set Calibrate action
  const handleSetCalibrate = async () => {
    try {
      // STEP 1: HIDE THE TOP BAR IMMEDIATELY (before anything else happens)
      if (typeof toggleTopBar === 'function') {
        toggleTopBar(false);
      } else if (typeof window !== 'undefined' && window.toggleTopBar) {
        window.toggleTopBar(false);
      }
      
      // Add a small delay to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // STEP 2: Initial setup
      setIsCapturing(true);
      setProcessStatus('Starting calibration sequence...');
      
      if (onStatusUpdate) {
        onStatusUpdate({
          processStatus: 'Starting calibration sequence',
          isCapturing: true
        });
      }
      
      // Create a status indicator
      const statusIndicator = document.createElement('div');
      statusIndicator.className = 'calibrate-status-indicator';
      statusIndicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background-color: rgba(0, 102, 204, 0.9);
        color: white;
        font-size: 14px;
        font-weight: bold;
        padding: 8px 12px;
        border-radius: 6px;
        z-index: 9999;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      `;
      statusIndicator.textContent = 'Calibrate Set Active: Initializing...';
      document.body.appendChild(statusIndicator);
      
      // STEP 3: Setup canvas and generate points
      const canvas = activeCanvasRef.current;
      if (!canvas) {
        throw new Error("Canvas reference is null");
      }
      
      // Ensure canvas dimensions are set
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
      
      console.log("Canvas dimensions for calibration:", { width: canvas.width, height: canvas.height });
      
      // Generate calibration points using the imported function
      const points = generateCalibrationPoints(canvas.width, canvas.height);
      setCalibrationPoints(points);
      
      console.log(`Generated ${points.length} calibration points`);
      
      if (!points || points.length === 0) {
        throw new Error('Failed to generate calibration points');
      }
      
      setRemainingCaptures(points.length);
      
      // STEP 4: Process each calibration point in sequence
      for (let i = 0; i < points.length; i++) {
        // Update state
        setCurrentCalibrationIndex(i);
        setRemainingCaptures(points.length - i);
        
        // Update status
        const statusText = `Calibration ${i + 1}/${points.length}`;
        setProcessStatus(statusText);
        statusIndicator.textContent = `Calibrate Set Active: Processing point ${i + 1}/${points.length}`;
        
        if (onStatusUpdate) {
          onStatusUpdate(statusText);
        }
        
        // STEP 5: Draw the red dot FIRST, before any countdown
        const point = points[i];
        drawDot(point.x, point.y);
        
        // Wait a moment to ensure dot is visible
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // STEP 6: Get canvas position for absolute positioning
        const canvasRect = canvas.getBoundingClientRect();
        
        // Create countdown element above the dot
        const countdownElement = document.createElement('div');
        countdownElement.className = 'calibrate-countdown';
        
        // Position it above the dot
        const absoluteX = canvasRect.left + point.x;
        const absoluteY = canvasRect.top + point.y;
        
        countdownElement.style.cssText = `
          position: fixed;
          left: ${absoluteX}px;
          top: ${absoluteY - 60}px;
          transform: translateX(-50%);
          color: red;
          font-size: 36px;
          font-weight: bold;
          text-shadow: 0 0 10px white, 0 0 20px white;
          z-index: 9999;
          background-color: rgba(255, 255, 255, 0.8);
          border: 2px solid red;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          display: flex;
          justify-content: center;
          align-items: center;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
        `;
        document.body.appendChild(countdownElement);
        
        // STEP 7: Run 3-2-1 countdown (the dot stays visible during this time)
        for (let count = 3; count > 0; count--) {
          countdownElement.textContent = count;
          statusIndicator.textContent = `Calibrate Set Active: countdown ${count} (${i + 1}/${points.length})`;
          
          // Wait for next countdown step
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        // STEP 8: Show capturing indicator
        countdownElement.textContent = "✓";
        statusIndicator.textContent = `Capturing point ${i + 1}/${points.length}`;
        
        // STEP 9: Remove countdown element but KEEP the dot visible
        setTimeout(() => {
          if (countdownElement.parentNode) {
            countdownElement.parentNode.removeChild(countdownElement);
          }
        }, 300);
        
        // STEP 10: Capture images (the dot is still visible)
        await captureImage();
        
        // STEP 11: Wait for preview to complete before moving to next point
        // During this time, the dot remains visible
        await new Promise(resolve => setTimeout(resolve, 2300));
      }
      
      // STEP 12: Calibration complete
      statusIndicator.textContent = 'Calibration completed';
      setProcessStatus('Calibration completed');
      if (onStatusUpdate) {
        onStatusUpdate('Calibration completed successfully');
      }
      
      setRemainingCaptures(0);
      
      // Remove status indicator after a delay
      setTimeout(() => {
        if (statusIndicator.parentNode) {
          statusIndicator.parentNode.removeChild(statusIndicator);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Calibration error:', error);
      setProcessStatus(`Error: ${error.message}`);
      if (onStatusUpdate) {
        onStatusUpdate(`Calibration error: ${error.message}`);
      }
    } finally {
      setIsCapturing(false);
      
      // Show TopBar again
      if (typeof toggleTopBar === 'function') {
        toggleTopBar(true);
      } else if (typeof window !== 'undefined' && window.toggleTopBar) {
        window.toggleTopBar(true);
      }
    }
  };
  
  // Map button clicks to appropriate handlers
  const handleScreenAction = (actionType) => {
    console.log(`Screen action received: ${actionType}`);
    
    switch(actionType) {
      case 'randomDot':
        handleRandomDot();
        break;
      case 'setRandom':
        handleSetRandom();
        break;
      case 'calibrate':
        handleSetCalibrate();
        break;
      case 'clearAll':
        clearCanvas();
        break;
      default:
        // Forward to parent if not handled here
        if (onButtonClick) {
          onButtonClick(actionType);
        }
    }
  };
  
  // Register action handlers with parent component
  useEffect(() => {
    // Skip during SSR
    if (typeof window === 'undefined') return;
    
    console.log("Registering action handlers with parent");
    
    if (onButtonClick) {
      // Create action handlers
      const actionHandlers = {
        randomDot: handleRandomDot,
        setRandom: handleSetRandom,
        calibrate: handleSetCalibrate,
        clearAll: clearCanvas
      };
      
      // Store in parent component context
      onButtonClick('registerActions', actionHandlers);
      
      // Also make them globally available for direct access
      window.whiteScreenActions = actionHandlers;
    }
    
    // Cleanup on unmount
    return () => {
      if (typeof window !== 'undefined' && window.whiteScreenActions) {
        window.whiteScreenActions = null;
      }
    };
  }, [onButtonClick]);
  
  // Update parent with status changes
  useEffect(() => {
    if (onStatusUpdate && processStatus) {
      onStatusUpdate(processStatus);
    }
  }, [processStatus, onStatusUpdate]);
  
  return (
    <div className="white-screen-container" style={{ 
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 50,
      backgroundColor: 'rgba(255, 255, 255, 0.5)' // Slight transparency to see if it's rendered
    }}>
      {/* White screen canvas - Make it cover the entire container */}
      <div 
        className="white-screen-canvas-container"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'white',
          overflow: 'hidden',
          border: '1px solid #ccc', // More visible border
          zIndex: 51
        }}
      >
        {/* Canvas - Always render it */}
        <canvas
          ref={canvasRef ? canvasRef : internalCanvasRef}
          className="white-screen-canvas"
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        />
        
        {/* Overlay for countdown near dot - with improved visibility and a fallback */}
        {(countdownValue !== null || forceShowCountdown) && currentDot && (
          <div 
            className="dot-countdown"
            style={{
              position: 'absolute',
              left: `${currentDot.x - 30}px`,
              top: `${currentDot.y - 70}px`,
              color: 'red',
              fontSize: '48px', // Much larger
              fontWeight: 'bold',
              textShadow: '0 0 10px white, 0 0 20px white', // Stronger shadow
              zIndex: 999,
              backgroundColor: 'rgba(255, 255, 255, 0.8)', // Background to make it more visible
              padding: '10px 20px',
              borderRadius: '50%',
              boxShadow: '0 0 10px rgba(0, 0, 0, 0.3)',
              width: '60px',
              height: '60px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              border: '2px solid red' // Border to make it stand out
            }}
          >
            {countdownValue || 3}
          </div>
        )}
        
        {/* Backup centered countdown for better visibility */}
        {(countdownValue !== null || forceShowCountdown) && (
          <div 
            className="center-countdown-backup"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'white',
              fontSize: '120px', // Very large
              fontWeight: 'bold',
              textShadow: '0 0 20px black',
              zIndex: 1000,
              backgroundColor: 'rgba(255, 0, 0, 0.7)', // Red background
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 0 30px rgba(0, 0, 0, 0.5)'
            }}
          >
            {countdownValue || 3}
          </div>
        )}
        
        {/* Indicator that the dot is present - helps with debugging */}
        {currentDot && (
          <div 
            className="dot-indicator"
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              backgroundColor: 'rgba(0, 255, 0, 0.7)',
              color: 'black',
              padding: '5px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              zIndex: 52
            }}
          >
            Dot at x:{currentDot.x}, y:{currentDot.y}
          </div>
        )}
        
        {/* Status overlay */}
        {(processStatus || remainingCaptures > 0) && (
          <div
            className="status-overlay"
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.8)', // Darker for visibility
              color: 'white', // White text
              padding: '10px 15px',
              borderRadius: '4px',
              fontSize: '16px', // Larger
              fontWeight: 'bold',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              zIndex: 53
            }}
          >
            {processStatus && <div>{processStatus}</div>}
            {remainingCaptures > 0 && (
              <div style={{ color: '#ffcc00' }}>
                Remaining: {remainingCaptures}
              </div>
            )}
          </div>
        )}
        
        {/* Canvas visibility indicator - debugging only */}
        <div
          className="canvas-indicator"
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            backgroundColor: canvasVisible ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)',
            color: 'black',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            zIndex: 52
          }}
        >
          Canvas: {canvasVisible ? 'Visible' : 'Hidden'}
        </div>
      </div>
    </div>
  );
};

// Export a dynamic version with SSR disabled to avoid useLayoutEffect warnings
export default dynamic(() => Promise.resolve(WhiteScreenMain), { ssr: false });