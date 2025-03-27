// CaptureHandler.js
// Handles capturing and saving images from both canvas and webcam

import { showImagePreview } from './DotCaptureUtil';

class CaptureHandler {
  constructor(saveFunction, counterSetter, statusSetter, toggleTopBarFunction) {
    this.saveImageToServer = saveFunction;
    this.setCaptureCounter = counterSetter;
    this.setProcessStatus = statusSetter;
    this.toggleTopBar = toggleTopBarFunction;
  }

  // Capture both screen and webcam images and show preview
  async captureAndShowPreview(captureCounter, canvasRef, position, triggerCameraAccess) {
    try {
      // Enable camera if function provided
      if (triggerCameraAccess) {
        triggerCameraAccess(true); // Force enable camera
      }
      
      // Wait briefly for camera to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Prepare filenames
      const screenFilename = `screen_${String(captureCounter).padStart(3, '0')}.jpg`;
      const webcamFilename = `webcam_${String(captureCounter).padStart(3, '0')}.jpg`;
      
      // Capture screen image
      const canvas = canvasRef.current;
      let screenImage = null;
      
      if (canvas) {
        screenImage = canvas.toDataURL('image/png');
        // Try to save the image
        try {
          await this.saveImageToServer(screenImage, screenFilename, 'screen');
          console.log(`Saved screen image: ${screenFilename}`);
        } catch (error) {
          console.error(`Error saving screen image: ${error.message}`);
        }
      }
      
      // Capture webcam image
      let webcamImage = null;
      if (window.videoElement) {
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        tempCanvas.width = window.videoElement.videoWidth;
        tempCanvas.height = window.videoElement.videoHeight;
        ctx.drawImage(window.videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
        webcamImage = tempCanvas.toDataURL('image/png');
        
        // Try to save the image
        try {
          await this.saveImageToServer(webcamImage, webcamFilename, 'webcam');
          console.log(`Saved webcam image: ${webcamFilename}`);
        } catch (error) {
          console.error(`Error saving webcam image: ${error.message}`);
        }
      }
      
      // Increment counter for next capture
      this.setCaptureCounter(prev => prev + 1);
      
      // Show preview of captured images
      if (screenImage || webcamImage) {
        const previewElement = showImagePreview(screenImage, webcamImage, position);
        
        // Set a status message
        this.setProcessStatus('Images captured and saved successfully');
        
        // Remove the preview after 2 seconds
        setTimeout(() => {
          previewElement.remove();
          
          // Show TopBar again after preview is removed
          setTimeout(() => {
            if (typeof this.toggleTopBar === 'function') {
              this.toggleTopBar(true);
            } else if (typeof window !== 'undefined' && window.toggleTopBar) {
              window.toggleTopBar(true);
            }
          }, 500);
          
        }, 2000);
        
        // Clear status after 3 seconds
        setTimeout(() => {
          this.setProcessStatus('');
        }, 3000);
      }
      
    } catch (error) {
      console.error('Error during capture:', error);
      this.setProcessStatus('Error capturing images: ' + error.message);
      
      // Clear error message after delay
      setTimeout(() => {
        this.setProcessStatus('');
      }, 3000);
    }
  }
}

export default CaptureHandler;