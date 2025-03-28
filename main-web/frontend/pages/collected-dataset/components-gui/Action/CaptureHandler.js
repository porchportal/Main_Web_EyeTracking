// CaptureHandler.js - Simplified with correct flow

class CaptureHandler {
    constructor(saveFunction, counterSetter, statusSetter, toggleTopBarFunction) {
      this.saveImageToServer = saveFunction;
      this.setCaptureCounter = counterSetter;
      this.setProcessStatus = statusSetter;
      this.toggleTopBar = toggleTopBarFunction;
    }
  
    // Show preview of the SAVED images for exactly 2 seconds
    showSavedImagesPreview(screenImageUrl, webcamImageUrl, dotPosition) {
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
        z-index: 9999;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6);
      `;
      
      // Function to create an image preview element
      const createImagePreview = (imageUrl, label) => {
        const preview = document.createElement('div');
        preview.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
        `;
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.cssText = `
          max-width: 350px;
          max-height: 250px;
          border: 3px solid white;
          border-radius: 8px;
        `;
        
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
      
      // Add screen capture preview
      if (screenImageUrl) {
        previewContainer.appendChild(createImagePreview(screenImageUrl, 'Screen Capture'));
      }
      
      // Add webcam capture preview
      if (webcamImageUrl) {
        previewContainer.appendChild(createImagePreview(webcamImageUrl, 'Webcam Capture'));
      }
      
      // Add dot position info if available
      if (dotPosition) {
        const positionInfo = document.createElement('div');
        positionInfo.textContent = `Dot position: x=${Math.round(dotPosition.x)}, y=${Math.round(dotPosition.y)}`;
        positionInfo.style.cssText = `
          color: #ffcc00;
          font-size: 14px;
          position: absolute;
          top: -25px;
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
          timerElement.textContent = 'Closing...';
        } else {
          timerElement.textContent = `${timeLeft.toFixed(1)}s`;
        }
      }, 100);
      
      // Remove preview after exactly 2 seconds
      return new Promise(resolve => {
        setTimeout(() => {
          if (previewContainer && previewContainer.parentNode) {
            previewContainer.parentNode.removeChild(previewContainer);
          }
          resolve();
        }, 2000);
      });
    }
  
    // Take a webcam picture and immediately stop the stream
    async captureWebcamImage(filename) {
      let stream = null;
      let tempVideo = null;
      
      try {
        // Create a new stream just for this capture
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
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
            console.log("Video loading timed out, continuing anyway");
            resolve();
          }, 1000);
          
          tempVideo.onloadeddata = () => {
            clearTimeout(timeoutId);
            resolve();
          };
        });
        
        // Small delay to ensure a clear frame
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Capture the frame
        const canvas = document.createElement('canvas');
        canvas.width = tempVideo.videoWidth || 640;
        canvas.height = tempVideo.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        
        // Get image data
        const imageData = canvas.toDataURL('image/png');
        
        // Save the image
        if (this.saveImageToServer) {
          await this.saveImageToServer(imageData, filename, 'webcam');
          console.log(`Saved webcam image: ${filename}`);
        }
        
        return imageData;
      } catch (error) {
        console.error("Error capturing webcam image:", error);
        return null;
      } finally {
        // IMPORTANT: Always stop the stream and clean up, even if there was an error
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
  
    // Capture screen image from canvas
    async captureScreenImage(canvasRef, filename) {
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          console.error("Canvas reference is null");
          return null;
        }
  
        // Get image data
        const imageData = canvas.toDataURL('image/png');
        
        // Save the image
        if (this.saveImageToServer) {
          await this.saveImageToServer(imageData, filename, 'screen');
          console.log(`Saved screen image: ${filename}`);
        }
        
        return imageData;
      } catch (error) {
        console.error("Error capturing screen image:", error);
        return null;
      }
    }
  
    // Main capture and show process
    async captureAndShowPreview(captureCounter, canvasRef, position) {
      try {
        // Prepare filenames
        const screenFilename = `screen_${String(captureCounter).padStart(3, '0')}.jpg`;
        const webcamFilename = `webcam_${String(captureCounter).padStart(3, '0')}.jpg`;
        
        // Step 1: Capture screen image
        const screenImage = await this.captureScreenImage(canvasRef, screenFilename);
        
        // Step 2: Capture webcam image (and immediately stop stream)
        const webcamImage = await this.captureWebcamImage(webcamFilename);
        
        // Step 3: Increment counter for next capture
        if (this.setCaptureCounter) {
          this.setCaptureCounter(prev => prev + 1);
        }
        
        // Step 4: Update status
        if (this.setProcessStatus) {
          this.setProcessStatus('Images captured successfully');
        }
        
        // Step 5: Show preview of the saved images
        await this.showSavedImagesPreview(screenImage, webcamImage, position);
        
        // Step 6: Show TopBar again after preview is done
        if (typeof this.toggleTopBar === 'function') {
          this.toggleTopBar(true);
        } else if (typeof window !== 'undefined' && window.toggleTopBar) {
          window.toggleTopBar(true);
        }
        
        // Step 7: Clear status
        setTimeout(() => {
          if (this.setProcessStatus) {
            this.setProcessStatus('');
          }
        }, 500);
        
      } catch (error) {
        console.error('Error during capture and preview:', error);
        
        // Show error message
        if (this.setProcessStatus) {
          this.setProcessStatus('Error: ' + error.message);
        }
        
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