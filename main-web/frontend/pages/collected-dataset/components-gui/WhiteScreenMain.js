// components-gui/WhiteScreenMain.js
import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

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
  
  // Add this helper function to show a preview of the captured images
  const showCapturePreview = (screenImage, webcamImage, dotPosition) => {
    if (!screenImage && !webcamImage) {
      console.warn("No images available to preview");
      return;
    }

    // Remove any existing preview containers first (in case of overlapping)
    try {
      const existingPreviews = document.querySelectorAll('.capture-preview-container');
      existingPreviews.forEach(preview => {
        if (preview.parentNode) {
          console.log("Removing existing preview container");
          preview.parentNode.removeChild(preview);
        }
      });
    } catch (cleanupError) {
      console.error("Error cleaning up existing previews:", cleanupError);
    }
    
    // Create a new preview container with z-index higher than everything else
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
    
    console.log("Preview container created");
    
    // Add debug info div
    const debugInfo = document.createElement('div');
    debugInfo.style.cssText = `
      position: absolute;
      top: -30px;
      left: 0;
      width: 100%;
      color: white;
      font-size: 12px;
      text-align: center;
    `;
    debugInfo.textContent = `Screen: ${screenImage ? 'YES' : 'NO'}, Webcam: ${webcamImage ? 'YES' : 'NO'}`;
    previewContainer.appendChild(debugInfo);
    
    // Function to add an image to the preview
    const addImagePreview = (image, label) => {
      try {
        console.log(`Adding ${label} preview, image data length: ${image ? image.length : 'N/A'}`);
        
        const preview = document.createElement('div');
        preview.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
        `;
        
        const img = document.createElement('img');
        img.src = image;
        img.alt = label;
        img.style.cssText = `
          max-width: 320px;
          max-height: 240px;
          border: 3px solid white;
          border-radius: 8px;
          background-color: #333;
        `;
        
        // Event listeners for image loading
        img.onload = () => console.log(`${label} image loaded successfully`);
        img.onerror = (e) => console.error(`Error loading ${label} image:`, e);
        
        const labelElement = document.createElement('div');
        labelElement.textContent = label;
        labelElement.style.cssText = `
          color: white;
          font-size: 14px;
          margin-top: 10px;
          font-weight: bold;
        `;
        
        preview.appendChild(img);
        preview.appendChild(labelElement);
        previewContainer.appendChild(preview);
        console.log(`${label} preview element added to container`);
        return true;
      } catch (error) {
        console.error(`Error adding ${label} preview:`, error);
        return false;
      }
    };
    
    // Add both images to preview if available
    if (screenImage) {
      addImagePreview(screenImage, 'Screen Capture');
    }
    
    if (webcamImage) {
      addImagePreview(webcamImage, 'Webcam Capture');
    }
    
    // Add dot position info if available
    if (dotPosition) {
      const positionInfo = document.createElement('div');
      positionInfo.textContent = `Dot position: x=${Math.round(dotPosition.x)}, y=${Math.round(dotPosition.y)}`;
      positionInfo.style.cssText = `
        color: #ffcc00;
        font-size: 14px;
        position: absolute;
        top: -50px;
        left: 0;
        width: 100%;
        text-align: center;
      `;
      previewContainer.appendChild(positionInfo);
      console.log("Dot position info added");
    }
    
    // Add countdown timer
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
    
    // Add to document body
    try {
      document.body.appendChild(previewContainer);
      console.log("Preview container added to DOM");
    } catch (appendError) {
      console.error("Error adding preview container to DOM:", appendError);
    }
    
    // Countdown and remove the preview after 2 seconds
    let timeLeft = 2.0;
    const interval = setInterval(() => {
      timeLeft -= 0.1;
      if (timeLeft <= 0) {
        clearInterval(interval);
        // Fade out
        previewContainer.style.transition = 'opacity 0.3s ease';
        previewContainer.style.opacity = '0';
        // Remove after fade
        setTimeout(() => {
          if (previewContainer.parentNode) {
            console.log("Removing preview container from DOM");
            previewContainer.parentNode.removeChild(previewContainer);
          }
        }, 300);
      } else {
        timerElement.textContent = `${timeLeft.toFixed(1)}s`;
      }
    }, 100);
    
    // Safety cleanup after 5 seconds in case anything goes wrong
    setTimeout(() => {
      if (previewContainer.parentNode) {
        console.log("Safety cleanup of preview container");
        previewContainer.parentNode.removeChild(previewContainer);
      }
    }, 5000);
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
  
  // Generate a random position on the canvas
  const getRandomPosition = () => {
    const canvas = activeCanvasRef.current;
    if (!canvas) {
      console.error("Canvas ref is null in getRandomPosition");
      return { x: 100, y: 100 }; // Fallback position
    }
    
    const width = canvas.width || 400;  // Fallback if width is 0
    const height = canvas.height || 300; // Fallback if height is 0
    
    console.log("Canvas dimensions for random position:", { width, height });
    
    // Ensure we're not too close to the edges
    const padding = 40; // Increased padding
    return {
      x: Math.floor(Math.random() * (width - 2 * padding)) + padding,
      y: Math.floor(Math.random() * (height - 2 * padding)) + padding
    };
  };
  
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
  
  // Start countdown timer
  const startCountdown = (count, onComplete) => {
    console.log("Starting countdown from:", count);
    
    // Set countdown value in state
    setCountdownValue(count);
    setForceShowCountdown(true);
    setIsCapturing(true);
    
    // Update status for parent component
    if (onStatusUpdate) {
      onStatusUpdate({
        countdownValue: count,
        processStatus: `Countdown: ${count}`,
        isCapturing: true
      });
    }
    
    const timer = setTimeout(() => {
      if (count > 1) {
        startCountdown(count - 1, onComplete);
      } else {
        // Final countdown step
        console.log("Countdown finished, clearing countdown display");
        setCountdownValue(null);
        setForceShowCountdown(false);
        
        // Update status for parent component
        if (onStatusUpdate) {
          onStatusUpdate({
            countdownValue: null,
            processStatus: 'Capturing...',
            isCapturing: true
          });
        }
        
        // Execute completion callback immediately
        if (onComplete) {
          console.log("Executing completion callback");
          onComplete();
        }
      }
    }, 800);
    
    return () => clearTimeout(timer);
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
  // Modified captureImage function in WhiteScreenMain.js

// Modified captureImage function for WhiteScreenMain.js

// Fixed captureImage function for WhiteScreenMain.js
const captureImage = async () => {
    console.log("Capturing images...");
    setIsCapturing(true);
    
    try {
      // Generate filenames with counter
      const screenFilename = `screen_${String(captureCounter).padStart(3, '0')}.jpg`;
      const webcamFilename = `webcam_${String(captureCounter).padStart(3, '0')}.jpg`;
      const parameterFilename = `parameter_${String(captureCounter).padStart(3, '0')}.csv`;
      
      // Capture screen image (canvas with dot)
      const canvas = activeCanvasRef.current;
      let screenImage = null;
      if (canvas) {
        console.log("Capturing screen from canvas");
        screenImage = canvas.toDataURL('image/png');
        await saveImageToServer(screenImage, screenFilename, 'screen');
        console.log(`Saved screen image: ${screenFilename}`);
      } else {
        console.error("Cannot capture screen - canvas ref is null");
      }
      
      // Capture webcam image if available
      let webcamImage = null;
      if (window.videoElement) {
        console.log("Capturing from webcam");
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        tempCanvas.width = window.videoElement.videoWidth;
        tempCanvas.height = window.videoElement.videoHeight;
        ctx.drawImage(window.videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
        webcamImage = tempCanvas.toDataURL('image/png');
        
        await saveImageToServer(webcamImage, webcamFilename, 'webcam');
        console.log(`Saved webcam image: ${webcamFilename}`);
      } else {
        // Try to silently capture from webcam
        try {
          // Create a temporary stream for just this capture
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: false 
          });
          
          // Create a hidden video element to receive the stream
          const tempVideo = document.createElement('video');
          tempVideo.autoplay = true;
          tempVideo.playsInline = true;
          tempVideo.muted = true;
          tempVideo.style.position = 'absolute';
          tempVideo.style.left = '-9999px'; // Position off-screen
          tempVideo.style.opacity = '0';
          document.body.appendChild(tempVideo);
          
          // Set the stream to the video element
          tempVideo.srcObject = stream;
          
          // Wait for video to initialize
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
          
          // Small delay to ensure a clear frame
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Capture the frame to a canvas
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = tempVideo.videoWidth || 640;
          tempCanvas.height = tempVideo.videoHeight || 480;
          const ctx = tempCanvas.getContext('2d');
          ctx.drawImage(tempVideo, 0, 0, tempCanvas.width, tempCanvas.height);
          
          // Get image data
          webcamImage = tempCanvas.toDataURL('image/png');
          console.log(`Captured webcam silently: ${webcamFilename}`);
          
          await saveImageToServer(webcamImage, webcamFilename, 'webcam');
          
          // IMPORTANT: Clean up - stop stream and remove video element
          stream.getTracks().forEach(track => track.stop());
          tempVideo.srcObject = null;
          if (tempVideo.parentNode) {
            tempVideo.parentNode.removeChild(tempVideo);
          }
          
        } catch (webcamError) {
          console.log("Webcam element not available and silent capture failed:", webcamError);
        }
      }
      
      // Save parameters to CSV
      try {
        // Create CSV content with two columns: name and value
        const csvData = [
          "name,value",
          `dot_x,${currentDot ? currentDot.x : 0}`,
          `dot_y,${currentDot ? currentDot.y : 0}`,
          `canvas_width,${canvas ? canvas.width : 0}`,
          `canvas_height,${canvas ? canvas.height : 0}`,
          `window_width,${window.innerWidth}`,
          `window_height,${window.innerHeight}`,
          `timestamp,${new Date().toISOString()}`
        ].join('\n');
        
        // Convert CSV to data URL
        const csvBlob = new Blob([csvData], { type: 'text/csv' });
        const csvReader = new FileReader();
        
        const csvDataUrl = await new Promise((resolve) => {
          csvReader.onloadend = () => resolve(csvReader.result);
          csvReader.readAsDataURL(csvBlob);
        });
        
        // Save CSV using the same API
        await saveImageToServer(csvDataUrl, parameterFilename, 'parameters');
        console.log(`Saved parameters CSV: ${parameterFilename}`);
        
      } catch (csvError) {
        console.error("Error saving parameter CSV:", csvError);
      }
      
      // THIS IS THE MISSING PIECE - Show preview after capturing
      console.log("Showing image preview with:", { 
        hasScreenImage: !!screenImage, 
        hasWebcamImage: !!webcamImage 
      });
      showCapturePreview(screenImage, webcamImage, currentDot);
      
      // Increment the counter for next capture
      setCaptureCounter(prev => prev + 1);
      
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
      }, 2500); // Increased to wait for preview to finish
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
  // Add this new function to show a preview of captured images
  const showCapturePreview = (screenImage, webcamImage, dotPosition) => {
    if (!screenImage && !webcamImage) return;
    
    // Create a container for the preview
    const previewContainer = document.createElement('div');
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
      z-index: 9999;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6);
    `;
    
    // Add screen image preview
    if (screenImage) {
      const screenPreview = document.createElement('div');
      screenPreview.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
      `;
      
      const screenImg = document.createElement('img');
      screenImg.src = screenImage;
      screenImg.style.cssText = `
        max-width: 300px;
        max-height: 200px;
        border: 3px solid white;
        border-radius: 8px;
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
    
    // Add webcam image preview
    if (webcamImage) {
      const webcamPreview = document.createElement('div');
      webcamPreview.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
      `;
      
      const webcamImg = document.createElement('img');
      webcamImg.src = webcamImage;
      webcamImg.style.cssText = `
        max-width: 300px;
        max-height: 200px;
        border: 3px solid white;
        border-radius: 8px;
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
    
    // Add position indicator if available
    if (dotPosition) {
      const positionInfo = document.createElement('div');
      positionInfo.textContent = `Dot position: x=${Math.round(dotPosition.x)}, y=${Math.round(dotPosition.y)}`;
      positionInfo.style.cssText = `
        color: #ffcc00;
        font-size: 14px;
        position: absolute;
        top: -30px;
        left: 0;
        width: 100%;
        text-align: center;
      `;
      previewContainer.appendChild(positionInfo);
    }
    
    // Add the preview to the document
    document.body.appendChild(previewContainer);
    
    // Remove preview after 2 seconds
    setTimeout(() => {
      document.body.removeChild(previewContainer);
    }, 2000);
  };
  
  // Random Dot action
  const handleRandomDot = () => {
    // Hide the TopBar before showing dot
    if (typeof toggleTopBar === 'function') {
      toggleTopBar(false);
    } else if (typeof window !== 'undefined' && window.toggleTopBar) {
      window.toggleTopBar(false);
    }
    
    setIsCapturing(true);
    setProcessStatus('Generating random dot...');
    
    // Give the component time to update
    setTimeout(() => {
      const canvas = activeCanvasRef.current;
      if (canvas) {
        // Make sure canvas dimensions are properly set
        const parent = canvas.parentElement;
        if (parent) {
          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;
        }
        
        // Clear any previous content
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Generate random position
        const position = getRandomPosition();
        
        // Draw the dot with a larger radius for visibility
        ctx.beginPath();
        ctx.arc(position.x, position.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'red';
        ctx.fill();
        
        // Add glow effect to the dot
        ctx.beginPath();
        ctx.arc(position.x, position.y, 15, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Store current dot position directly
        setCurrentDot(position);
        
        // Get the canvas position relative to the viewport
        const canvasRect = canvas.getBoundingClientRect();
        
        // IMPORTANT: Create the countdown element directly above the dot
        const countdownElement = document.createElement('div');
        countdownElement.className = 'forced-countdown';
        
        // Position it above the dot (calculate absolute position considering the canvas position)
        const absoluteX = canvasRect.left + position.x;
        const absoluteY = canvasRect.top + position.y;
        
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
        
        // Manual countdown implementation
        let count = 3;
        countdownElement.textContent = count;
        
        const countdownInterval = setInterval(() => {
          count--;
          if (count <= 0) {
            clearInterval(countdownInterval);
            countdownElement.remove();
            captureImage(); // Proceed with capture
          } else {
            countdownElement.textContent = count;
          }
        }, 800);
      }
    }, 200);
  };
  
  // Multiple random dots sequence
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
  
  // Schedule sequence of random captures
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
    const position = getRandomPosition();
    drawDot(position.x, position.y);
    
    // Start countdown and capture
    startCountdown(3, () => {
      captureImage();
      
      // Schedule next capture
      setTimeout(() => {
        scheduleRandomCaptures(remaining - 1, total, delay);
      }, delay * 1000);
    });
  };
  
  // Generate calibration points
  const generateCalibrationPoints = () => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return [];
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Helper function for rounding
    const conditionalRound = (dimension, percentage) => {
      return Math.round(dimension * percentage);
    };
    
    // Define percentage values for outer and inner frames
    const firstFramePercentage = 0.12;  // Outer frame at 12% from edges
    const secondFramePercentage = 0.26; // Inner frame at 26% from edges
    
    // Calculate points for outer frame (first frame)
    const xLeftFirst = conditionalRound(width, firstFramePercentage);
    const xRightFirst = width - conditionalRound(width, firstFramePercentage);
    const yTopFirst = conditionalRound(height, firstFramePercentage);
    const yBottomFirst = height - conditionalRound(height, firstFramePercentage);
    
    // Calculate points for inner frame (second frame)
    const xLeftSecond = conditionalRound(width, secondFramePercentage);
    const xRightSecond = width - conditionalRound(width, secondFramePercentage);
    const yTopSecond = conditionalRound(height, secondFramePercentage);
    const yBottomSecond = height - conditionalRound(height, secondFramePercentage);
    
    // Return array of points in specific order
    return [
      // First frame - outer points
      { x: xLeftFirst, y: yTopFirst },
      { x: Math.floor(width / 2), y: yTopFirst },
      { x: xRightFirst, y: yTopFirst },
      { x: xLeftFirst, y: Math.floor(height / 2) },
      { x: xRightFirst, y: Math.floor(height / 2) },
      { x: xLeftFirst, y: yBottomFirst },
      { x: Math.floor(width / 2), y: yBottomFirst },
      { x: xRightFirst, y: yBottomFirst },
      
      // Second frame - inner points
      { x: xLeftSecond, y: yTopSecond },
      { x: Math.floor(width / 2), y: yTopSecond },
      { x: xRightSecond, y: yTopSecond },
      { x: xLeftSecond, y: Math.floor(height / 2) },
      { x: xRightSecond, y: Math.floor(height / 2) },
      { x: xLeftSecond, y: yBottomSecond },
      { x: Math.floor(width / 2), y: yBottomSecond },
      { x: xRightSecond, y: yBottomSecond }
    ];
  };
  // In WhiteScreenMain.js - Update the useEffect for button click registration

  // Make sure the calibrate action is properly registered
  useEffect(() => {
    // Skip during SSR
    if (typeof window === 'undefined') return;
    
    console.log("Registering action handlers with parent");
    
    if (onButtonClick) {
      // Create action handlers with proper method references
      const actionHandlers = {
        randomDot: handleRandomDot,
        setRandom: handleSetRandom,
        calibrate: handleSetCalibrate, // Make sure this handler exists
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

  // Add this import at the top of WhiteScreenMain.js

  // Replace the handleSetCalibrate function with this improved version
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

  // Fix for startCountdown function to hide TopBar immediately
  // const startCountdown = (count, onComplete) => {
  //   console.log("Starting countdown from:", count);
    
  //   // Hide TopBar immediately when countdown starts
  //   if (typeof toggleTopBar === 'function') {
  //     toggleTopBar(false);
  //   } else if (typeof window !== 'undefined' && window.toggleTopBar) {
  //     window.toggleTopBar(false);
  //   }
    
  //   // Set countdown value in state
  //   setCountdownValue(count);
  //   setForceShowCountdown(true);
  //   setIsCapturing(true);
    
  //   // Update status for parent component
  //   if (onStatusUpdate) {
  //     onStatusUpdate({
  //       countdownValue: count,
  //       processStatus: `Countdown: ${count}`,
  //       isCapturing: true
  //     });
  //   }
    
  //   const timer = setTimeout(() => {
  //     if (count > 1) {
  //       startCountdown(count - 1, onComplete);
  //     } else {
  //       // Final countdown step
  //       console.log("Countdown finished, clearing countdown display");
  //       setCountdownValue(null);
  //       setForceShowCountdown(false);
        
  //       // Update status for parent component
  //       if (onStatusUpdate) {
  //         onStatusUpdate({
  //           countdownValue: null,
  //           processStatus: 'Capturing...',
  //           isCapturing: true
  //         });
  //       }
        
  //       // Execute completion callback immediately
  //       if (onComplete) {
  //         console.log("Executing completion callback");
  //         onComplete();
  //       }
  //     }
  //   }, 800);
    
  //   return () => clearTimeout(timer);
  // };
  // Move to next calibration point
  const moveToNextCalibrationPoint = () => {
    const nextIndex = currentCalibrationIndex + 1;
    
    // Check if we're done
    if (nextIndex >= calibrationPoints.length) {
      setIsCapturing(false);
      setRemainingCaptures(0);
      setProcessStatus('Calibration completed');
      
      // Clear status after a delay
      setTimeout(() => {
        setProcessStatus('');
      }, 2000);
      
      return;
    }
    
    // Update state and progress
    setCurrentCalibrationIndex(nextIndex);
    setRemainingCaptures(calibrationPoints.length - nextIndex);
    setProcessStatus(`Calibration ${nextIndex + 1}/${calibrationPoints.length}`);
    
    // Draw next point
    const nextPoint = calibrationPoints[nextIndex];
    drawDot(nextPoint.x, nextPoint.y);
    
    // Start countdown for this point
    startCountdown(3, () => {
      captureImage();
      setTimeout(() => moveToNextCalibrationPoint(), 1000);
    });
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
  
  // // Pass actions up to parent component
  // useEffect(() => {
  //   // Skip during SSR
  //   if (typeof window === 'undefined') return;
    
  //   console.log("Registering action handlers with parent");
    
  //   if (onButtonClick) {
  //     // Create action handlers
  //     const actionHandlers = {
  //       randomDot: handleRandomDot,
  //       setRandom: handleSetRandom,
  //       calibrate: handleSetCalibrate,
  //       clearAll: clearCanvas
  //     };
      
  //     // Store in parent component context
  //     onButtonClick('registerActions', actionHandlers);
  //   }
  // }, [onButtonClick]);
  
  // Update parent with status changes
  useEffect(() => {
    if (onStatusUpdate && processStatus) {
      onStatusUpdate(processStatus);
    }
  }, [processStatus, onStatusUpdate]);
  
  // Log when component mounts to verify it's being rendered
  useEffect(() => {
    console.log("WhiteScreenMain component mounted");
    console.log("Props:", { 
      hasStatusUpdate: !!onStatusUpdate, 
      hasCameraAccess: !!triggerCameraAccess,
      hasButtonClick: !!onButtonClick,
      hasCanvasRef: !!canvasRef,
      hasToggleTopBar: !!toggleTopBar 
    });
    
    return () => {
      console.log("WhiteScreenMain component unmounting");
    };
  }, []);
  
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
      
      {/* Manual test button for direct testing
      <button
        onClick={handleRandomDot}
        style={{
          position: 'absolute',
          bottom: '70px',
          right: '20px',
          padding: '10px 20px',
          backgroundColor: 'blue',
          color: 'white',
          fontWeight: 'bold',
          borderRadius: '8px',
          border: 'none',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          zIndex: 1000
        }}
      >
        TEST DOT NOW
      </button> */}
    </div>
  );
};

// Export a dynamic version with SSR disabled to avoid useLayoutEffect warnings
export default dynamic(() => Promise.resolve(WhiteScreenMain), { ssr: false });