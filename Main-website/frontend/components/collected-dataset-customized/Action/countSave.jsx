// Fixed countSave.jsx - Resolving redrawInterval reference error
// Shared functionality for countdown and image capture processes
import React from 'react';
import html2canvas from 'html2canvas';
import { captureImagesAtUserPoint } from '../Helper/user_savefile';

/**
 * Get canvas using the global canvas manager from index.js
 * @returns {HTMLCanvasElement} Canvas element
 */
const getCanvas = () => {
  if (typeof window !== 'undefined' && window.globalCanvasManager) {
    return window.globalCanvasManager.getCanvas();
  }
  return document.querySelector('#main-canvas');
};

/**
 * Capture the entire screen using html2canvas
 * @returns {Promise<string>} Base64 data URL of the screen capture
 */
const captureScreenWithHtml2Canvas = async () => {
  try {
    console.log('📸 Starting html2canvas screen capture...');
    
    // Configure html2canvas options for better capture
    const options = {
      useCORS: true,
      allowTaint: true,
      scale: 1, // Use 1:1 scale for better quality
      logging: false,
      backgroundColor: '#ffffff',
      removeContainer: true,
      foreignObjectRendering: true,
      // Capture the entire viewport
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: 0,
      scrollY: 0
    };

    console.log('📸 html2canvas options:', options);
    
    // Capture the entire document body
    const canvas = await html2canvas(document.body, options);
    
    // Convert to data URL
    const dataURL = canvas.toDataURL('image/png', 1.0);
    
    console.log('✅ html2canvas capture successful:', {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      dataURLLength: dataURL.length
    });
    
    return dataURL;
  } catch (error) {
    console.error('❌ html2canvas capture failed:', error);
    
    // Fallback to canvas capture if html2canvas fails
    console.log('🔄 Falling back to canvas capture...');
    const canvas = getCanvas();
    if (canvas) {
      return canvas.toDataURL('image/png');
    }
    
    throw new Error(`Screen capture failed: ${error.message}`);
  }
};

/**
 * Draw dot using the global canvas manager
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Dot radius
 * @returns {boolean} Success status
 */
const drawDotWithCanvasManager = (x, y, radius = 6) => {
  // Get canvas using the global canvas manager
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
    return null;
  }

  // Remove any existing countdown elements
  const existingCountdowns = document.querySelectorAll('.calibrate-countdown, .forced-countdown, .center-countdown-backup, .dot-countdown, .test-countdown');
  existingCountdowns.forEach(el => {
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
  }

  // Create the main countdown element
  const countdownElement = document.createElement('div');
  countdownElement.className = 'dot-countdown';
  countdownElement.style.cssText = `
    position: fixed;
    left: ${displayPosition.x - 5}px;
    top: ${displayPosition.y - 5}px;
    transform: none;
    color: red;
    font-size: 13px;
    font-weight: bold;
    text-shadow: 0 0 4px white, 0 0 6px white, 0 0 8px white;
    z-index: 9999;
    background-color: rgba(255, 255, 255, 0.98);
    border: 1px solid red;
    border-radius: 50%;
    width: 10px;
    height: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.7), 0 0 10px rgba(255, 0, 0, 0.5);
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
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(countdownElement);

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
    z-index: 9998;
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
 * @param {string} webcamImage - Data URL of the main webcam image
 * @param {string} subWebcamImage - Data URL of the sub webcam image (optional)
 * @param {Object} point - {x, y} position of the dot
 */
export const showCapturePreview = (screenImage, webcamImage, subWebcamImage, point) => {
  // Force display even if only one image is available
  const hasScreenImage = screenImage && screenImage.length > 100; // Check if it's a valid data URL
  const hasWebcamImage = webcamImage && webcamImage.length > 100; // Check if it's a valid data URL
  const hasSubWebcamImage = subWebcamImage && subWebcamImage.length > 100; // Check if it's a valid data URL
  
  if (!hasScreenImage && !hasWebcamImage && !hasSubWebcamImage) {
    return;
  }
  
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
    gap: 15px;
    background-color: rgba(0, 0, 0, 0.8);
    padding: 20px;
    border-radius: 8px;
    z-index: 10000;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    min-width: 300px;
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
  `;
  
  // Add simple success indicator
  const successIndicator = document.createElement('div');
  successIndicator.textContent = '✓ Captured';
  successIndicator.style.cssText = `
    position: absolute;
    top: -25px;
    left: 0;
    width: 100%;
    text-align: center;
    color: #4CAF50;
    font-size: 14px;
    font-weight: 500;
  `;
  previewContainer.appendChild(successIndicator);
  
  // Add screen image if available
  if (hasScreenImage) {
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
      max-width: 200px;
      max-height: 150px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: #fff;
    `;
    
    const screenLabel = document.createElement('div');
    screenLabel.textContent = 'Screen';
    screenLabel.style.cssText = `
      color: #fff;
      font-size: 12px;
      margin-top: 8px;
      font-weight: 400;
    `;
    
    screenPreview.appendChild(screenImg);
    screenPreview.appendChild(screenLabel);
    previewContainer.appendChild(screenPreview);
  } else {
    // Show minimal placeholder for missing screen image
    const screenPreview = document.createElement('div');
    screenPreview.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      opacity: 0.6;
    `;
    
    const screenPlaceholder = document.createElement('div');
    screenPlaceholder.textContent = 'No Screen';
    screenPlaceholder.style.cssText = `
      width: 200px;
      height: 150px;
      border: 1px dashed #666;
      border-radius: 4px;
      background-color: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      font-size: 12px;
    `;
    
    const screenLabel = document.createElement('div');
    screenLabel.textContent = 'Screen';
    screenLabel.style.cssText = `
      color: #999;
      font-size: 12px;
      margin-top: 8px;
      font-weight: 400;
    `;
    
    screenPreview.appendChild(screenPlaceholder);
    screenPreview.appendChild(screenLabel);
    previewContainer.appendChild(screenPreview);
  }
  
  // Add webcam images if available - support for dual camera display
  if (hasWebcamImage || hasSubWebcamImage) {
    const webcamContainer = document.createElement('div');
    webcamContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    `;
    
    // Main webcam (tag: main)
    if (hasWebcamImage) {
      const webcamPreview = document.createElement('div');
      webcamPreview.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
      `;
      
      const webcamImg = document.createElement('img');
      webcamImg.src = webcamImage;
      webcamImg.alt = 'Main Webcam Capture';
      webcamImg.style.cssText = `
        max-width: 200px;
        max-height: 120px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background-color: #fff;
      `;
      
      const webcamLabel = document.createElement('div');
      webcamLabel.textContent = 'Main Webcam';
      webcamLabel.style.cssText = `
        color: #fff;
        font-size: 12px;
        margin-top: 8px;
        font-weight: 400;
      `;
      
      webcamPreview.appendChild(webcamImg);
      webcamPreview.appendChild(webcamLabel);
      webcamContainer.appendChild(webcamPreview);
    }
    
    // Sub webcam (tag: submain)
    if (hasSubWebcamImage) {
      const subWebcamPreview = document.createElement('div');
      subWebcamPreview.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
      `;
      
      const subWebcamImg = document.createElement('img');
      subWebcamImg.src = subWebcamImage;
      subWebcamImg.alt = 'Sub Webcam Capture';
      subWebcamImg.style.cssText = `
        max-width: 200px;
        max-height: 120px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background-color: #fff;
      `;
      
      const subWebcamLabel = document.createElement('div');
      subWebcamLabel.textContent = 'Sub Webcam';
      subWebcamLabel.style.cssText = `
        color: #fff;
        font-size: 12px;
        margin-top: 8px;
        font-weight: 400;
      `;
      
      subWebcamPreview.appendChild(subWebcamImg);
      subWebcamPreview.appendChild(subWebcamLabel);
      webcamContainer.appendChild(subWebcamPreview);
    }
    
    previewContainer.appendChild(webcamContainer);
  } else {
    // Show minimal placeholder for missing webcam images
    const webcamContainer = document.createElement('div');
    webcamContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      opacity: 0.6;
    `;
    
    const webcamPlaceholder = document.createElement('div');
    webcamPlaceholder.textContent = 'No Webcam';
    webcamPlaceholder.style.cssText = `
      width: 200px;
      height: 150px;
      border: 1px dashed #666;
      border-radius: 4px;
      background-color: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      font-size: 12px;
    `;
    
    const webcamLabel = document.createElement('div');
    webcamLabel.textContent = 'Webcam';
    webcamLabel.style.cssText = `
      color: #999;
      font-size: 12px;
      margin-top: 8px;
      font-weight: 400;
    `;
    
    webcamContainer.appendChild(webcamPlaceholder);
    webcamContainer.appendChild(webcamLabel);
    previewContainer.appendChild(webcamContainer);
  }
  
  // Add minimal point info
  if (point) {
    const pointInfo = document.createElement('div');
    pointInfo.textContent = `(${Math.round(point.x)}, ${Math.round(point.y)})`;
    pointInfo.style.cssText = `
      color: #ccc;
      font-size: 11px;
      position: absolute;
      bottom: -20px;
      left: 0;
      width: 100%;
      text-align: center;
      font-weight: 400;
    `;
    previewContainer.appendChild(pointInfo);
  }
  
  // Add simple timer
  const timerElement = document.createElement('div');
  timerElement.textContent = '2s';
  timerElement.style.cssText = `
    position: absolute;
    bottom: -20px;
    right: 10px;
    color: #999;
    font-size: 11px;
    background-color: rgba(0, 0, 0, 0.5);
    padding: 2px 6px;
    border-radius: 3px;
  `;
  previewContainer.appendChild(timerElement);
  
  // Add to document
  document.body.appendChild(previewContainer);
  
  // Countdown with shorter display time
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
    return;
  }

  // Get the backup countdown element
  const backupCountdown = document.querySelector('.backup-countdown');

  // Draw dot using the canvas management system
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
export const drawRedDot = (ctx, x, y, radius = 6, clearCanvas = true) => {
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
  ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Add a second larger glow for even better visibility
  ctx.beginPath();
  ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  return { x, y };
};

/**
 * Load selected cameras from localStorage
 * @returns {Array} - Array of selected camera IDs
 */
const loadSelectedCamerasFromStorage = () => {
  if (typeof window !== 'undefined') {
    try {
      const storedCameras = localStorage.getItem('selectedCameras');
      const storedCameraData = localStorage.getItem('selectedCamerasData');
      
      if (storedCameras) {
        const parsedCameras = JSON.parse(storedCameras);
        if (Array.isArray(parsedCameras) && parsedCameras.length > 0) {
          console.log('Loaded selected cameras from localStorage for capture:', parsedCameras);
          
          // Load camera data with tags if available
          if (storedCameraData) {
            try {
              const parsedCameraData = JSON.parse(storedCameraData);
              console.log('Loaded camera data with tags for capture:', parsedCameraData);
            } catch (dataError) {
              console.warn('Error parsing camera data for capture:', dataError);
            }
          }
          
          return parsedCameras;
        }
      }
    } catch (error) {
      console.warn('Error loading selected cameras from localStorage:', error);
    }
  }
  return [];
};

/**
 * Get highest resolution camera constraints with selected camera support
 * @returns {Promise<Object>} - Camera constraints
 */
const getHighestResolutionConstraints = async () => {
  try {
    // Load selected cameras from localStorage
    const selectedCameras = loadSelectedCamerasFromStorage();
    
    // Get all video input devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    if (videoDevices.length === 0) {
      console.warn('No video devices found, using default constraints');
      return { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
    }
    
    // Use selected camera if available, otherwise use first available camera
    let targetDeviceId = null;
    if (selectedCameras.length > 0) {
      // Use the first selected camera
      targetDeviceId = selectedCameras[0];
      console.log('Using selected camera for capture:', targetDeviceId);
    }
    
    // Find the target device
    const targetDevice = targetDeviceId ? 
      videoDevices.find(device => device.deviceId === targetDeviceId) : 
      videoDevices[0];
    
    if (!targetDevice) {
      console.warn('Target device not found, using first available');
      return { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
    }
    
    console.log('🎯 Using device:', targetDevice.label || targetDevice.deviceId);
    
    // Try to get capabilities for the target device
    const constraints = { 
      video: { 
        deviceId: { exact: targetDevice.deviceId },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      } 
    };
    
    // Test the constraints to see what's actually supported
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const videoTrack = stream.getVideoTracks()[0];
    
    if (!videoTrack) {
      stream.getTracks().forEach(track => track.stop());
      console.warn('No video track found, using fallback constraints');
      return { video: { deviceId: { exact: targetDevice.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } };
    }
    
    // Get the actual settings being used
    const settings = videoTrack.getSettings();
    console.log('📊 Actual video settings:', settings);
    
    // Get capabilities if available
    let capabilities = null;
    if (videoTrack.getCapabilities) {
      capabilities = videoTrack.getCapabilities();
      console.log('📊 Video capabilities:', capabilities);
    }
    
    // Stop the test stream
    stream.getTracks().forEach(track => track.stop());
    
    // Determine the best resolution
    let bestWidth = 1280; // Default minimum
    let bestHeight = 720;
    
    if (capabilities && capabilities.width && capabilities.height) {
      // Use the maximum available resolution
      bestWidth = Math.max(...capabilities.width.values);
      bestHeight = Math.max(...capabilities.height.values);
      console.log('🎯 Maximum supported resolution:', bestWidth, 'x', bestHeight);
    } else if (settings.width && settings.height) {
      // Use the settings from the test stream
      bestWidth = settings.width;
      bestHeight = settings.height;
      console.log('🎯 Test stream resolution:', bestWidth, 'x', bestHeight);
    }
    
    // Ensure minimum resolution of 640x480
    bestWidth = Math.max(bestWidth, 640);
    bestHeight = Math.max(bestHeight, 480);
    
    console.log('✅ Final resolution constraints:', bestWidth, 'x', bestHeight);
    
    return {
      video: {
        deviceId: { exact: targetDevice.deviceId },
        width: { ideal: bestWidth },
        height: { ideal: bestHeight },
        frameRate: { ideal: 30 }
      }
    };
  } catch (error) {
    console.warn('Error getting camera constraints, falling back to default:', error);
    return { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
  }
};

/**
 * Enhanced capture function using html2canvas for screen capture
 * @param {Object} options - Capture options
 * @returns {Promise} - Promise that resolves with the capture result
 */
export const captureImagesWithHtml2Canvas = async (options) => {
  const {
    canvasRef,
    position,
    captureCounter, 
    setCaptureCounter,
    setProcessStatus,
    captureFolder = 'eye_tracking_captures'
  } = options;

  if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
    setProcessStatus?.('Error: Invalid capture position');
    return null;
  }

  try {
    console.log('🎯 Starting enhanced capture with html2canvas...');
    
    // Use the existing video element from cameraAccess.js if available
    const videoElement = window.videoElement || document.querySelector('video');
    
    // For sub camera, we need to find the second video element
    let subVideoElement = window.subVideoElement || document.querySelector('video[data-camera-index="1"]');
    
    // If subVideoElement not found, try to find all video elements and get the second one
    if (!subVideoElement) {
      const allVideoElements = document.querySelectorAll('video');
      console.log('🔍 All video elements found for capture:', allVideoElements.length);
      console.log('🔍 Video elements details for capture:', Array.from(allVideoElements).map((video, index) => ({
        index,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        srcObject: !!video.srcObject,
        cameraIndex: video.getAttribute('data-camera-index'),
        cameraTag: video.getAttribute('data-camera-tag'),
        isMainVideo: video === videoElement
      })));
      
      if (allVideoElements.length > 1) {
        // Find the video element that's not the main one
        for (let i = 0; i < allVideoElements.length; i++) {
          const video = allVideoElements[i];
          if (video !== videoElement && video.srcObject) {
            subVideoElement = video;
            console.log('✅ Found sub video element at index:', i);
            console.log('✅ Sub video element details for capture:', {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState,
              srcObject: !!video.srcObject,
              cameraIndex: video.getAttribute('data-camera-index'),
              cameraTag: video.getAttribute('data-camera-tag')
            });
            break;
          }
        }
      }
    }
    
    console.log('📹 Video elements for capture:', {
      mainVideo: !!videoElement,
      subVideo: !!subVideoElement,
      allVideos: document.querySelectorAll('video').length
    });
    
    // Debug: Check if we should have a sub camera
    const selectedCameras = loadSelectedCamerasFromStorage();
    if (selectedCameras.length > 1 && !subVideoElement) {
      console.warn('⚠️ WARNING: 2 cameras selected but no sub video element found!');
      console.warn('⚠️ This means sub camera capture will be skipped');
      console.warn('⚠️ Selected cameras:', selectedCameras);
      console.warn('⚠️ All video elements on page:', document.querySelectorAll('video').length);
      console.warn('⚠️ Window video elements:', {
        main: !!window.videoElement,
        sub: !!window.subVideoElement
      });
    }
    
    if (videoElement && videoElement.srcObject) {
      const videoTrack = videoElement.srcObject.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log('Using existing video stream for capture:', settings);
      }
    } else {
      // Get highest resolution constraints with selected camera support
      const constraints = await getHighestResolutionConstraints();
      
      // Get a new stream with the selected camera and highest resolution
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      console.log('Created new video stream for capture:', settings);
      
      // Update video element with new stream
      if (videoElement) {
        videoElement.srcObject = stream;
        await videoElement.play();
      }
    }
    
    // Capture screen using html2canvas
    console.log('📸 Capturing screen with html2canvas...');
    const screenImage = await captureScreenWithHtml2Canvas();
    
    // Capture webcam using existing method - Support for dual cameras
    console.log('📷 Capturing webcam...');
    let webcamImage = null;
    let subWebcamImage = null;
    
    // Capture main camera (tag: main)
    if (videoElement) {
      try {
        // Create a temporary canvas to capture main webcam
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Set canvas size to video dimensions - use high resolution
        tempCanvas.width = videoElement.videoWidth || 1280;
        tempCanvas.height = videoElement.videoHeight || 720;
        
        // Ensure minimum resolution
        tempCanvas.width = Math.max(tempCanvas.width, 640);
        tempCanvas.height = Math.max(tempCanvas.height, 480);
        
        // Draw video frame to canvas - remove horizontal mirroring for capture
        tempCtx.save();
        tempCtx.scale(-1, 1); // Mirror horizontally to counteract the display mirroring
        tempCtx.translate(-tempCanvas.width, 0); // Move to correct position after scaling
        tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.restore();
        
        // Get high-resolution image
        webcamImage = tempCanvas.toDataURL('image/jpeg', 0.95);
        console.log('📷 Main webcam image captured successfully');
        
        // Clean up temporary canvas
        tempCanvas.remove();
      } catch (webcamError) {
        console.error('Error capturing main webcam:', webcamError);
      }
    }
    
    // Capture sub camera (tag: submain) if available
    if (subVideoElement && subVideoElement.srcObject) {
      try {
        console.log('📷 Sub video element found for capture, attempting capture...');
        console.log('📷 Sub video element details for capture:', {
          videoWidth: subVideoElement.videoWidth,
          videoHeight: subVideoElement.videoHeight,
          readyState: subVideoElement.readyState,
          srcObject: !!subVideoElement.srcObject,
          cameraIndex: subVideoElement.getAttribute('data-camera-index'),
          cameraTag: subVideoElement.getAttribute('data-camera-tag')
        });
        
        // Create a temporary canvas to capture sub webcam
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Set canvas size to video dimensions - use high resolution
        tempCanvas.width = subVideoElement.videoWidth || 1280;
        tempCanvas.height = subVideoElement.videoHeight || 720;
        
        // Ensure minimum resolution
        tempCanvas.width = Math.max(tempCanvas.width, 640);
        tempCanvas.height = Math.max(tempCanvas.height, 480);
        
        // Draw video frame to canvas - remove horizontal mirroring for capture
        tempCtx.save();
        tempCtx.scale(-1, 1); // Mirror horizontally to counteract the display mirroring
        tempCtx.translate(-tempCanvas.width, 0); // Move to correct position after scaling
        tempCtx.drawImage(subVideoElement, 0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.restore();
        
        // Get high-resolution image
        subWebcamImage = tempCanvas.toDataURL('image/jpeg', 0.95);
        console.log('📷 Sub webcam image captured successfully');
        
        // Clean up temporary canvas
        tempCanvas.remove();
      } catch (webcamError) {
        console.error('Error capturing sub webcam:', webcamError);
      }
    } else {
      console.log('ℹ️ No sub video element found - single camera mode');
    }
    
    // Create capture group ID
    const captureGroupId = `capture-${Date.now()}-${Date.now()}`;
    
    // Create parameter data - Include dual camera support only when 2 cameras are selected
    const selectedCamerasForCSV = loadSelectedCamerasFromStorage();
    const csvDataArray = [
      "name,value",
      `dot_x,${position.x}`,
      `dot_y,${position.y}`,
      `canvas_width,${window.innerWidth}`,
      `canvas_height,${window.innerHeight}`,
      `window_width,${window.innerWidth}`,
      `window_height,${window.innerHeight}`,
      `webcam_resolution_width,${videoElement?.videoWidth || 640}`,
      `webcam_resolution_height,${videoElement?.videoHeight || 480}`,
      `timestamp,${new Date().toISOString()}`,
      `group_id,${captureGroupId}`
    ];
    
    // Only add sub camera resolution fields if 2 cameras are selected
    if (selectedCamerasForCSV.length > 1) {
      csvDataArray.splice(9, 0, `webcam_resolution_width_1,${subVideoElement?.videoWidth || 0}`);
      csvDataArray.splice(10, 0, `webcam_resolution_height_1,${subVideoElement?.videoHeight || 0}`);
    }
    
    const csvData = csvDataArray.join('\n');
    
    // Save files using user_savefile functions
    const { saveImageToUserServer, saveCSVToUserServer } = await import('../Helper/user_savefile');
    
    
    // Save parameter file
    const paramResult = await saveCSVToUserServer(csvData, 'parameter_001.csv', captureGroupId);
    const captureNumber = paramResult?.number || 1;
    
    // Save screen image
    const screenResult = await saveImageToUserServer(screenImage, 'screen_001.jpg', 'screen', captureGroupId);
    
    // Save main webcam image if available
    let webcamResult = null;
    if (webcamImage) {
      webcamResult = await saveImageToUserServer(webcamImage, 'webcam_001.jpg', 'webcam', captureGroupId);
    }
    
    // Save sub webcam image if available
    let subWebcamResult = null;
    if (subWebcamImage) {
      console.log('📷 Saving sub webcam image...');
      console.log('📷 Sub webcam image details for countSave:', {
        hasImage: !!subWebcamImage,
        imageLength: subWebcamImage?.length || 0,
        filename: 'webcam_sub_001.jpg',
        type: 'webcam_sub',
        captureGroupId
      });
      subWebcamResult = await saveImageToUserServer(subWebcamImage, 'webcam_sub_001.jpg', 'webcam_sub', captureGroupId);
      if (subWebcamResult && subWebcamResult.success) {
        console.log('✅ Sub webcam image saved successfully');
      } else {
        console.error('❌ Failed to save sub webcam image');
      }
    } else {
      console.log('ℹ️ No sub webcam image to save (single camera mode)');
      console.log('ℹ️ Sub webcam image check for countSave:', {
        hasSubWebcamImage: !!subWebcamImage,
        subWebcamImageLength: subWebcamImage?.length || 0,
        selectedCameras: selectedCameras,
        hasSubVideoElement: !!subVideoElement
      });
    }
    
    // Show preview with both cameras
    showCapturePreview(screenImage, webcamImage, subWebcamImage, position);
    
    // Increment counter
    if (setCaptureCounter) {
      setCaptureCounter(prevCount => prevCount + 1);
    }
    
    
    return {
      screenImage: screenImage,
      webcamImage: webcamImage,
      subWebcamImage: subWebcamImage,
      success: true,
      captureId: captureGroupId,
      captureNumber: captureNumber,
      results: {
        parameter: paramResult,
        screen: screenResult,
        webcam: webcamResult,
        subWebcam: subWebcamResult
      }
    };
  } catch (err) {
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
 * Capture images at a specific point (legacy function for backward compatibility)
 * @param {Object} options - Capture options
 * @returns {Promise} - Promise that resolves with the capture result
 */
export const captureImages = async (options) => {
  // Use the enhanced capture function by default
  return await captureImagesWithHtml2Canvas(options);
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
      captureFolder = 'eye_tracking_captures',
      pointIndex,
      totalPoints
    } = options;
  
    try {
      
      // Get canvas using canvas management system
      const canvas = getCanvas();
      if (!canvas) {
        setProcessStatus?.(`Error: Canvas not available`);
        return { success: false };
      }
  
      // Draw dot using the canvas management system
      drawDotWithCanvasManager(point.x, point.y);
  
      setProcessStatus?.(`Calibration point ${pointIndex + 1}/${totalPoints}`);
  
      // Use the same countdown element creation method
      const canvasRect = canvas.getBoundingClientRect();
      const countdownElement = createCountdownElement(point, canvasRect);
      
      if (!countdownElement) {
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
  
      // Use user-specific capture function
      const captureResult = await captureImagesAtUserPoint({
        point: point,
        captureCount: captureCounter,
        canvasRef,
        setCaptureCount: setCaptureCounter,
        showCapturePreview: (screenImage, webcamImage, subWebcamImage, point) => {
          showCapturePreview(screenImage, webcamImage, subWebcamImage, point);
        }
      });
  
      // Ensure proper return even if captureResult is null
      const safeResult = captureResult && typeof captureResult === 'object' 
        ? captureResult 
        : { screenImage: '', webcamImage: '', success: false };
  
      return {
        screenImage: safeResult.screenImage || '',
        webcamImage: safeResult.webcamImage || '',
        success: true,
        point,
        userId: safeResult.userId,
        captureNumber: safeResult.captureNumber
      };
      
    } catch (error) {
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
    onStatusUpdate,
    captureFolder
  } = options;

  try {
    // Get canvas using canvas management system
    const canvas = getCanvas();
    if (!canvas) {
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
    
    const countdownElement = document.createElement('div');
    countdownElement.className = 'calibrate-countdown';
    countdownElement.style.cssText = `
      position: fixed;
      left: ${displayPosition.x - 10}px;
      top: ${displayPosition.y - 10}px;
      transform: none;
      color: red;
      font-size: 13px;
      font-weight: bold;
      text-shadow: 0 0 4px white, 0 0 6px white, 0 0 8px white;
      z-index: 9999;
      background-color: rgba(255, 255, 255, 0.98);
      border: 1px solid red;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      box-shadow: 0 0 6px rgba(0, 0, 0, 0.7), 0 0 10px rgba(255, 0, 0, 0.5);
      animation: countdownPulse 1s infinite;
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

    // Ensure video element is available for capture
    const videoElement = window.videoElement || document.querySelector('video');

    // Use enhanced capture with html2canvas
    const captureResult = await captureImagesWithHtml2Canvas({
      position: position,
      captureCounter: captureCounter,
      canvasRef,
      setCaptureCounter: setCaptureCounter,
      setProcessStatus: setProcessStatus
    });


    // Force display of capture preview with both images
    if (captureResult && (captureResult.screenImage || captureResult.webcamImage || captureResult.subWebcamImage)) {
      
      // Remove any existing previews first
      const existingPreviews = document.querySelectorAll('.capture-preview-container');
      existingPreviews.forEach(preview => {
        if (preview.parentNode) {
          preview.parentNode.removeChild(preview);
        }
      });
      
      // Force show the preview with all images
      showCapturePreview(
        captureResult.screenImage || '', 
        captureResult.webcamImage || '', 
        captureResult.subWebcamImage || '',
        position
      );
      
      // Show success message
      const successMessage = `✅ Capture successful! Screen: ${captureResult.screenImage ? '✓' : '✗'}, Main Webcam: ${captureResult.webcamImage ? '✓' : '✗'}, Sub Webcam: ${captureResult.subWebcamImage ? '✓' : '✗'}`;
      
      if (setProcessStatus) {
        setProcessStatus(successMessage);
      }
      
      if (onStatusUpdate) {
        onStatusUpdate({
          processStatus: successMessage,
          isCapturing: false,
          captureSuccess: true
        });
      }
    } else {
      // Show error message if no images were captured
      const errorMessage = '❌ No images captured - check camera and screen access';
      
      if (setProcessStatus) {
        setProcessStatus(errorMessage);
      }
      
      if (onStatusUpdate) {
        onStatusUpdate({
          processStatus: errorMessage,
          isCapturing: false,
          captureSuccess: false
        });
      }
    }

    // Save process completed

    return captureResult;

  } catch (error) {
    
    if (setProcessStatus) {
      setProcessStatus(`Fatal error: ${error.message}`);
    }
    
    
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