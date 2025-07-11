// Fixed countSave.jsx - Resolving redrawInterval reference error
// Shared functionality for countdown and image capture processes
import React from 'react';
import { captureImagesAtPoint } from '../Helper/savefile';

/**
 * Get canvas management utilities from global scope (from actionButton.js)
 * @returns {Object} Canvas utilities object
 */
const getCanvasUtils = () => {
  if (typeof window !== 'undefined') {
    return {
      canvasUtils: window.canvasUtils,
      canvasManager: window.canvasManager
    };
  }
  return { canvasUtils: null, canvasManager: null };
};

/**
 * Get or create canvas using the canvas management system from actionButton.js
 * @returns {HTMLCanvasElement} Canvas element
 */
const getCanvas = () => {
  const { canvasUtils, canvasManager } = getCanvasUtils();
  
  // First try to use canvasUtils from actionButton.js
  if (canvasUtils && typeof canvasUtils.getCanvas === 'function') {
    return canvasUtils.getCanvas();
  }
  
  // Fallback to canvasManager
  if (canvasManager && typeof canvasManager.getCanvas === 'function') {
    return canvasManager.getCanvas() || canvasManager.createCanvas();
  }
  
  // Fallback to direct query
  return document.querySelector('#tracking-canvas');
};


/**
 * Draw dot using the canvas management system
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Dot radius
 * @returns {boolean} Success status
 */
const drawDotWithCanvasManager = (x, y, radius = 12) => {
  const { canvasUtils } = getCanvasUtils();
  
  if (canvasUtils && typeof canvasUtils.drawDot === 'function') {
    return canvasUtils.drawDot(x, y, radius);
  }
  
  // Fallback: manually draw dot
  const canvas = getCanvas();
  if (canvas) {
    const ctx = canvas.getContext('2d');
    drawRedDot(ctx, x, y, radius, false);
    return true;
  }
  return false;
};


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

  // Remove any existing countdown elements
  const existingCountdowns = document.querySelectorAll('.calibrate-countdown, .forced-countdown, .center-countdown-backup, .dot-countdown, .test-countdown');
  existingCountdowns.forEach(el => {
    console.log('Removing existing countdown element:', el);
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  });

  // Get canvas to check if we need coordinate transformation
  const canvas = getCanvas();
  let displayPosition = position;
  
  if (canvas) {
    // Check if canvas is in fullscreen mode
    const isFullscreen = canvas.style.position === 'fixed' && 
                        (canvas.style.width === '100vw' || canvas.style.width === '100%');
    displayPosition = {
      x: position.x,
      y: position.y
    };
    // if (isFullscreen) {
    //   // Canvas is in fullscreen mode, use direct coordinates
    //   displayPosition = {
    //     x: position.x,
    //     y: position.y
    //   };
    // } else {
    //   // Canvas is in normal mode, use canvas-relative coordinates
    //   displayPosition = {
    //     x: canvasRect.left + position.x,
    //     y: canvasRect.top + position.y
    //   };
    // }
  }

  console.log('[createCountdownElement] Creating countdown at position:', {
    original: position,
    display: displayPosition,
    canvasRect: canvasRect,
    canvasFullscreen: canvas ? (canvas.style.position === 'fixed' && canvas.style.width === '100vw') : false
  });

  // Create the main countdown element
  const countdownElement = document.createElement('div');
  countdownElement.className = 'dot-countdown';
  countdownElement.style.cssText = `
    position: fixed;
    left: ${displayPosition.x}px;
    top: ${displayPosition.y - 80}px;
    transform: translateX(-50%);
    color: red;
    font-size: 64px;
    font-weight: bold;
    text-shadow: 0 0 20px white, 0 0 30px white, 0 0 40px white;
    z-index: 30;
    background-color: rgba(255, 255, 255, 0.98);
    border: 4px solid red;
    border-radius: 50%;
    width: 100px;
    height: 100px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 0 30px rgba(0, 0, 0, 0.7), 0 0 50px rgba(255, 0, 0, 0.5);
    animation: countdownPulse 1s infinite;
    pointer-events: none;
    user-select: none;
  `;
  
  // Add CSS animation for pulse effect
  if (!document.querySelector('#countdown-styles')) {
    const style = document.createElement('style');
    style.id = 'countdown-styles';
    style.textContent = `
      @keyframes countdownPulse {
        0% { transform: translateX(-50%) scale(1); }
        50% { transform: translateX(-50%) scale(1.1); }
        100% { transform: translateX(-50%) scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(countdownElement);
  
  console.log('createCountdownElement created at:', {
    originalPosition: position,
    displayPosition,
    canvasRect,
    canvasInfo: canvas ? {
      position: canvas.style.position,
      width: canvas.style.width,
      height: canvas.style.height,
      rect: canvas.getBoundingClientRect()
    } : null
  });

  // Add a temporary visual indicator to show where the countdown is positioned
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    left: ${displayPosition.x}px;
    top: ${displayPosition.y}px;
    width: 10px;
    height: 10px;
    background-color: blue;
    border-radius: 50%;
    z-index: 20;
    pointer-events: none;
  `;
  document.body.appendChild(indicator);
  
  // Remove indicator after 2 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }, 2000);
  
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
    z-index: 20;
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

  // Get the backup countdown element
  const backupCountdown = document.querySelector('.backup-countdown');

  // Use canvas management system to draw dot
  drawDotWithCanvasManager(position.x, position.y);

  let count = 3;
  countdownElement.textContent = count;
  if (backupCountdown) {
    backupCountdown.textContent = count;
  }

  onStatusUpdate?.({
    processStatus: "Countdown",
    countdownValue: count,
    isCapturing: true
  });

  // Create redrawInterval for keeping dot visible during countdown
  let redrawInterval = setInterval(() => {
    drawDotWithCanvasManager(position.x, position.y);
  }, 200);

  return new Promise((resolve) => {
    const countdownInterval = setInterval(() => {
      count--;

      if (count <= 0) {
        clearInterval(countdownInterval);
        countdownElement.textContent = "✓";
        if (backupCountdown) {
          backupCountdown.textContent = "✓";
        }

        onStatusUpdate?.({
          countdownValue: "Capturing...",
          processStatus: "Capturing image...",
          isCapturing: true
        });

        setTimeout(() => {
          // Remove both countdown elements
          if (countdownElement.parentNode) {
            countdownElement.parentNode.removeChild(countdownElement);
          }
          if (backupCountdown && backupCountdown.parentNode) {
            backupCountdown.parentNode.removeChild(backupCountdown);
          }
          
          drawDotWithCanvasManager(position.x, position.y);

          // Clear the redrawInterval we defined above
          if (redrawInterval) {
            clearInterval(redrawInterval);
          }

          if (onComplete) {
            drawDotWithCanvasManager(position.x, position.y);
            onComplete();
          }
          resolve();
        }, 300);
      } else {
        countdownElement.textContent = count;
        if (backupCountdown) {
          backupCountdown.textContent = count;
        }

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
 * Draw a red dot on the canvas (legacy function for backward compatibility)
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
    ctx.fillStyle = 'yellow';
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
  
  console.log(`Drew red dot at (${x}, ${y}) with radius ${radius}`);
  return { x, y };
};

/**
 * Get highest resolution camera constraints
 * @returns {Promise<Object>} - Camera constraints
 */
const getHighestResolutionConstraints = async () => {
  try {
    // Get all video input devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    if (videoDevices.length === 0) {
      console.warn('No video devices found, using default constraints');
      return { video: true };
    }
    
    // Try to get capabilities for the first video device
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoTrack = stream.getVideoTracks()[0];
    
    if (!videoTrack.getCapabilities) {
      console.warn('getCapabilities not supported, using default constraints');
      stream.getTracks().forEach(track => track.stop());
      return { video: true };
    }
    
    const capabilities = videoTrack.getCapabilities();
    stream.getTracks().forEach(track => track.stop());
    
    if (!capabilities.width || !capabilities.height) {
      console.warn('No width/height capabilities, using default constraints');
      return { video: true };
    }
    
    // Get the highest resolution available
    const maxWidth = Math.max(...capabilities.width.values);
    const maxHeight = Math.max(...capabilities.height.values);
    
    console.log(`Using highest resolution: ${maxWidth}x${maxHeight}`);
    
    return {
      video: {
        width: { ideal: maxWidth },
        height: { ideal: maxHeight },
        frameRate: { ideal: 30 }
      }
    };
  } catch (error) {
    console.warn('Error getting camera constraints, using default:', error);
    return { video: true };
  }
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
      
      // Get canvas using canvas management system
      const canvas = getCanvas();
      if (!canvas) {
        console.error("Canvas reference is null in calibrationCapture");
        setProcessStatus?.(`Error: Canvas not available`);
        return { success: false };
      }
  
      // Use canvas management system to draw dot
      drawDotWithCanvasManager(point.x, point.y);
  
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
        drawDotWithCanvasManager(point.x, point.y);
      }, 200);
  
      // Run the same countdown as random dot
      for (let count = 3; count > 0; count--) {
        countdownElement.textContent = count;
        setProcessStatus?.(`Point ${pointIndex + 1}/${totalPoints} - countdown ${count}`);
        
        // Redraw the dot at each step to ensure it remains visible
        drawDotWithCanvasManager(point.x, point.y);
        
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
    // Get canvas using canvas management system
    const canvas = getCanvas();
    if (!canvas) {
      console.error("[captureAndPreviewProcess] Canvas reference is null");
      if (setProcessStatus) setProcessStatus('Error: Canvas is not available');
      return null;
    }

    // Draw the dot using canvas management system
    drawDotWithCanvasManager(position.x, position.y);

    // Countdown before capture
    if (onStatusUpdate) {
      onStatusUpdate({
        processStatus: 'Starting countdown...',
        isCapturing: true
      });
    }

    // Remove any existing countdown elements first
    const existingCountdowns = document.querySelectorAll('.calibrate-countdown, .dot-countdown, .forced-countdown, .center-countdown-backup');
    existingCountdowns.forEach(el => {
      console.log('captureAndPreviewProcess: Removing existing countdown:', el);
      el.remove();
    });
    
    // Create a custom countdown element
    const canvasRect = canvas.getBoundingClientRect();
    
    // Transform coordinates for fullscreen display
    let displayPosition = position;
    displayPosition = {
      x: position.x,
      y: position.y
    };
    // if (canvas.style.position === 'fixed' && canvas.style.width === '100vw') {
    //   // Canvas is in fullscreen mode, use direct coordinates
    //   displayPosition = {
    //     x: position.x,
    //     y: position.y
    //   };
    // } else {
    //   // Canvas is in normal mode, use canvas-relative coordinates
    //   displayPosition = {
    //     x: canvasRect.left + position.x,
    //     y: canvasRect.top + position.y
    //   };
    // }
    
    console.log('captureAndPreviewProcess: Creating countdown at:', {
      originalPosition: position,
      displayPosition,
      canvasRect,
      canvasStyle: {
        position: canvas.style.position,
        width: canvas.style.width,
        height: canvas.style.height
      }
    });
    
    const countdownElement = document.createElement('div');
    countdownElement.className = 'calibrate-countdown';
    countdownElement.style.cssText = `
      position: fixed;
      left: ${displayPosition.x}px;
      top: ${displayPosition.y - 60}px;
      transform: translateX(-50%);
      color: red;
      font-size: 48px;
      font-weight: bold;
      text-shadow: 0 0 15px white, 0 0 25px white, 0 0 35px white;
      z-index: 30;
      background-color: rgba(255, 255, 255, 0.95);
      border: 3px solid red;
      border-radius: 50%;
      width: 80px;
      height: 80px;
      display: flex;
      justify-content: center;
      align-items: center;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.5), 0 0 40px rgba(255, 0, 0, 0.3);
      animation: pulse 1s infinite;
    `;
    document.body.appendChild(countdownElement);

    // Create a redrawInterval for keeping the dot visible
    let redrawInterval = setInterval(() => {
      drawDotWithCanvasManager(position.x, position.y);
    }, 200);

    // Manual countdown
    for (let count = 3; count > 0; count--) {
      countdownElement.textContent = count;
      // backupCountdown.textContent = count;
      if (onStatusUpdate) {
        onStatusUpdate({
          processStatus: `Countdown: ${count}`,
          countdownValue: count,
          isCapturing: true
        });
      }
      // Redraw dot to ensure it's visible
      drawDotWithCanvasManager(position.x, position.y);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Change to checkmark
    countdownElement.textContent = "✓";
    // backupCountdown.textContent = "✓";
    if (onStatusUpdate) {
      onStatusUpdate({
        processStatus: 'Capturing images...',
        countdownValue: "Capturing...",
        isCapturing: true
      });
    }

    // Remove countdown elements and clear redrawInterval
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

// Default export for React compatibility
const CountSave = () => null; // This is a utility file, so we don't need to render anything

export default CountSave; 