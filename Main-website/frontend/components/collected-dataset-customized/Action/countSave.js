// Fixed countSave.js - Resolving redrawInterval reference error
// Shared functionality for countdown and image capture processes
import { captureImagesAtPoint } from '../Helper/savefile';

/**
 * Creates and displays a countdown element above a dot position
 * @param {Object} position - {x, y} position of the dot
 * @param {DOMRect} canvasRect - getBoundingClientRect() of the canvas
 * @returns {HTMLElement} - The created countdown element
 */
export const createCountdownElement = (position, canvasRect) => {
  if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
    console.warn('[createCountdownElement] Invalid position:', position);
    return null;
  }

  const existingCountdowns = document.querySelectorAll('.calibrate-countdown, .forced-countdown, .center-countdown-backup');
  existingCountdowns.forEach(el => el.remove());

  const absoluteX = canvasRect.left + position.x;
  const absoluteY = canvasRect.top + position.y;

  const countdownElement = document.createElement('div');
  countdownElement.className = 'dot-countdown';
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
  return countdownElement;
};

/**
 * Display a preview of the captured images
 * @param {string} screenImage - Data URL of the screen image
 * @param {string} webcamImage - Data URL of the webcam image
 * @param {Object} point - {x, y} position of the dot
 */
export const showCapturePreview = (screenImage, webcamImage, point) => {
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

/**
 * Runs a countdown process that displays 3-2-1 above a dot
 * @param {Object} position - {x, y} position of the dot
 * @param {HTMLCanvasElement} canvas - Canvas element with the dot
 * @param {Function} onStatusUpdate - Function to update status messages
 * @param {Function} onComplete - Callback to execute when countdown completes
 */
export const runCountdown = async (position, canvas, onStatusUpdate, onComplete) => {
  if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
    console.warn('[runCountdown] Invalid position:', position);
    onStatusUpdate?.({
      processStatus: "Invalid dot position",
      countdownValue: null,
      isCapturing: false
    });
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const countdownElement = createCountdownElement(position, canvasRect);
  
  if (!countdownElement) {
    console.warn('[runCountdown] Countdown element could not be created.');
    return;
  }

  const ctx = canvas.getContext('2d');
  drawRedDot(ctx, position.x, position.y);

  let count = 3;
  countdownElement.textContent = count;

  onStatusUpdate?.({
    processStatus: "Countdown",
    countdownValue: count,
    isCapturing: true
  });

  // Create redrawInterval for keeping dot visible during countdown
  let redrawInterval = setInterval(() => {
    drawRedDot(ctx, position.x, position.y, 12, false);
  }, 200);

  return new Promise((resolve) => {
    const countdownInterval = setInterval(() => {
      count--;

      if (count <= 0) {
        clearInterval(countdownInterval);
        countdownElement.textContent = "✓";

        onStatusUpdate?.({
          countdownValue: "Capturing...",
          processStatus: "Capturing image...",
          isCapturing: true
        });

        setTimeout(() => {
          if (countdownElement.parentNode) {
            countdownElement.parentNode.removeChild(countdownElement);
          }
          drawRedDot(ctx, position.x, position.y, 12, false);

          // Clear the redrawInterval we defined above
          if (redrawInterval) {
            clearInterval(redrawInterval);
          }

          if (onComplete) {
            drawRedDot(ctx, position.x, position.y, 12, false);
            onComplete();
          }
          resolve();
        }, 300);
      } else {
        countdownElement.textContent = count;

        onStatusUpdate?.({
          processStatus: "Countdown",
          countdownValue: count,
          isCapturing: true
        });
      }
    }, 800);
  });
};

/**
 * Draw a red dot on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Dot radius
 * @param {boolean} clearCanvas - Whether to clear the canvas before drawing (default: true)
 * @returns {Object} - {x, y} position
 */
export const drawRedDot = (ctx, x, y, radius = 12, clearCanvas = true) => {
  const canvas = ctx.canvas;
  
  // Clear the canvas if requested (default behavior)
  if (clearCanvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  // Draw the dot with a bright red color
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'red';
  ctx.fill();
  
  // Add glow effect for better visibility
  ctx.beginPath();
  ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Add a second larger glow for even better visibility
  ctx.beginPath();
  ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  return { x, y };
};

/**
 * Capture images at a specific point
 * @param {Object} options - Capture options
 * @returns {Promise} - Promise that resolves with the capture result
 */
export const captureImages = async (options) => {
    const {
      canvasRef,
      position,
      captureCounter, 
      setCaptureCounter,
      setProcessStatus,
      toggleTopBar,
      captureFolder = 'eye_tracking_captures'
    } = options;
  
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      console.warn('[captureImages] Invalid position object:', position);
      setProcessStatus?.('Error: Invalid capture position');
      return null;
    }
  
    try {
      // Get highest resolution constraints
      const constraints = await getHighestResolutionConstraints();
      console.log('Using camera constraints:', constraints);
      
      // Get a new stream with the highest resolution
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      console.log('Actual camera settings:', settings);
      
      // Update video element with new stream
      const videoElement = window.videoElement || document.querySelector('video');
      if (videoElement) {
        videoElement.srcObject = stream;
        await videoElement.play();
      }
      
      // Call the captureImagesAtPoint with all necessary parameters
      const result = await captureImagesAtPoint({
        point: position,
        captureCount: captureCounter,
        canvasRef, 
        setCaptureCount: setCaptureCounter,
        showCapturePreview
      });
  
      console.log('Capture successful with ID:', result.captureId);
      
      // Clean up the stream
      stream.getTracks().forEach(track => track.stop());
      
      return {
        screenImage: result?.screenImage || '',
        webcamImage: result?.webcamImage || '',
        success: true,
        captureId: result?.captureId,
        resolution: {
          width: settings.width,
          height: settings.height
        }
      };
    } catch (err) {
      console.error('[captureImages] Unexpected error:', err);
      setProcessStatus?.(`Error: ${err.message}`);
      return {
        screenImage: '',
        webcamImage: '',
        success: false,
        error: err.message
      };
    }
  };

/**
 * Generate a random dot position within the canvas
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {number} padding - Padding from the edges
 * @returns {Object} - {x, y} position
 */
export const getRandomPosition = (canvas, padding = 40) => {
  if (!canvas) return { x: 100, y: 100 }; // Fallback position
  
  const width = canvas.width || 400;  // Fallback if width is 0
  const height = canvas.height || 300; // Fallback if height is 0
  
  return {
    x: Math.floor(Math.random() * (width - 2 * padding)) + padding,
    y: Math.floor(Math.random() * (height - 2 * padding)) + padding
  };
};

/**
 * Special calibration capture function that avoids problematic code paths
 * @param {Object} options - All the calibration options
 * @returns {Promise<Object>} Result object with captured data
 */
/**
 * Special calibration capture function that behaves like random dot capture
 * @param {Object} options - All the calibration options
 * @returns {Promise<Object>} Result object with captured data
 */
export const calibrationCapture = async (options) => {
    const {
      canvasRef,
      point,
      captureCounter,
      setCaptureCounter,
      setProcessStatus,
      toggleTopBar,
      captureFolder = 'eye_tracking_captures',
      pointIndex,
      totalPoints
    } = options;
  
    try {
      console.log(`Starting calibration capture for point ${pointIndex + 1}/${totalPoints}`);
      
      // Get canvas
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error("Canvas reference is null in calibrationCapture");
        setProcessStatus?.(`Error: Canvas not available`);
        return { success: false };
      }
  
      // Use the exact same drawing method as random dots
      const ctx = canvas.getContext('2d');
      drawRedDot(ctx, point.x, point.y);
  
      setProcessStatus?.(`Calibration point ${pointIndex + 1}/${totalPoints}`);
  
      // Use the same countdown element creation method
      const canvasRect = canvas.getBoundingClientRect();
      const countdownElement = createCountdownElement(point, canvasRect);
      
      if (!countdownElement) {
        console.error("Failed to create countdown element");
        return { success: false };
      }
  
      // Create a redrawInterval for keeping the dot visible
      let redrawInterval = setInterval(() => {
        drawRedDot(ctx, point.x, point.y, 12, false);
      }, 200);
  
      // Run the same countdown as random dot
      for (let count = 3; count > 0; count--) {
        countdownElement.textContent = count;
        setProcessStatus?.(`Point ${pointIndex + 1}/${totalPoints} - countdown ${count}`);
        
        // Redraw the dot at each step to ensure it remains visible
        drawRedDot(ctx, point.x, point.y, 12, false);
        
        await new Promise(resolve => setTimeout(resolve, 800));
      }
  
      // Show checkmark
      countdownElement.textContent = "✓";
      
      // Remove countdown element
      setTimeout(() => {
        if (countdownElement.parentNode) {
          countdownElement.parentNode.removeChild(countdownElement);
        }
        
        // Clear redrawInterval
        if (redrawInterval) {
          clearInterval(redrawInterval);
        }
      }, 300);
  
      // Use captureAndPreviewProcess instead of directly calling captureImagesAtPoint
      const captureResult = await captureAndPreviewProcess({
        canvasRef,
        position: point,
        captureCounter,
        setCaptureCounter,
        setProcessStatus: (status) => {
          if (typeof status === 'string') {
            setProcessStatus?.(status);
          } else if (status && typeof status === 'object') {
            setProcessStatus?.(status.processStatus || '');
          }
        },
        toggleTopBar,
        onStatusUpdate: (status) => {
          if (typeof status === 'string') {
            setProcessStatus?.(status);
          } else if (status && typeof status === 'object') {
            setProcessStatus?.(status.processStatus || '');
          }
        },
        captureFolder
      });
  
      // Ensure proper return even if captureResult is null
      const safeResult = captureResult && typeof captureResult === 'object' 
        ? captureResult 
        : { screenImage: '', webcamImage: '', success: false };
  
      return {
        screenImage: safeResult.screenImage || '',
        webcamImage: safeResult.webcamImage || '',
        success: true,
        point
      };
      
    } catch (error) {
      console.error("Error in calibrationCapture:", error);
      setProcessStatus?.(`Error: ${error.message}`);
      
      // Always return a valid object with default values
      return {
        screenImage: '',
        webcamImage: '',
        success: false,
        error: error.message
      };
    }
  };

/**
 * Complete capture and preview process
 * @param {Object} options - Process options
 */
export const captureAndPreviewProcess = async (options) => {
  const {
    canvasRef,
    position,
    captureCounter,
    setCaptureCounter,
    setProcessStatus,
    toggleTopBar,
    onStatusUpdate,
    captureFolder
  } = options;

  try {
    const canvas = canvasRef?.current;
    if (!canvas) {
      console.error("[captureAndPreviewProcess] Canvas reference is null");
      if (setProcessStatus) setProcessStatus('Error: Canvas is not available');
      return null;
    }

    // Draw the dot
    const ctx = canvas.getContext('2d');
    drawRedDot(ctx, position.x, position.y);

    // Countdown before capture
    if (onStatusUpdate) {
      onStatusUpdate({
        processStatus: 'Starting countdown...',
        isCapturing: true
      });
    }

    // Create a custom countdown element
    const canvasRect = canvas.getBoundingClientRect();
    const countdownElement = document.createElement('div');
    countdownElement.className = 'calibrate-countdown';
    countdownElement.style.cssText = `
      position: fixed;
      left: ${canvasRect.left + position.x}px;
      top: ${canvasRect.top + position.y - 60}px;
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

    // Create a redrawInterval for keeping the dot visible
    let redrawInterval = setInterval(() => {
      drawRedDot(ctx, position.x, position.y, 12, false);
    }, 200);

    // Manual countdown
    for (let count = 3; count > 0; count--) {
      countdownElement.textContent = count;
      if (onStatusUpdate) {
        onStatusUpdate({
          processStatus: `Countdown: ${count}`,
          countdownValue: count,
          isCapturing: true
        });
      }
      // Redraw dot to ensure it's visible
      drawRedDot(ctx, position.x, position.y);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Change to checkmark
    countdownElement.textContent = "✓";
    if (onStatusUpdate) {
      onStatusUpdate({
        processStatus: 'Capturing images...',
        countdownValue: "Capturing...",
        isCapturing: true
      });
    }

    // Remove countdown element and clear redrawInterval
    setTimeout(() => {
      if (countdownElement.parentNode) {
        countdownElement.parentNode.removeChild(countdownElement);
      }
      
      if (redrawInterval) {
        clearInterval(redrawInterval);
      }
    }, 300);

    // Use captureImagesAtPoint from savefile.js
    const captureResult = await captureImagesAtPoint({
      point: position,
      captureCount: captureCounter,
      canvasRef,
      setCaptureCount: setCaptureCounter,
      showCapturePreview
    });

    if (setProcessStatus) {
      setProcessStatus(`Captured dot at x=${Math.round(position.x)}, y=${Math.round(position.y)}`);
    }

    if (onStatusUpdate) {
      onStatusUpdate({
        processStatus: 'Capture complete',
        isCapturing: false
      });
    }

    // Show TopBar again with delay
    setTimeout(() => {
      if (typeof toggleTopBar === 'function') {
        toggleTopBar(true);
      } else if (typeof window !== 'undefined' && window.toggleTopBar) {
        window.toggleTopBar(true);
      }
    }, 2500);

    return captureResult;

  } catch (error) {
    console.error("[captureAndPreviewProcess] Fatal error:", error);
    
    if (setProcessStatus) {
      setProcessStatus(`Fatal error: ${error.message}`);
    }
    
    // Ensure TopBar is shown even on error
    setTimeout(() => {
      if (typeof toggleTopBar === 'function') {
        toggleTopBar(true);
      } else if (typeof window !== 'undefined' && window.toggleTopBar) {
        window.toggleTopBar(true);
      }
    }, 1500);
    
    // Return a minimal valid object to prevent null reference errors
    return {
      screenImage: '',
      webcamImage: '',
      success: false,
      error: error.message
    };
  }
};