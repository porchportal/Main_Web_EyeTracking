import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { generateCalibrationPoints } from './Action/CalibratePoints'; // Adjust the path as needed

// Create a basic ActionButton component
const ActionButton = ({ text, abbreviatedText, onClick, customClass = '', disabled = false, active = false }) => {
  const [isAbbreviated, setIsAbbreviated] = useState(false);
  
  // Check window size and set abbreviated mode
  useEffect(() => {
    // Skip during SSR
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      const width = window.innerWidth;
      setIsAbbreviated(width < 768);
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <button
      onClick={onClick}
      className={`transition-colors py-2 px-2 md:px-4 rounded-md text-xs md:text-sm font-medium ${customClass} ${active ? 'active-button' : ''}`}
      style={{ 
        backgroundColor: active 
          ? 'rgba(0, 102, 204, 0.7)' 
          : disabled 
            ? 'rgba(200, 200, 200, 0.5)' 
            : 'rgba(124, 255, 218, 0.5)', 
        color: active ? 'white' : 'black',
        borderRadius: '7px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: active ? 'bold' : 'normal',
        boxShadow: active ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
      }}
      disabled={disabled}
    >
      {isAbbreviated ? abbreviatedText : text}
    </button>
  );
};

// Create the ActionButtonGroup component with client-side only rendering
const ActionButtonGroupInner = ({ triggerCameraAccess, isCompactMode, onActionClick }) => {
  // State for button actions
  const [randomTimes, setRandomTimes] = useState(1);
  const [delaySeconds, setDelaySeconds] = useState(3);
  const canvasRef = useRef(null);
  const [processStatus, setProcessStatus] = useState('');
  const [countdownValue, setCountdownValue] = useState(null);
  const [currentDot, setCurrentDot] = useState(null);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const [currentCalibrationIndex, setCurrentCalibrationIndex] = useState(0);
  const [remainingCaptures, setRemainingCaptures] = useState(0);
  const [showCanvas, setShowCanvas] = useState(false);
  
  // Track the capture count
  const [calibrationHandler, setCalibrationHandler] = useState(null);
  const [captureCount, setCaptureCount] = useState(1);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Toggle states
  const [showHeadPose, setShowHeadPose] = useState(false);
  const [showBoundingBox, setShowBoundingBox] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [showParameters, setShowParameters] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // const [calibrationHandler, setCalibrationHandler] = useState(null);

  // Update canvas dimensions when the component mounts or window resizes
  useEffect(() => {
    // Skip during SSR
    if (typeof window === 'undefined') return;
    
    const updateCanvasDimensions = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Set canvas dimensions to match its display size
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    
    if (canvasRef.current) {
      updateCanvasDimensions();
    }
    
    const handleResize = () => {
      if (canvasRef.current) {
        updateCanvasDimensions();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [showCanvas]);

  // Draw a dot on the canvas
  const drawDot = (x, y, color = 'red', radius = 5) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear previous dot if any
    clearCanvas();
    
    // Draw new dot
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Save current dot position
    setCurrentDot({ x, y });
  };

  // Clear the canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setCurrentDot(null);
  };

  // Generate a random position on the canvas
  const getRandomPosition = () => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    
    return {
      x: Math.floor(Math.random() * (width - 20)) + 10,
      y: Math.floor(Math.random() * (height - 20)) + 10
    };
  };

  // Countdown timer function
  const startCountdown = (count, onComplete) => {
    setIsCapturing(true);
    setCountdownValue(count);
    
    const countdownInterval = setInterval(() => {
      setCountdownValue(prev => {
        const newCount = prev - 1;
        
        if (newCount <= 0) {
          clearInterval(countdownInterval);
          setTimeout(() => {
            setCountdownValue('Capturing...');
            setTimeout(() => {
              setCountdownValue(null);
              if (onComplete) onComplete();
            }, 1000);
          }, 100);
          return 'Capturing...';
        }
        
        return newCount;
      });
    }, 800);
  };

  // Function to capture both screen and webcam images
  const captureImages = (x, y) => {
    // Generate filenames with zero-padded numbers
    const counter = String(captureCount).padStart(3, '0');
    const screenFilename = `screen_${counter}.jpg`;
    const webcamFilename = `webcam_${counter}.jpg`;
    
    // Capture the screen (canvas with the dot)
    const canvas = canvasRef.current;
    if (canvas) {
      const screenImage = canvas.toDataURL('image/png');
      console.log(`Saving screen capture as ${screenFilename}`);
      
      // In a real implementation, you would send this to a server endpoint
      if (typeof fetch === 'function') {
        fetch('/api/save-capture', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageData: screenImage,
            filename: screenFilename,
            type: 'screen',
            folder: `session_${new Date().toISOString().replace(/[:\.]/g, '-')}`
          })
        })
        .then(response => response.json())
        .then(data => {
          console.log('Screen save result:', data);
        })
        .catch(err => {
          console.error('Error saving screen image:', err);
        });
      }
    }
    
    // Capture the webcam frame
    if (window.HTMLVideoElement) {
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      tempCanvas.width = window.HTMLVideoElement.videoWidth;
      tempCanvas.height = window.HTMLVideoElement.videoHeight;
      ctx.drawImage(window.HTMLVideoElement, 0, 0, tempCanvas.width, tempCanvas.height);
      const webcamImage = tempCanvas.toDataURL('image/png');
      
      console.log(`Saving webcam capture as ${webcamFilename}`);
      // In a real implementation, you would send this to a server endpoint
      if (typeof fetch === 'function') {
        fetch('/api/save-capture', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageData: webcamImage,
            filename: webcamFilename,
            type: 'webcam',
            folder: `session_${new Date().toISOString().replace(/[:\.]/g, '-')}`
          })
        })
        .then(response => response.json())
        .then(data => {
          console.log('Webcam save result:', data);
        })
        .catch(err => {
          console.error('Error saving webcam image:', err);
        });
      }
    }
    
    // Increment the capture counter
    setCaptureCount(prevCount => prevCount + 1);
    
    // Update status
    setProcessStatus('Images captured and saved');
    
    // Show TopBar again after a brief delay
    setTimeout(() => {
      if (typeof onActionClick === 'function') {
        // Signal to parent to show the TopBar again
        onActionClick('toggleTopBar', true);
      }
    }, 1000);
    
    // Reset capturing state
    setIsCapturing(false);
  };

  // Handle Set Random button
  const handleSetRandom = () => {
    if (isCapturing) return;
    
    // Show canvas if not already visible
    setShowCanvas(true);
    
    // Get how many captures to do
    if (randomTimes <= 0) return;
    
    setRemainingCaptures(randomTimes);
    setProcessStatus(`Starting ${randomTimes} random captures...`);
    
    // Schedule a small delay to ensure canvas is visible and ready
    setTimeout(() => {
      // Start the sequence with first capture
      scheduleNextRandomCapture(randomTimes);
    }, 100);
  };

  // Schedule next random capture in sequence
  const scheduleNextRandomCapture = (remaining) => {
    if (remaining <= 0) {
      setProcessStatus('Random capture sequence completed');
      setRemainingCaptures(0);
      return;
    }
    
    setProcessStatus(`Capture ${randomTimes - remaining + 1} of ${randomTimes}`);
    setRemainingCaptures(remaining);
    
    // Generate random position and draw dot
    const { x, y } = getRandomPosition();
    drawDot(x, y);
    
    // Start countdown and then capture
    startCountdown(3, () => {
      captureImages(x, y);
      
      // Schedule next capture after delay
      setTimeout(() => {
        scheduleNextRandomCapture(remaining - 1);
      }, delaySeconds * 1000);
    });
  };

  // Random Dot Button - Draw a random dot and capture
  const handleRandomDot = () => {
    if (isCapturing) return;
    
    // Hide the TopBar before showing the dot
    if (typeof onActionClick === 'function') {
      onActionClick('toggleTopBar', false);
    }
    
    // Show canvas if not already visible
    setShowCanvas(true);
    
    // Schedule a small delay to ensure canvas is visible and ready
    setTimeout(() => {
      // Generate random position and draw dot
      const { x, y } = getRandomPosition();
      drawDot(x, y);
      
      // Start countdown and then capture
      startCountdown(3, () => {
        // Access the webcam
        triggerCameraAccess(true);
        
        // Wait briefly for camera to initialize
        setTimeout(() => {
          captureImages(x, y);
        }, 500);
      });
    }, 100);
  };
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setupCalibration = async () => {
      try {
        const [{ default: CalibrateHandler }, { generateCalibrationPoints }] = await Promise.all([
          import('./Action/CalibrateHandler'),
          import('./Action/CalibratePoints')
        ]);
    
        // ✅ FIX HERE — properly define canvas before using it
        const canvas = canvasRef.current;
        if (!canvas) {
          console.warn("Canvas not available during setupCalibration");
          return;
        }
    
        console.log('Canvas size:', canvas.width, canvas.height);
        const points = generateCalibrationPoints(canvas.width, canvas.height);
        console.log('Generated calibration points:', points);
    
        const calibrateHandler = new CalibrateHandler({
          canvasRef,
          calibrationPoints: points,
          toggleTopBar: (show) => onActionClick?.('toggleTopBar', show),
          setOutputText: (status) => {
            setProcessStatus(status);
            onStatusUpdate?.({ processStatus: status });
          },
          captureCounter: captureCount,
          setCaptureCounter: (newCounter) => {
            if (typeof newCounter === 'function') {
              setCaptureCount(prev => newCounter(prev));
            } else {
              setCaptureCount(newCounter);
            }
          },
          captureFolder: 'eye_tracking_captures',
          onComplete: () => {
            setIsCapturing(false);
            setProcessStatus('Calibration completed');
            onStatusUpdate?.({
              processStatus: 'Calibration completed',
              isCapturing: false
            });
          }
        });
    
        setCalibrationHandler({
          handleAction: async () => {
            setIsCapturing(true);
            setProcessStatus('Starting calibration...');
            await calibrateHandler.startCalibration();
            setIsCapturing(false);
          }
        });
    
      } catch (err) {
        console.error('Error initializing calibration:', err);
      }
    };

    setupCalibration();
  }, [canvasRef, captureCount, onActionClick]);

  // Generate calibration points based on canvas dimensions
  // This function should be properly referenced in both files.
  // Make sure this implementation is available in the appropriate scope

  // const generateCalibrationPoints = (canvas) => {
  //   if (!canvas) return [];
    
  //   const width = canvas.width;
  //   const height = canvas.height;
    
  //   // Helper function for rounding
  //   const conditionalRound = (dimension, percentage) => {
  //     return Math.round(dimension * percentage);
  //   };
    
  //   // Define percentage values for outer and inner frames
  //   const firstFramePercentage = 0.12;  // Outer frame at 12% from edges
  //   const secondFramePercentage = 0.26; // Inner frame at 26% from edges
    
  //   // Calculate points for outer frame (first frame)
  //   const xLeftFirst = conditionalRound(width, firstFramePercentage);
  //   const xRightFirst = width - conditionalRound(width, firstFramePercentage);
  //   const yTopFirst = conditionalRound(height, firstFramePercentage);
  //   const yBottomFirst = height - conditionalRound(height, firstFramePercentage);
    
  //   // Calculate points for inner frame (second frame)
  //   const xLeftSecond = conditionalRound(width, secondFramePercentage);
  //   const xRightSecond = width - conditionalRound(width, secondFramePercentage);
  //   const yTopSecond = conditionalRound(height, secondFramePercentage);
  //   const yBottomSecond = height - conditionalRound(height, secondFramePercentage);
    
  //   // Return array of points in specific order
  //   return [
  //     // First frame - outer points
  //     { x: xLeftFirst, y: yTopFirst, label: "Outer Top-Left" },
  //     { x: Math.floor(width / 2), y: yTopFirst, label: "Outer Top-Center" },
  //     { x: xRightFirst, y: yTopFirst, label: "Outer Top-Right" },
  //     { x: xLeftFirst, y: Math.floor(height / 2), label: "Outer Middle-Left" },
  //     { x: xRightFirst, y: Math.floor(height / 2), label: "Outer Middle-Right" },
  //     { x: xLeftFirst, y: yBottomFirst, label: "Outer Bottom-Left" },
  //     { x: Math.floor(width / 2), y: yBottomFirst, label: "Outer Bottom-Center" },
  //     { x: xRightFirst, y: yBottomFirst, label: "Outer Bottom-Right" },
      
  //     // Second frame - inner points
  //     { x: xLeftSecond, y: yTopSecond, label: "Inner Top-Left" },
  //     { x: Math.floor(width / 2), y: yTopSecond, label: "Inner Top-Center" },
  //     { x: xRightSecond, y: yTopSecond, label: "Inner Top-Right" },
  //     { x: xLeftSecond, y: Math.floor(height / 2), label: "Inner Middle-Left" },
  //     { x: xRightSecond, y: Math.floor(height / 2), label: "Inner Middle-Right" },
  //     { x: xLeftSecond, y: yBottomSecond, label: "Inner Bottom-Left" },
  //     { x: Math.floor(width / 2), y: yBottomSecond, label: "Inner Bottom-Center" },
  //     { x: xRightSecond, y: yBottomSecond, label: "Inner Bottom-Right" }
  //   ];
  // };
  // ✅ Full fixed version of handleSetCalibrate in actionButton.js
  const waitForCanvasReady = async (checkVisible, maxTries = 15, interval = 100) => {
    for (let i = 0; i < maxTries; i++) {
      const canvas = canvasRef.current;
      if (canvas && canvas.width > 0 && canvas.height > 0 && checkVisible()) {
        return canvas;
      }
      await new Promise(res => setTimeout(res, interval));
    }
    throw new Error("Canvas is not ready after multiple attempts");
  };
  // In actionButton.js - Simple fix to hide top bar immediately

  // In actionButton.js - Update handleSetCalibrate to hide the TopBar immediately

  const handleSetCalibrate = async () => {
    if (isCapturing) return;

    try {
      // IMMEDIATELY hide the TopBar at the start
      if (typeof onActionClick === 'function') {
        onActionClick('toggleTopBar', false);
      } else if (typeof window !== 'undefined' && window.toggleTopBar) {
        window.toggleTopBar(false);
      }
      
      setIsCapturing(true);
      setProcessStatus("Starting calibration sequence...");
      
      // Check if WhiteScreenMain's calibration action is available
      if (typeof window !== 'undefined' && window.whiteScreenActions && window.whiteScreenActions.calibrate) {
        // Use WhiteScreenMain's calibration - this will handle everything including dot display
        console.log("Using WhiteScreenMain's calibration action");
        window.whiteScreenActions.calibrate();
      } else {
        // Fallback message if WhiteScreenMain isn't available
        console.log("WhiteScreenMain actions not available");
        setProcessStatus("WhiteScreenMain not available for calibration");
        
        // Show TopBar again after a delay
        setTimeout(() => {
          setIsCapturing(false);
          if (typeof onActionClick === 'function') {
            onActionClick('toggleTopBar', true);
          } else if (typeof window !== 'undefined' && window.toggleTopBar) {
            window.toggleTopBar(true);
          }
        }, 2000);
      }
    } catch (error) {
      console.error("Calibration error:", error);
      setProcessStatus(`Calibration error: ${error.message}`);
      setIsCapturing(false);
      
      // Show TopBar again on error
      if (typeof onActionClick === 'function') {
        onActionClick('toggleTopBar', true);
      } else if (typeof window !== 'undefined' && window.toggleTopBar) {
        window.toggleTopBar(true);
      }
    }
  };
  // const handleSetCalibrate = async () => {
  //   if (isCapturing) return;
  
  //   try {
  //     console.log("🔁 Waiting for canvas...");
  //     const canvas = await waitForCanvasReady(() => canvasVisible);
  
  //     console.log("✅ Canvas ready:", canvas.width, canvas.height);
  
  //     // Hide top bar before starting
  //     onActionClick?.('toggleTopBar', false);
  //     setIsCapturing(true);
  //     setProcessStatus("Starting calibration sequence...");
  
  //     // Import calibration logic
  //     const [{ default: CalibrateHandler }, { generateCalibrationPoints }] = await Promise.all([
  //       import('./Action/CalibrateHandler'),
  //       import('./Action/CalibratePoints')
  //     ]);
  
  //     // Generate calibration points
  //     const points = generateCalibrationPoints(canvas.width, canvas.height);
  //     if (!points || points.length === 0) {
  //       throw new Error("Failed to generate calibration points");
  //     }
  
  //     const calibrateHandler = new CalibrateHandler({
  //       canvasRef,
  //       calibrationPoints: points,
  //       toggleTopBar: (show) => onActionClick?.('toggleTopBar', show),
  //       setOutputText: setProcessStatus,
  //       captureCounter: captureCount,
  //       setCaptureCounter: setCaptureCount,
  //       captureFolder: 'eye_tracking_captures',
  //       onComplete: () => {
  //         setIsCapturing(false);
  //         setProcessStatus("Calibration completed");
  //         onActionClick?.('toggleTopBar', true);
  //       }
  //     });
  
  //     await calibrateHandler.startCalibration();
  
  //   } catch (err) {
  //     console.error("Calibration error:", err);
  //     setProcessStatus(`Calibration error: ${err.message}`);
  //     setIsCapturing(false);
  //     onActionClick?.('toggleTopBar', true);
  //   }
  // };

  // Function to handle the calibration sequence
  const startCalibrationSequence = async (statusIndicator) => {
    try {
      // Get canvas reference
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error("Canvas not available");
      }
      
      // Generate calibration points using the imported function (already available in your code)
      const points = generateCalibrationPoints(canvas.width, canvas.height);
      
      if (!points || points.length === 0) {
        throw new Error("Failed to generate calibration points");
      }
      
      // Update status
      setProcessStatus(`Starting calibration with ${points.length} points`);
      setRemainingCaptures(points.length);
      
      // Process each point in sequence
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        
        // Update status
        statusIndicator.textContent = `Calibrate Set Active: Processing point ${i + 1}/${points.length}`;
        setProcessStatus(`Calibration point ${i + 1}/${points.length}`);
        setRemainingCaptures(points.length - i);
        
        // Draw the dot
        drawDot(point.x, point.y, 'red', 8);
        
        // Set current dot for UI updates
        setCurrentDot(point);
        
        // Create countdown element
        const countdownElement = createCountdownElement(point, canvas);
        
        // Run 3-2-1 countdown
        for (let count = 3; count > 0; count--) {
          countdownElement.textContent = count;
          statusIndicator.textContent = `Calibrate Set Active: countdown ${count} (${i+1}/${points.length})`;
          setProcessStatus(`Calibration point ${i+1}/${points.length} - countdown ${count}`);
          setCountdownValue(count);
          
          // Wait for next countdown step
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        // Show capturing indicator
        countdownElement.textContent = "✓";
        statusIndicator.textContent = `Capturing point ${i+1}/${points.length}`;
        setCountdownValue("Capturing...");
        
        // Remove countdown element after a short delay
        setTimeout(() => {
          if (countdownElement.parentNode) {
            countdownElement.parentNode.removeChild(countdownElement);
          }
        }, 300);
        
        // Capture images at this point
        await captureImagesAtPoint(point);
        
        // Wait for preview to complete
        await new Promise(resolve => setTimeout(resolve, 2300));
      }
      
      // Calibration complete
      statusIndicator.textContent = 'Calibration completed';
      setProcessStatus('Calibration completed');
      setRemainingCaptures(0);
      
    } catch (error) {
      console.error('Error during calibration:', error);
      setProcessStatus(`Calibration error: ${error.message}`);
      
      if (statusIndicator) {
        statusIndicator.textContent = `Error: ${error.message}`;
      }
    } finally {
      setIsCapturing(false);
      setCountdownValue(null);
      
      // Show TopBar again
      if (typeof onActionClick === 'function') {
        onActionClick('toggleTopBar', true);
      }
      
      // Remove status indicator after a delay
      setTimeout(() => {
        if (statusIndicator && statusIndicator.parentNode) {
          statusIndicator.parentNode.removeChild(statusIndicator);
        }
      }, 3000);
    }
  };

  // Helper function to create countdown element
  const createCountdownElement = (point, canvas) => {
    // Remove any existing countdown elements
    const existingElements = document.querySelectorAll('.calibrate-countdown');
    existingElements.forEach(el => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    
    // Get canvas position relative to viewport
    const canvasRect = canvas.getBoundingClientRect();
    
    // Calculate absolute position
    const absoluteX = canvasRect.left + point.x;
    const absoluteY = canvasRect.top + point.y;
    
    // Create countdown element
    const element = document.createElement('div');
    element.className = 'calibrate-countdown';
    element.style.cssText = `
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
    
    document.body.appendChild(element);
    return element;
  };

  // Capture images at a specific point
  const captureImagesAtPoint = async (point) => {
    try {
      // Format counter for filenames 
      const counter = String(captureCount).padStart(3, '0');
      const screenFilename = `screen_${counter}.jpg`;
      const webcamFilename = `webcam_${counter}.jpg`;
      const parameterFilename = `parameter_${counter}.csv`;
      
      // Capture the screen (canvas with the dot)
      const canvas = canvasRef.current;
      let screenImage = null;
      
      if (canvas) {
        screenImage = canvas.toDataURL('image/png');
        console.log(`Saving screen capture as ${screenFilename}`);
        
        // Save via API
        const screenResponse = await fetch('/api/save-capture', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageData: screenImage,
            filename: screenFilename,
            type: 'screen',
            folder: `eye_tracking_captures`
          })
        });
        
        const screenResult = await screenResponse.json();
        console.log('Screen save result:', screenResult);
      }
      
      // Capture the webcam frame if available
      let webcamImage = null;
      
      // Look for videoElement on window or in document
      const videoElement = window.videoElement || document.querySelector('video');
      
      if (videoElement) {
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        tempCanvas.width = videoElement.videoWidth;
        tempCanvas.height = videoElement.videoHeight;
        ctx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
        webcamImage = tempCanvas.toDataURL('image/png');
        
        console.log(`Saving webcam capture as ${webcamFilename}`);
        // Save via API
        const webcamResponse = await fetch('/api/save-capture', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageData: webcamImage,
            filename: webcamFilename,
            type: 'webcam',
            folder: `eye_tracking_captures`
          })
        });
        
        const webcamResult = await webcamResponse.json();
        console.log('Webcam save result:', webcamResult);
      } else {
        // Try to silently capture webcam
        try {
          // Create temporary stream
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: false 
          });
          
          // Create hidden video
          const tempVideo = document.createElement('video');
          tempVideo.autoplay = true;
          tempVideo.playsInline = true;
          tempVideo.muted = true;
          tempVideo.style.position = 'absolute';
          tempVideo.style.left = '-9999px';
          tempVideo.style.opacity = '0';
          document.body.appendChild(tempVideo);
          
          // Set stream
          tempVideo.srcObject = stream;
          
          // Wait for video
          await new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
              console.warn("Video loading timed out, continuing anyway");
              resolve();
            }, 1000);
            
            tempVideo.onloadeddata = () => {
              clearTimeout(timeoutId);
              resolve();
            };
          });
          
          // Short delay
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Capture frame
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = tempVideo.videoWidth || 640;
          tempCanvas.height = tempVideo.videoHeight || 480;
          const ctx = tempCanvas.getContext('2d');
          
          ctx.drawImage(tempVideo, 0, 0, tempCanvas.width, tempCanvas.height);
          webcamImage = tempCanvas.toDataURL('image/png');
          
          // Save webcam image
          const webcamResponse = await fetch('/api/save-capture', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              imageData: webcamImage,
              filename: webcamFilename,
              type: 'webcam',
              folder: `eye_tracking_captures`
            })
          });
          
          const webcamResult = await webcamResponse.json();
          console.log('Webcam save result:', webcamResult);
          
          // Clean up
          stream.getTracks().forEach(track => track.stop());
          tempVideo.srcObject = null;
          if (tempVideo.parentNode) {
            tempVideo.parentNode.removeChild(tempVideo);
          }
        } catch (webcamError) {
          console.error("Error capturing webcam:", webcamError);
        }
      }
      
      // Save parameters CSV
      try {
        // Create CSV content
        const csvData = [
          "name,value",
          `dot_x,${point.x}`,
          `dot_y,${point.y}`,
          `canvas_width,${canvas ? canvas.width : 0}`,
          `canvas_height,${canvas ? canvas.height : 0}`,
          `window_width,${window.innerWidth}`,
          `window_height,${window.innerHeight}`,
          `calibration_point_label,${point.label || ''}`,
          `timestamp,${new Date().toISOString()}`
        ].join('\n');
        
        // Convert to data URL
        const csvBlob = new Blob([csvData], { type: 'text/csv' });
        const csvReader = new FileReader();
        
        const csvDataUrl = await new Promise((resolve) => {
          csvReader.onloadend = () => resolve(csvReader.result);
          csvReader.readAsDataURL(csvBlob);
        });
        
        // Save CSV
        const csvResponse = await fetch('/api/save-capture', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageData: csvDataUrl,
            filename: parameterFilename,
            type: 'parameters',
            folder: `eye_tracking_captures`
          })
        });
        
        const csvResult = await csvResponse.json();
        console.log('Parameter save result:', csvResult);
      } catch (csvError) {
        console.error("Error saving parameters:", csvError);
      }
      
      // Increment counter
      setCaptureCount(prevCount => prevCount + 1);
      
      // Show preview
      showCapturePreview(screenImage, webcamImage, point);
      
    } catch (error) {
      console.error("Error capturing images:", error);
      throw error;
    }
  };

  // Show preview of captured images
  const showCapturePreview = (screenImage, webcamImage, point) => {
    if (!screenImage && !webcamImage) return;
    
    // Remove any existing previews
    const existingPreviews = document.querySelectorAll('.capture-preview-container');
    existingPreviews.forEach(preview => {
      if (preview.parentNode) {
        preview.parentNode.removeChild(preview);
      }
    });
    
    // Create preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'capture-preview-container';
    previewContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      gap: 20px;
      background-color: rgba(0, 0, 0, 0.85);
      padding: 20px;
      border-radius: 12px;
      z-index: 999999;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6);
    `;
    
    // Add screen image if available
    if (screenImage) {
      const screenPreview = document.createElement('div');
      screenPreview.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
      `;
      
      const screenImg = document.createElement('img');
      screenImg.src = screenImage;
      screenImg.alt = 'Screen Capture';
      screenImg.style.cssText = `
        max-width: 320px;
        max-height: 240px;
        border: 3px solid white;
        border-radius: 8px;
        background-color: #333;
      `;
      
      const screenLabel = document.createElement('div');
      screenLabel.textContent = 'Screen Capture';
      screenLabel.style.cssText = `
        color: white;
        font-size: 14px;
        margin-top: 10px;
        font-weight: bold;
      `;
      
      screenPreview.appendChild(screenImg);
      screenPreview.appendChild(screenLabel);
      previewContainer.appendChild(screenPreview);
    }
    
    // Add webcam image if available
    if (webcamImage) {
      const webcamPreview = document.createElement('div');
      webcamPreview.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
      `;
      
      const webcamImg = document.createElement('img');
      webcamImg.src = webcamImage;
      webcamImg.alt = 'Webcam Capture';
      webcamImg.style.cssText = `
        max-width: 320px;
        max-height: 240px;
        border: 3px solid white;
        border-radius: 8px;
        background-color: #333;
      `;
      
      const webcamLabel = document.createElement('div');
      webcamLabel.textContent = 'Webcam Capture';
      webcamLabel.style.cssText = `
        color: white;
        font-size: 14px;
        margin-top: 10px;
        font-weight: bold;
      `;
      
      webcamPreview.appendChild(webcamImg);
      webcamPreview.appendChild(webcamLabel);
      previewContainer.appendChild(webcamPreview);
    }
    
    // Add point info
    if (point) {
      const pointInfo = document.createElement('div');
      pointInfo.textContent = point.label ? 
        `${point.label}: x=${Math.round(point.x)}, y=${Math.round(point.y)}` :
        `Point: x=${Math.round(point.x)}, y=${Math.round(point.y)}`;
        
      pointInfo.style.cssText = `
        color: #ffcc00;
        font-size: 14px;
        position: absolute;
        top: -40px;
        left: 0;
        width: 100%;
        text-align: center;
      `;
      previewContainer.appendChild(pointInfo);
    }
    
    // Add timer
    const timerElement = document.createElement('div');
    timerElement.textContent = '2.0s';
    timerElement.style.cssText = `
      position: absolute;
      bottom: -25px;
      right: 20px;
      color: white;
      font-size: 12px;
      background-color: rgba(0, 0, 0, 0.7);
      padding: 3px 8px;
      border-radius: 4px;
    `;
    previewContainer.appendChild(timerElement);
    
    // Add to document
    document.body.appendChild(previewContainer);
    
    // Countdown
    let timeLeft = 2.0;
    const interval = setInterval(() => {
      timeLeft -= 0.1;
      if (timeLeft <= 0) {
        clearInterval(interval);
        previewContainer.style.opacity = '0';
        previewContainer.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
          if (previewContainer.parentNode) {
            previewContainer.parentNode.removeChild(previewContainer);
          }
        }, 300);
      } else {
        timerElement.textContent = `${timeLeft.toFixed(1)}s`;
      }
    }, 100);
    
    // Safety cleanup
    setTimeout(() => {
      if (previewContainer.parentNode) {
        previewContainer.parentNode.removeChild(previewContainer);
      }
    }, 5000);
  };

  // Move to next calibration point
  const moveToNextCalibrationPoint = () => {
    const nextIndex = currentCalibrationIndex + 1;
    
    // Check if we've completed all points
    if (nextIndex >= calibrationPoints.length) {
      setProcessStatus('Calibration completed');
      setRemainingCaptures(0);
      return;
    }
    
    // Update state
    setCurrentCalibrationIndex(nextIndex);
    setProcessStatus(`Calibration ${nextIndex + 1}/${calibrationPoints.length}`);
    setRemainingCaptures(calibrationPoints.length - nextIndex);
    
    // Draw next point
    const nextPoint = calibrationPoints[nextIndex];
    drawDot(nextPoint.x, nextPoint.y);
    
    // Start countdown for this point
    startCountdown(3, () => {
      captureImages(nextPoint.x, nextPoint.y);
      setTimeout(() => moveToNextCalibrationPoint(), 1000);
    });
  };

  // Clear All Button - Reset everything
  const handleClearAll = () => {
    clearCanvas();
    setProcessStatus('');
    setRemainingCaptures(0);
    setIsCapturing(false);
    setCountdownValue(null);
    setShowCanvas(false);
  };

  // Toggle Head Pose visualization
  const handleToggleHeadPose = () => {
    const newHeadPoseState = !showHeadPose;
    setShowHeadPose(newHeadPoseState);
    setProcessStatus(`Head pose visualization ${newHeadPoseState ? 'enabled' : 'disabled'}`);
    
    // Call the parent handler to update processor options
    if (onActionClick) {
      onActionClick('headPose');
    }
    
    // Update videoProcessor options directly if available
    if (typeof window !== 'undefined' && window.videoProcessor) {
      window.videoProcessor.updateOptions({
        showHeadPose: newHeadPoseState
      });
      console.log(`Updated backend head pose: ${newHeadPoseState}`);
    }
  };

  // Toggle Bounding Box visualization
  const handleToggleBoundingBox = () => {
    const newBoundingBoxState = !showBoundingBox;
    setShowBoundingBox(newBoundingBoxState);
    setProcessStatus(`Bounding box ${newBoundingBoxState ? 'shown' : 'hidden'}`);
    
    // Call the parent handler to update processor options
    if (onActionClick) {
      onActionClick('boundingBox');
    }
    
    // Update videoProcessor options directly if available
    if (typeof window !== 'undefined' && window.videoProcessor) {
      window.videoProcessor.updateOptions({
        showBoundingBox: newBoundingBoxState
      });
      console.log(`Updated backend bounding box: ${newBoundingBoxState}`);
    }
  };

  // Toggle Mask visualization
  const handleToggleMask = () => {
    const newMaskState = !showMask;
    setShowMask(newMaskState);
    setProcessStatus(`Mask ${newMaskState ? 'shown' : 'hidden'}`);
    
    // Call the parent handler to update processor options
    if (onActionClick) {
      onActionClick('mask');
    }
    
    // Update videoProcessor options directly if available
    if (typeof window !== 'undefined' && window.videoProcessor) {
      window.videoProcessor.updateOptions({
        showMask: newMaskState
      });
      console.log(`Updated backend mask: ${newMaskState}`);
    }
  };

  // Toggle Parameters display
  const handleToggleParameters = () => {
    const newParametersState = !showParameters;
    setShowParameters(newParametersState);
    setProcessStatus(`Parameters ${newParametersState ? 'shown' : 'hidden'}`);
    
    // Call the parent handler to update processor options
    if (onActionClick) {
      onActionClick('parameters');
    }
    
    // Update videoProcessor options directly if available
    if (typeof window !== 'undefined' && window.videoProcessor) {
      window.videoProcessor.updateOptions({
        showParameters: newParametersState
      });
      console.log(`Updated backend parameters: ${newParametersState}`);
    }
  };

  // Toggle camera preview
  const handleToggleCamera = () => {
    const newCameraState = !isCameraActive;
    setIsCameraActive(newCameraState);
    
    // Call the parent handler with 'preview' action
    if (onActionClick) {
      onActionClick('preview');
    } else {
      // Fallback to direct trigger if no action handler
      triggerCameraAccess();
    }
    
    // If turning on camera, ensure we apply current visualization settings
    if (newCameraState && typeof window !== 'undefined' && window.videoProcessor) {
      window.videoProcessor.updateOptions({
        showHeadPose,
        showBoundingBox,
        showMask,
        showParameters
      });
      console.log("Applied visualization settings to camera");
    }
  };

  // Button configurations with both full and abbreviated text
  const buttons = [
    { 
      text: "Set Random", 
      abbreviatedText: "SRandom", 
      onClick: handleSetRandom,
      disabled: isCapturing
    },
    { 
      text: "Random Dot", 
      abbreviatedText: "Random", 
      onClick: handleRandomDot,
      disabled: isCapturing 
    },
    { 
      text: "Set Calibrate", 
      abbreviatedText: "Calibrate", 
      onClick: handleSetCalibrate,
      disabled: isCapturing 
    },
    { 
      text: "Clear All", 
      abbreviatedText: "Clear", 
      onClick: handleClearAll
    },
    { divider: true },
    { 
      text: "Draw Head pose", 
      abbreviatedText: "Head pose", 
      onClick: handleToggleHeadPose,
      active: showHeadPose
    },
    { 
      text: "Show Bounding Box", 
      abbreviatedText: "☐ Box", 
      onClick: handleToggleBoundingBox,
      active: showBoundingBox
    },
    { 
      text: isCameraActive ? "Stop Camera" : "Show Preview", 
      abbreviatedText: isCameraActive ? "Stop" : "Preview", 
      onClick: handleToggleCamera,
      active: isCameraActive
    },
    { 
      text: "😷 Show Mask", 
      abbreviatedText: "😷 Mask", 
      onClick: handleToggleMask,
      active: showMask
    },
    { 
      text: "Parameters", 
      abbreviatedText: "Values", 
      onClick: handleToggleParameters,
      active: showParameters
    }
  ];

  // Mobile layout - 2x5 grid
  return (
    <div>
      {isCompactMode ? (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {buttons.filter(b => !b.divider).map((button, index) => (
            <ActionButton 
              key={index}
              text={button.text}
              abbreviatedText={button.abbreviatedText}
              onClick={button.onClick}
              disabled={button.disabled}
              active={button.active}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <ActionButton 
              text="Set Random"
              abbreviatedText="SRandom" 
              onClick={handleSetRandom}
              disabled={isCapturing}
            />
            <ActionButton 
              text="Random Dot"
              abbreviatedText="Random" 
              onClick={handleRandomDot}
              disabled={isCapturing}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton 
              text="Set Calibrate"
              abbreviatedText="Calibrate" 
              onClick={handleSetCalibrate}
              disabled={isCapturing}
            />
            <ActionButton 
              text="Clear All"
              abbreviatedText="Clear" 
              onClick={handleClearAll}
            />
          </div>
          
          <hr className="my-3 border-gray-200" />
          
          <div className="grid grid-cols-2 gap-2">
            <ActionButton 
              text="Draw Head pose"
              abbreviatedText="Head pose" 
              onClick={handleToggleHeadPose}
              active={showHeadPose}
            />
            <ActionButton 
              text="Show Bounding Box"
              abbreviatedText="☐ Box" 
              onClick={handleToggleBoundingBox}
              active={showBoundingBox}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton 
              text={isCameraActive ? "Stop Camera" : "Show Preview"}
              abbreviatedText={isCameraActive ? "Stop" : "Preview"}
              onClick={handleToggleCamera}
              active={isCameraActive}
            />
            <ActionButton 
              text="😷 Show Mask"
              abbreviatedText="😷 Mask" 
              onClick={handleToggleMask}
              active={showMask}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton 
              text="Parameters"
              abbreviatedText="Values" 
              onClick={handleToggleParameters}
              active={showParameters}
            />
            <div></div> {/* Empty space for alignment */}
          </div>
        </div>
      )}
      
      {/* Status display for calibration and random sequence */}
      {(processStatus || remainingCaptures > 0 || countdownValue) && (
        <div className="status-display mt-4 p-2 bg-blue-50 rounded-md">
          {processStatus && (
            <div className="text-sm font-medium text-blue-800">{processStatus}</div>
          )}
          {remainingCaptures > 0 && (
            <div className="text-sm font-medium text-yellow-600">Remaining: {remainingCaptures}</div>
          )}
          {countdownValue && (
            <div className="text-2xl font-bold text-red-600">{countdownValue}</div>
          )}
        </div>
      )}
      
      {/* Canvas for drawing dots */}
      {showCanvas && (
        <div className="canvas-container mt-4" style={{ position: 'relative', width: '100%', height: '40vh', minHeight: '300px', border: '1px solid #e0e0e0', backgroundColor: 'white', borderRadius: '4px', overflow: 'hidden' }}>
          <canvas 
            ref={canvasRef}
            className="tracking-canvas"
            style={{ width: '100%', height: '100%' }}
          />
          
          {/* Overlay for countdown on dot */}
          {countdownValue && currentDot && (
            <div 
              className="dot-countdown"
              style={{
                position: 'absolute',
                left: `${currentDot.x - 15}px`,
                top: `${currentDot.y - 40}px`,
                color: 'red',
                fontSize: '28px',
                fontWeight: 'bold'
              }}
            >
              {countdownValue}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Create a client-only version of ActionButtonGroup
const ActionButtonGroup = dynamic(() => Promise.resolve(ActionButtonGroupInner), { ssr: false });

export { ActionButton, ActionButtonGroup };