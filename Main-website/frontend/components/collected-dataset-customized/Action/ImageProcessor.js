// Improved ImageProcessor.js - Ensures clean webcam capture and cleanup

class ImageProcessor {
    constructor(saveFunction) {
      this.saveImageToServer = saveFunction;
      this._activeStream = null; // Track the active stream
    }
  
    /**
     * Capture a screen image from a canvas
     * @param {React.RefObject} canvasRef - Reference to the canvas element
     * @param {string} filename - Filename to save the image as
     * @returns {Promise<string|null>} - The image data URL or null if failed
     */
    async captureScreenImage(canvasRef, filename) {
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          return null;
        }
  
        // Get image data from canvas
        const imageData = canvas.toDataURL('image/png');
        
        // Save the image if a save function is provided
        if (this.saveImageToServer) {
          try {
            await this.saveImageToServer(imageData, filename, 'screen');
          } catch (saveError) {
            // Continue even if save fails, so we can return the image data
          }
        }
        
        return imageData;
      } catch (error) {
        return null;
      }
    }
  
    /**
     * SILENTLY capture a webcam image without showing preview
     * @param {string} filename - Filename to save the image as
     * @returns {Promise<string|null>} - The image data URL or null if failed
     */
    async captureWebcamImage(filename) {
      // Variables to track resources for cleanup
      let stream = null;
      let video = null;
      
      try {
        // Create a new stream for this capture
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        
        // Store the stream reference for cleanup
        this._activeStream = stream;
        
        // Create a hidden video element
        video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.style.position = 'absolute';
        video.style.left = '-9999px';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0';
        document.body.appendChild(video);
        
        // Apply stream to video element
        video.srcObject = stream;
        
        // Wait for video to be ready with timeout
        await new Promise((resolve) => {
          const timeoutId = setTimeout(() => {
            resolve();
          }, 1000);
          
          video.onloadeddata = () => {
            clearTimeout(timeoutId);
            resolve();
          };
        });
        
        // Wait a bit more to ensure a clear frame
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Create a temporary canvas to capture the frame
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        tempCanvas.width = video.videoWidth || 640;
        tempCanvas.height = video.videoHeight || 480;
        
        // Draw the video frame to canvas
        ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Get image data
        const imageData = tempCanvas.toDataURL('image/png');
        
        // Save the image if a save function is provided
        if (this.saveImageToServer) {
          try {
            await this.saveImageToServer(imageData, filename, 'webcam');
          } catch (saveError) {
          }
        }
        
        return imageData;
      } catch (error) {
        return null;
      } finally {
        // ALWAYS clean up resources, even if there was an error
        this.stopWebcam();
        
        // Clean up the video element if it was created
        if (video) {
          video.srcObject = null;
          if (video.parentNode) {
            video.parentNode.removeChild(video);
          }
        }
      }
    }
  
    /**
     * Stop the webcam stream and clean up resources
     */
    stopWebcam() {
      // Stop our tracked stream
      if (this._activeStream) {
        try {
          const tracks = this._activeStream.getTracks();
          tracks.forEach(track => {
            if (track.readyState === 'live') {
              track.stop();
            }
          });
        } catch (e) {
        }
        this._activeStream = null;
      }
      
      // Also look for any hidden video elements we may have created and clean them up
      if (typeof document !== 'undefined') {
        const hiddenVideos = document.querySelectorAll('video[style*="position: absolute"][style*="left: -9999px"]');
        hiddenVideos.forEach(video => {
          if (video.srcObject) {
            try {
              const stream = video.srcObject;
              const tracks = stream.getTracks();
              tracks.forEach(track => {
                if (track.readyState === 'live') {
                  track.stop();
                }
              });
              video.srcObject = null;
            } catch (e) {
            }
            
            // Remove the element
            if (video.parentNode) {
              video.parentNode.removeChild(video);
            }
          }
        });
      }
    }
    
    /**
     * Capture both screen and webcam images without showing preview
     * @param {React.RefObject} canvasRef - Reference to the canvas element
     * @param {number} counter - Capture counter for filename generation
     * @param {Object} dotPosition - Position of the dot {x, y}
     * @returns {Promise<Object>} - Object containing both image data URLs
     */
    async captureScreenAndWebcam(canvasRef, counter, dotPosition) {
      // Generate filenames
      const formattedCounter = String(counter).padStart(3, '0');
      const screenFilename = `screen_${formattedCounter}.jpg`;
      const webcamFilename = `webcam_${formattedCounter}.jpg`;
      
      // Capture screen image first
      const screenImage = await this.captureScreenImage(canvasRef, screenFilename);
      
      // Capture webcam image silently 
      const webcamImage = await this.captureWebcamImage(webcamFilename);
      
      // Return both images
      return {
        screenImage,
        webcamImage,
        dotPosition,
        screenFilename,
        webcamFilename
      };
    }
    
    /**
     * Show a preview of captured images
     * @param {string} screenImage - Screen image data URL
     * @param {string} webcamImage - Webcam image data URL
     * @param {Object} dotPosition - Position of the dot {x, y}
     */
    showCapturePreview(screenImage, webcamImage, dotPosition) {
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
      
      // Function to add an image preview with label
      const addImagePreview = (image, label) => {
        if (!image) return;
        
        const preview = document.createElement('div');
        preview.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
        `;
        
        const img = document.createElement('img');
        img.src = image;
        img.style.cssText = `
          max-width: 300px;
          max-height: 200px;
          border: 3px solid white;
          border-radius: 8px;
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
      };
      
      // Add both image previews
      addImagePreview(screenImage, 'Screen Capture');
      addImagePreview(webcamImage, 'Webcam Capture');
      
      // Add dot position if available
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
      
      // Add to document
      document.body.appendChild(previewContainer);
      
      // Countdown timer and remove preview
      let timeLeft = 2.0;
      const interval = setInterval(() => {
        timeLeft -= 0.1;
        if (timeLeft <= 0) {
          clearInterval(interval);
          document.body.removeChild(previewContainer);
        } else {
          timerElement.textContent = `${timeLeft.toFixed(1)}s`;
        }
      }, 100);
    }
  }
  
  export default ImageProcessor;