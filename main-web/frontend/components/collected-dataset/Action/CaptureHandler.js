// CaptureHandler.js - With fixed capture numbering

class CaptureHandler {
    constructor(saveFunction, counterSetter, statusSetter, toggleTopBarFunction) {
      this.saveImageToServer = saveFunction;
      this.setCaptureCounter = counterSetter;
      this.setProcessStatus = statusSetter;
      this.toggleTopBar = toggleTopBarFunction;
      this.captureFolder = 'eye_tracking_captures'; // Use fixed folder name
    }
  
    // Show preview of the SAVED images for exactly 2 seconds
    showCapturePreview(screenImage, webcamImage, dotPosition) {
      // Create a centered preview container
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
        z-index: 999999;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6);
        opacity: 1;
        transition: opacity 0.3s ease;
      `;
      
      // Function to create an image preview element
      const createImagePreview = (imageData, label) => {
        if (!imageData) return null;
        
        const preview = document.createElement('div');
        preview.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
        `;
        
        const img = document.createElement('img');
        img.src = imageData;
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
        
        const textLabel = document.createElement('div');
        textLabel.textContent = label;
        textLabel.style.cssText = `
          color: white;
          font-size: 14px;
          margin-top: 10px;
          font-weight: bold;
        `;
        
        preview.appendChild(img);
        preview.appendChild(textLabel);
        return preview;
      };
      
      // Add debug info
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
      
      // Add screen capture preview
      const screenPreview = createImagePreview(screenImage, 'Screen Capture');
      if (screenPreview) {
        previewContainer.appendChild(screenPreview);
      }
      
      // Add webcam capture preview
      const webcamPreview = createImagePreview(webcamImage, 'Webcam Capture');
      if (webcamPreview) {
        previewContainer.appendChild(webcamPreview);
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
      
      // Add timer countdown
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
      
      // Add the preview to the document
      document.body.appendChild(previewContainer);
      
      // Start countdown timer
      let timeLeft = 2.0;
      const interval = setInterval(() => {
        timeLeft -= 0.1;
        if (timeLeft <= 0) {
          clearInterval(interval);
          // Fade out
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
    }
  
    // Take a webcam picture and immediately stop the stream
    async captureWebcamImage(captureNumber) {
      let stream = null;
      let tempVideo = null;
      
      try {
        // Format the filename with the current counter
        const filename = `webcam_${String(captureNumber).padStart(3, '0')}.jpg`;
        
        // Create a new stream with high resolution constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 4096 },
            height: { ideal: 2160 },
            facingMode: "user"
          },
          audio: false
        });
        
        // Create a temporary video element
        tempVideo = document.createElement('video');
        tempVideo.autoplay = true;
        tempVideo.playsInline = true;
        tempVideo.muted = true;
        tempVideo.style.position = 'absolute';
        tempVideo.style.left = '-9999px';
        tempVideo.style.opacity = '0';
        document.body.appendChild(tempVideo);
        
        // Connect stream to video element
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
        
        // Get actual video dimensions
        const videoWidth = tempVideo.videoWidth || 640;
        const videoHeight = tempVideo.videoHeight || 480;
        console.log(`Capturing at resolution: ${videoWidth}x${videoHeight}`);
        
        // Capture the frame at full resolution
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = videoWidth;
        tempCanvas.height = videoHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(tempVideo, 0, 0, videoWidth, videoHeight);
        
        // Convert to JPEG with high quality
        const imageData = tempCanvas.toDataURL('image/jpeg', 0.95);
        
        // Save the image
        await this.saveImageToServer(imageData, filename, 'webcam', this.captureFolder);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        tempVideo.remove();
        
        return true;
      } catch (error) {
        console.error('Error capturing webcam image:', error);
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        if (tempVideo) {
          tempVideo.remove();
        }
        return false;
      }
    }
  
    // Capture screen image from canvas
    async captureScreenImage(canvasRef, captureNumber) {
      try {
        // Format the filename with the current counter
        const filename = `screen_${String(captureNumber).padStart(3, '0')}.jpg`;
        
        const canvas = canvasRef.current;
        if (!canvas) {
          console.error("Canvas reference is null");
          return { imageData: null, saveResponse: null };
        }
        
        // Get image data
        const imageData = canvas.toDataURL('image/png');
        
        // Save the image
        if (this.saveImageToServer) {
          const saveResponse = await this.saveImageToServer(imageData, filename, 'screen', this.captureFolder);
          console.log(`Saved screen image: ${filename}, response:`, saveResponse);
          return { imageData, saveResponse };
        }
        
        return { imageData, saveResponse: null };
      } catch (error) {
        console.error("Error capturing screen image:", error);
        return { imageData: null, saveResponse: null };
      }
    }
    
    // Save parameter CSV
    async saveParameterCSV(captureNumber, params) {
      try {
        // Format the filename with the current counter
        const filename = `parameter_${String(captureNumber).padStart(3, '0')}.csv`;
        
        // Create CSV content with two columns: name and value
        const csvData = [
          "name,value",
          ...Object.entries(params).map(([name, value]) => `${name},${value}`)
        ].join('\n');
        
        // Convert CSV to data URL
        const csvBlob = new Blob([csvData], { type: 'text/csv' });
        const csvReader = new FileReader();
        
        const csvDataUrl = await new Promise((resolve) => {
          csvReader.onloadend = () => resolve(csvReader.result);
          csvReader.readAsDataURL(csvBlob);
        });
        
        // Save CSV using the API
        if (this.saveImageToServer) {
          const saveResponse = await this.saveImageToServer(csvDataUrl, filename, 'parameters', this.captureFolder);
          console.log(`Saved parameter CSV: ${filename}`);
          return saveResponse;
        }
        
        return null;
      } catch (csvError) {
        console.error("Error saving parameter CSV:", csvError);
        return null;
      }
    }
  
    // Main capture and show process
    async captureAndShowPreview(captureCounter, canvasRef, position) {
      try {
        console.log(`Starting capture process with counter: ${captureCounter}`);
        
        // Step 1: Capture screen image
        const { imageData: screenImage, saveResponse: screenResponse } = await this.captureScreenImage(canvasRef, captureCounter);
        
        // Get the capture number from the response if available (for continuous numbering)
        let usedCaptureNumber = captureCounter;
        if (screenResponse && screenResponse.captureNumber) {
          usedCaptureNumber = screenResponse.captureNumber;
          console.log(`Server assigned capture number: ${usedCaptureNumber}`);
        }
        
        // Step 2: Capture webcam image (and immediately stop stream)
        const webcamSuccess = await this.captureWebcamImage(usedCaptureNumber);
        
        // Step 3: Save parameters
        const params = {
          dot_x: position ? position.x : 0,
          dot_y: position ? position.y : 0,
          canvas_width: canvasRef.current ? canvasRef.current.width : 0,
          canvas_height: canvasRef.current ? canvasRef.current.height : 0,
          window_width: window.innerWidth,
          window_height: window.innerHeight,
          timestamp: new Date().toISOString()
        };
        
        await this.saveParameterCSV(usedCaptureNumber, params);
        
        // Step 4: Increment counter for next capture
        if (this.setCaptureCounter) {
          // If the server is managing numbering, use the next number
          if (screenResponse && screenResponse.captureNumber) {
            this.setCaptureCounter(screenResponse.captureNumber + 1);
          } else {
            this.setCaptureCounter(prev => prev + 1);
          }
        }
        
        // Step 5: Update status
        if (this.setProcessStatus) {
          this.setProcessStatus(`Captured with dot at: x=${position?.x}, y=${position?.y}`);
        }
        
        // Step 6: Show preview using the in-memory image data
        this.showCapturePreview(screenImage, webcamSuccess ? 'webcam_image_data' : null, position);
        
        // Step 7: Show TopBar again after preview is done
        setTimeout(() => {
          if (typeof this.toggleTopBar === 'function') {
            this.toggleTopBar(true);
          } else if (typeof window !== 'undefined' && window.toggleTopBar) {
            window.toggleTopBar(true);
          }
        }, 2200); // Wait longer than the preview duration
        
        // Step 8: Clear status after a delay
        setTimeout(() => {
          if (this.setProcessStatus) {
            this.setProcessStatus('');
          }
        }, 3000);
        
      } catch (error) {
        console.error('Error during capture and preview:', error);
        
        // Show error message
        if (this.setProcessStatus) {
          this.setProcessStatus('Error: ' + error.message);
        }
        
        // Show TopBar again even if there was an error
        setTimeout(() => {
          if (typeof this.toggleTopBar === 'function') {
            this.toggleTopBar(true);
          } else if (typeof window !== 'undefined' && window.toggleTopBar) {
            window.toggleTopBar(true);
          }
        }, 1500);
        
        // Clear error message after delay
        setTimeout(() => {
          if (this.setProcessStatus) {
            this.setProcessStatus('');
          }
        }, 3000);
      }
    }
  }
  
  export default CaptureHandler;