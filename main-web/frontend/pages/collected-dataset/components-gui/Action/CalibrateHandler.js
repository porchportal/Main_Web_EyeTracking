// CalibrateHandler.js - This should be placed in the components-gui folder
// This is a complete implementation of the calibration functionality
import { generateCalibrationPoints } from './CalibratePoints';

class CalibrateHandler {
  constructor(config) {
    // Required properties
    this.canvasRef = config.canvasRef;
    this.toggleTopBar = config.toggleTopBar;
    this.setOutputText = config.setOutputText;
    this.captureCounter = config.captureCount || 1;
    this.setCaptureCounter = config.setCaptureCounter;
    this.captureFolder = config.captureFolder || 'eye_tracking_captures';
    this.onComplete = config.onComplete;
    
    // Internal state
    this.isProcessing = false;
    this.currentPointIndex = 0;
    this.calibrationPoints = [];
    this.statusIndicator = null;
    this.countdownElement = null;
  }
  
  // Create a status indicator in the top right corner
  createStatusIndicator() {
    // Remove any existing indicators first
    const existingIndicators = document.querySelectorAll('.calibrate-status-indicator');
    existingIndicators.forEach(indicator => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    });
    
    // Create new status indicator
    const indicator = document.createElement('div');
    indicator.className = 'calibrate-status-indicator';
    indicator.style.cssText = `
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
    
    document.body.appendChild(indicator);
    this.statusIndicator = indicator;
    return indicator;
  }
  
  // Draw a specific calibration point
  drawCalibrationPoint(point) {
    const canvas = this.canvasRef.current;
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw the point with larger radius and glow effect
    const radius = 8;
    
    // Draw the calibration point
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'red';
    ctx.fill();
    
    // Add glow effect
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    return { x: point.x, y: point.y };
  }
  
  // Create a countdown element above the current dot
  createCountdownElement(position) {
    // Remove any existing countdown elements
    const existingCountdowns = document.querySelectorAll('.calibrate-countdown, .center-countdown-backup');
    existingCountdowns.forEach(countdown => {
      if (countdown.parentNode) {
        countdown.parentNode.removeChild(countdown);
      }
    });
    
    // Get canvas position for absolute positioning
    const canvas = this.canvasRef.current;
    if (!canvas) return null;
    
    const canvasRect = canvas.getBoundingClientRect();
    
    // Calculate absolute position
    const absoluteX = canvasRect.left + position.x;
    const absoluteY = canvasRect.top + position.y;
    
    // Create new countdown element positioned above the dot
    const countdown = document.createElement('div');
    countdown.className = 'calibrate-countdown';
    countdown.style.cssText = `
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
    
    document.body.appendChild(countdown);
    this.countdownElement = countdown;
    
    return { dot: countdown };
  }
  
  // Capture screen image
  async captureScreenImage() {
    try {
      const canvas = this.canvasRef.current;
      if (!canvas) throw new Error("Canvas reference is null");
      
      // Format filename with counter
      const counter = String(this.captureCounter).padStart(3, '0');
      const filename = `screen_${counter}.jpg`;
      
      // Capture image data
      const imageData = canvas.toDataURL('image/png');
      
      // Save image via API
      const response = await fetch('/api/save-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData,
          filename,
          type: 'screen',
          folder: this.captureFolder
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`Saved screen image: ${filename}`);
      
      return { data: imageData, response: result };
    } catch (error) {
      console.error("Error capturing screen image:", error);
      throw error;
    }
  }
  
  // Capture webcam image silently
  async captureWebcamImage() {
    let stream = null;
    let tempVideo = null;
    
    try {
      // Format filename with counter
      const counter = String(this.captureCounter).padStart(3, '0');
      const filename = `webcam_${counter}.jpg`;
      
      // Look for an existing video element first
      const videoElement = window.videoElement || document.querySelector('video');
      
      if (videoElement && videoElement.readyState >= 2) {
        // If we have a video element that's loaded, use it
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        tempCanvas.width = videoElement.videoWidth || 640;
        tempCanvas.height = videoElement.videoHeight || 480;
        
        ctx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
        const imageData = tempCanvas.toDataURL('image/png');
        
        // Save the image
        const response = await fetch('/api/save-capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData,
            filename,
            type: 'webcam',
            folder: this.captureFolder
          })
        });
        
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        
        const result = await response.json();
        console.log(`Saved webcam image: ${filename}`);
        
        return { data: imageData, response: result };
      }
      
      // If no video element, create a temporary one
      // Create a temporary stream for just this capture
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      
      // Create a hidden video element to receive the stream
      tempVideo = document.createElement('video');
      tempVideo.autoplay = true;
      tempVideo.playsInline = true;
      tempVideo.muted = true;
      tempVideo.style.position = 'absolute';
      tempVideo.style.left = '-9999px';
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
      
      // Check if video dimensions are valid
      if (tempVideo.videoWidth === 0 || tempVideo.videoHeight === 0) {
        console.warn("Video dimensions are invalid, using default dimensions");
      }
      
      // Capture the frame to a canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = tempVideo.videoWidth || 640;
      tempCanvas.height = tempVideo.videoHeight || 480;
      const ctx = tempCanvas.getContext('2d');
      
      ctx.drawImage(tempVideo, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // Get image data
      const imageData = tempCanvas.toDataURL('image/png');
      
      // Save the image via API
      const response = await fetch('/api/save-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData,
          filename,
          type: 'webcam',
          folder: this.captureFolder
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`Saved webcam image: ${filename}`);
      
      return { data: imageData, response: result };
    } catch (error) {
      console.error("Error capturing webcam image:", error);
      return { data: null, response: null };
    } finally {
      // IMPORTANT: Clean up resources even if there was an error
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      if (tempVideo) {
        tempVideo.srcObject = null;
        if (tempVideo.parentNode) {
          tempVideo.parentNode.removeChild(tempVideo);
        }
      }
    }
  }
  
  // Save parameter CSV
  async saveParameterCSV(point, index) {
    try {
      // Format filename with counter
      const counter = String(this.captureCounter).padStart(3, '0');
      const filename = `parameter_${counter}.csv`;
      
      const canvas = this.canvasRef.current;
      
      // Create CSV content with two columns: name and value
      const csvData = [
        "name,value",
        `dot_x,${point.x}`,
        `dot_y,${point.y}`,
        `canvas_width,${canvas ? canvas.width : 0}`,
        `canvas_height,${canvas ? canvas.height : 0}`,
        `window_width,${window.innerWidth}`,
        `window_height,${window.innerHeight}`,
        `calibration_point_index,${index}`,
        `calibration_point_label,${point.label || ''}`,
        `timestamp,${new Date().toISOString()}`
      ].join('\n');
      
      // Convert CSV to data URL
      const csvBlob = new Blob([csvData], { type: 'text/csv' });
      const csvReader = new FileReader();
      
      const csvDataUrl = await new Promise((resolve) => {
        csvReader.onloadend = () => resolve(csvReader.result);
        csvReader.readAsDataURL(csvBlob);
      });
      
      // Save CSV using the API
      const response = await fetch('/api/save-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: csvDataUrl,
          filename,
          type: 'parameters',
          folder: this.captureFolder
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`Saved parameter CSV: ${filename}`);
      
      return result;
    } catch (error) {
      console.error("Error saving parameter CSV:", error);
      throw error;
    }
  }
  
  // Show preview of captured images - made identical to WhiteScreenMain implementation
  showCapturePreview(screenImage, webcamImage, point) {
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
    if (point) {
      const positionInfo = document.createElement('div');
      positionInfo.textContent = point.label ?
        `${point.label}: x=${Math.round(point.x)}, y=${Math.round(point.y)}` :
        `Dot position: x=${Math.round(point.x)}, y=${Math.round(point.y)}`;
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
  }
  
  // Run the countdown animation for a point - simplified to only show countdown above dot
  async runCountdown(point, index, total) {
    // Create countdown element
    const countdownElements = this.createCountdownElement(point);
    if (!countdownElements) return false;
    
    const { dot: countdownElement } = countdownElements;
    
    // Run 3-2-1 countdown
    for (let count = 3; count > 0; count--) {
      // Update countdown display
      countdownElement.textContent = count;
      
      // Update status indicator
      if (this.statusIndicator) {
        this.statusIndicator.textContent = `Calibrate Set Active: countdown ${count} (${index + 1}/${total})`;
      }
      
      // Update output text if available
      if (this.setOutputText) {
        this.setOutputText(`Calibration point ${index + 1}/${total} - countdown ${count}`);
      }
      
      // Wait for the next countdown step
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Show capturing indicator briefly
    countdownElement.textContent = "✓";
    
    if (this.statusIndicator) {
      this.statusIndicator.textContent = `Capturing point ${index + 1}/${total}`;
    }
    
    // Remove countdown element immediately after capture to only show the dot
    // This ensures we see ONLY the red dot after capture, not the countdown indicators
    setTimeout(() => {
      if (countdownElement.parentNode) {
        countdownElement.parentNode.removeChild(countdownElement);
      }
    }, 300);
    
    return true;
  }
  
  // Process a single calibration point
  async processCalibrationPoint(point, index, total) {
    try {
      // Draw the calibration point
      this.drawCalibrationPoint(point);
      
      // Run countdown animation - same as RandomDot
      await this.runCountdown(point, index, total);
      
      // Capture screen image
      const screenResult = await this.captureScreenImage();
      
      // Capture webcam image
      const webcamResult = await this.captureWebcamImage();
      
      // Save parameter CSV
      await this.saveParameterCSV(point, index);
      
      // Increment capture counter for next capture
      if (this.setCaptureCounter) {
        // If the server returned a new capture number, use it
        if (screenResult.response && screenResult.response.captureNumber !== undefined) {
          this.captureCounter = screenResult.response.captureNumber + 1;
          this.setCaptureCounter(this.captureCounter);
        } else {
          this.captureCounter++;
          this.setCaptureCounter(this.captureCounter);
        }
      }
      
      // Show preview
      this.showCapturePreview(
        screenResult.data,
        webcamResult ? webcamResult.data : null,
        point
      );
      
      // Wait for preview to complete
      await new Promise(resolve => setTimeout(resolve, 2300));
      
      return true;
    } catch (error) {
      console.error(`Error processing calibration point ${index + 1}:`, error);
      
      if (this.statusIndicator) {
        this.statusIndicator.textContent = `Error: ${error.message}`;
      }
      
      if (this.setOutputText) {
        this.setOutputText(`Error: ${error.message}`);
      }
      
      return false;
    }
  }
  
  // Start the full calibration sequence
  async startCalibration() {
    if (this.isProcessing) return false;
    this.isProcessing = true;
    
    // Hide the TopBar IMMEDIATELY (first action)
    if (typeof this.toggleTopBar === 'function') {
      this.toggleTopBar(false);
    }
    
    // Small delay to ensure UI updates
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Create status indicator
    const statusIndicator = this.createStatusIndicator();
    statusIndicator.textContent = 'Calibrate Set Active: Initializing...';
    
    try {
      // Generate calibration points
      const canvas = this.canvasRef.current;
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas is not ready');
      }

      this.calibrationPoints = generateCalibrationPoints(canvas.width, canvas.height);

      if (!this.calibrationPoints.length) {
        throw new Error('Failed to generate calibration points');
      }
      
      // Update status
      if (this.setOutputText) {
        this.setOutputText(`Starting calibration with ${this.calibrationPoints.length} points`);
      }
      
      // Process each calibration point in sequence
      for (let i = 0; i < this.calibrationPoints.length; i++) {
        statusIndicator.textContent = `Processing point ${i + 1}/${this.calibrationPoints.length}`;
        
        // Process current point
        const success = await this.processCalibrationPoint(
          this.calibrationPoints[i],
          i,
          this.calibrationPoints.length
        );
        
        // If processing failed, stop the sequence
        if (!success) {
          throw new Error(`Failed to process point ${i + 1}`);
        }
      }
      
      // Calibration complete
      statusIndicator.textContent = 'Calibration completed';
      
      if (this.setOutputText) {
        this.setOutputText('Calibration completed successfully');
      }
      
      return true;
    } catch (error) {
      console.error('Calibration error:', error);
      
      if (statusIndicator) {
        statusIndicator.textContent = `Error: ${error.message}`;
      }
      
      if (this.setOutputText) {
        this.setOutputText(`Calibration error: ${error.message}`);
      }
      
      return false;
    } finally {
      this.isProcessing = false;
      
      // Show TopBar again
      if (typeof this.toggleTopBar === 'function') {
        this.toggleTopBar(true);
      }
      
      // Remove status indicator after a delay
      setTimeout(() => {
        if (statusIndicator && statusIndicator.parentNode) {
          statusIndicator.parentNode.removeChild(statusIndicator);
        }
      }, 3000);
      
      // Call onComplete callback if provided
      if (typeof this.onComplete === 'function') {
        this.onComplete();
      }
    }
  }
}

export default CalibrateHandler;