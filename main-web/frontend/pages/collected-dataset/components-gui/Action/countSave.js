// countSave.js
// Shared functionality for countdown and image capture processes

/**
 * Creates and displays a countdown element above a dot position
 * @param {Object} position - {x, y} position of the dot
 * @param {DOMRect} canvasRect - getBoundingClientRect() of the canvas
 * @param {Function} onComplete - Callback to execute when countdown finishes
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
  
            if (position && typeof position.x === 'number' && typeof position.y === 'number') {
                drawRedDot(ctx, position.x, position.y);
            } else {
                console.warn("[runCountdown] Position is null after countdown", position);
            }
  
            if (onComplete) {
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
   * Captures images from both canvas and webcam
   * @param {Object} options - Capture options
   * @param {React.RefObject} options.canvasRef - Ref to the canvas element
   * @param {Object} options.position - {x, y} position of the dot
   * @param {number} options.captureCounter - Current capture counter
   * @param {Function} options.saveImageToServer - Function to save image to server
   * @param {Function} options.setCaptureCounter - Function to update capture counter
   * @param {Function} options.setProcessStatus - Function to update process status
   * @param {Function} options.toggleTopBar - Function to toggle top bar visibility
   * @param {string} options.captureFolder - Folder to save captures in
   * @returns {Object} - Result with captured image data
   */
  export const captureImages = async (options) => {
    const {
      canvasRef,
      position,
      captureCounter,
      saveImageToServer,
      setCaptureCounter,
      setProcessStatus,
      toggleTopBar,
      captureFolder = 'eye_tracking_captures'
    } = options;
  
    try {
      const counter = String(captureCounter).padStart(3, '0');
      const screenFilename = `screen_${counter}.jpg`;
      const webcamFilename = `webcam_${counter}.jpg`;
      const parameterFilename = `parameter_${counter}.csv`;
  
      console.log(`Starting capture process with counter: ${counter}`);
      console.log(`Dot position: x=${position.x}, y=${position.y}`);
  
      let screenImageData = null;
      let webcamImageData = null;
      let usedCaptureNumber = captureCounter;
  
      // === 1. Capture screen image from canvas ===
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          const ctx = canvas.getContext('2d');
  
          // ✅ Make sure the red dot is drawn RIGHT before screen capture
          drawRedDot(ctx, position.x, position.y);
  
          console.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`);
          screenImageData = canvas.toDataURL('image/png');
          console.log(`Screen image captured, size: ${screenImageData.length} chars`);
  
          if (saveImageToServer) {
            const screenResponse = await saveImageToServer(
              screenImageData,
              screenFilename,
              'screen',
              captureFolder
            );
  
            if (screenResponse && screenResponse.captureNumber) {
              usedCaptureNumber = screenResponse.captureNumber;
              console.log(`Server assigned capture number: ${usedCaptureNumber}`);
            }
          }
        } catch (screenError) {
          console.error("Error capturing or saving screen image:", screenError);
        }
      } else {
        console.error("Canvas reference is null, cannot capture screen");
      }
  
      // === 2. Capture webcam image ===
      try {
        console.log("Attempting to capture webcam silently");
  
        const videoElement = window.videoElement || document.querySelector('video');
  
        if (videoElement && videoElement.readyState >= 2) {
          const tempCanvas = document.createElement('canvas');
          const ctx = tempCanvas.getContext('2d');
          tempCanvas.width = videoElement.videoWidth || 640;
          tempCanvas.height = videoElement.videoHeight || 480;
  
          ctx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
          webcamImageData = tempCanvas.toDataURL('image/png');
  
          if (saveImageToServer) {
            await saveImageToServer(
              webcamImageData,
              `webcam_${String(usedCaptureNumber).padStart(3, '0')}.jpg`,
              'webcam',
              captureFolder
            );
          }
        } else {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
  
          const tempVideo = document.createElement('video');
          tempVideo.autoplay = true;
          tempVideo.playsInline = true;
          tempVideo.muted = true;
          tempVideo.style.position = 'absolute';
          tempVideo.style.left = '-9999px';
          tempVideo.style.opacity = '0';
          document.body.appendChild(tempVideo);
  
          tempVideo.srcObject = stream;
  
          await new Promise((resolve) => {
            const timeoutId = setTimeout(resolve, 1000);
            tempVideo.onloadeddata = () => {
              clearTimeout(timeoutId);
              resolve();
            };
          });
  
          await new Promise(resolve => setTimeout(resolve, 200));
  
          const tempCanvas = document.createElement('canvas');
          const ctx = tempCanvas.getContext('2d');
          tempCanvas.width = tempVideo.videoWidth || 640;
          tempCanvas.height = tempVideo.videoHeight || 480;
  
          ctx.drawImage(tempVideo, 0, 0, tempCanvas.width, tempCanvas.height);
          webcamImageData = tempCanvas.toDataURL('image/png');
  
          if (saveImageToServer) {
            await saveImageToServer(
              webcamImageData,
              `webcam_${String(usedCaptureNumber).padStart(3, '0')}.jpg`,
              'webcam',
              captureFolder
            );
          }
  
          stream.getTracks().forEach(track => track.stop());
          tempVideo.srcObject = null;
          if (tempVideo.parentNode) {
            tempVideo.parentNode.removeChild(tempVideo);
          }
        }
      } catch (webcamError) {
        console.error("Error capturing webcam silently:", webcamError);
      }
  
      // === 3. Save parameter CSV ===
      try {
        console.log("Creating parameter CSV");
  
        const csvData = [
          "name,value",
          `dot_x,${position.x}`,
          `dot_y,${position.y}`,
          `canvas_width,${canvas ? canvas.width : 0}`,
          `canvas_height,${canvas ? canvas.height : 0}`,
          `window_width,${window.innerWidth}`,
          `window_height,${window.innerHeight}`,
          `timestamp,${new Date().toISOString()}`
        ].join('\n');
  
        const csvBlob = new Blob([csvData], { type: 'text/csv' });
        const csvReader = new FileReader();
  
        const csvDataUrl = await new Promise((resolve) => {
          csvReader.onloadend = () => resolve(csvReader.result);
          csvReader.readAsDataURL(csvBlob);
        });
  
        if (saveImageToServer) {
          await saveImageToServer(
            csvDataUrl,
            `parameter_${String(usedCaptureNumber).padStart(3, '0')}.csv`,
            'parameters',
            captureFolder
          );
        }
      } catch (csvError) {
        console.error("Error saving parameter CSV:", csvError);
      }
  
      // === 4. Update counter ===
      if (setCaptureCounter) {
        setCaptureCounter(usedCaptureNumber + 1);
      }
  
      // === 5. Set process status ===
      if (setProcessStatus) {
        setProcessStatus(`Captured with dot at: x=${position.x}, y=${position.y}`);
      }
  
      // === 6. Return capture data ===
      return {
        screenImage: screenImageData,
        webcamImage: webcamImageData,
        position,
        captureNumber: usedCaptureNumber
      };
    } catch (error) {
      console.error("Error during capture:", error);
      if (setProcessStatus) {
        setProcessStatus(`Error capturing images: ${error.message}`);
      }
      throw error;
    }
  };
  
  /**
   * Display a preview of the captured images
   * @param {string} screenImage - Data URL of the screen image
   * @param {string} webcamImage - Data URL of the webcam image
   * @param {Object} dotPosition - {x, y} position of the dot
   */
  export const showCapturePreview = (screenImage, webcamImage, dotPosition) => {
    if (!screenImage && !webcamImage) {
      console.warn("No images available to preview");
      return;
    }
  
    // Remove any existing preview containers first
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
    
    // Create a new preview container
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
    
    // Function to add an image to the preview
    const addImagePreview = (image, label) => {
      try {
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
        return true;
      } catch (error) {
        console.error(`Error adding ${label} preview:`, error);
        return false;
      }
    };
    
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
    document.body.appendChild(previewContainer);
    
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
        previewContainer.parentNode.removeChild(previewContainer);
      }
    }, 5000);
    
    return previewContainer;
  };
  
  /**
   * Complete capture and preview process
   * @param {Object} options - Process options
   * @param {React.RefObject} options.canvasRef - Ref to the canvas element
   * @param {Object} options.position - {x, y} position of the dot
   * @param {number} options.captureCounter - Current capture counter
   * @param {Function} options.saveImageToServer - Function to save image to server
   * @param {Function} options.setCaptureCounter - Function to update capture counter
   * @param {Function} options.setProcessStatus - Function to update process status
   * @param {Function} options.toggleTopBar - Function to toggle top bar visibility
   * @param {Function} options.onStatusUpdate - Function to update status
   * @param {string} options.captureFolder - Folder to save captures in
   */
  export const captureAndPreviewProcess = async (options) => {
    const {
      canvasRef,
      position,
      captureCounter,
      saveImageToServer,
      setCaptureCounter,
      setProcessStatus,
      toggleTopBar,
      onStatusUpdate,
      captureFolder = 'eye_tracking_captures'
    } = options;
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
        console.error('[captureImages] Invalid position:', position);
        setProcessStatus?.('Error: Invalid dot position (captureImages)');
        return;
      }
    
    
    let dotInterval;
    
    try {
        // Make sure we have a valid canvas reference
        if (!canvasRef?.current) {
            throw new Error("Canvas reference is invalid");
        }
        
        // Draw the dot in its position first to ensure it's visible
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Initially draw the dot
        drawRedDot(ctx, position.x, position.y);
        
        // Create an interval to keep redrawing the dot to ensure it stays visible
        dotInterval = setInterval(() => {
            drawRedDot(ctx, position.x, position.y);
        }, 200);
      
      // First run the countdown
    //   await runCountdown(
    //     position,
    //     canvasRef.current,
    //     onStatusUpdate, 
    //     null // No callback here as we'll handle it directly
    //   );
        await runCountdown(position, canvas, onStatusUpdate, async () => {
            try {
            // ✅ Validate again here if needed
            if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
                throw new Error('Position is missing after countdown');
            }
        
            // Capture both canvas and webcam
            const result = await captureImages({
                canvasRef,
                position,
                captureCounter,
                saveImageToServer,
                setCaptureCounter,
                setProcessStatus,
                toggleTopBar,
                captureFolder
            });
        
            return result;
            } catch (err) {
            console.error('[captureAndPreviewProcess] Error during capture:', err);
            setProcessStatus?.(`Error: ${err.message}`);
            }
        });
      
        // Make sure dot is visible after countdown
        drawRedDot(ctx, position.x, position.y);
        
        // Capture the images
        const captureResult = await captureImages({
            canvasRef,
            position,
            captureCounter,
            saveImageToServer,
            setCaptureCounter,
            setProcessStatus,
            toggleTopBar,
            captureFolder
        });
        
        // Make sure dot is visible after capturing
        drawRedDot(ctx, position.x, position.y);
        
        // Show preview of captured images
        showCapturePreview(
            captureResult.screenImage,
            captureResult.webcamImage,
            captureResult.position
        );
        
        // Make sure dot is visible after preview
        drawRedDot(ctx, position.x, position.y);
        
        // Show TopBar again after a delay
        setTimeout(() => {
            if (typeof toggleTopBar === 'function') {
            toggleTopBar(true);
            } else if (typeof window !== 'undefined' && window.toggleTopBar) {
            window.toggleTopBar(true);
            }
            
            // Make sure dot is still visible even after showing TopBar
            drawRedDot(ctx, position.x, position.y);
        }, 2500);
        
        return captureResult;
    } catch (error) {
      console.error("Error in capture and preview process:", error);
      if (setProcessStatus) {
        setProcessStatus(`Error: ${error.message}`);
      }
      
      // Show TopBar again even if error occurred
      setTimeout(() => {
        if (typeof toggleTopBar === 'function') {
          toggleTopBar(true);
        } else if (typeof window !== 'undefined' && window.toggleTopBar) {
          window.toggleTopBar(true);
        }
      }, 1500);
      
      throw error;
    } finally {
      // Clear the dot redraw interval if it was created
      if (dotInterval) {
        clearInterval(dotInterval);
      }
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
   * Initialize canvas for drawing
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {HTMLElement} parent - Parent element for dimensions
   * @returns {boolean} - Success status
   */
  export const initializeCanvas = (canvas, parent) => {
    if (!canvas || !parent) return false;
    
    // Set canvas dimensions to match parent
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    
    // Clear canvas and set white background
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    return true;
  };