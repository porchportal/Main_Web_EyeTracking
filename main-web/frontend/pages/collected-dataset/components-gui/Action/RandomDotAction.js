// RandomDotActions.js
// Handles the random dot generation and countdown functionality

import {
  initializeCanvas,
  getRandomPosition,
  drawRedDot,
  captureAndPreviewProcess
} from './countSave';


class RandomDotActions {
  constructor(config) {
    // Required properties
    this.canvasRef = config.canvasRef;
    this.toggleTopBar = config.toggleTopBar;
    this.setIsCapturing = config.setIsCapturing;
    this.setProcessStatus = config.setProcessStatus;
    this.setCurrentDot = config.setCurrentDot;
    this.triggerCameraAccess = config.triggerCameraAccess;
    this.onStatusUpdate = config.onStatusUpdate;
    this.saveImageToServer = config.saveImageToServer;
    this.setCaptureCounter = config.setCaptureCounter;
    this.captureCounter = config.captureCounter;
  }

  // Main function to handle random dot generation and capture
  handleRandomDot = async () => {
    // Hide the TopBar before showing dot
    if (typeof this.toggleTopBar === 'function') {
      this.toggleTopBar(false);
    } else if (typeof window !== 'undefined' && window.toggleTopBar) {
      window.toggleTopBar(false);
    }
    
    this.setIsCapturing(true);
    this.setProcessStatus('Generating random dot...');
    
    // Update parent component if available
    if (this.onStatusUpdate) {
      this.onStatusUpdate({
        processStatus: 'Generating random dot...',
        isCapturing: true
      });
    }
    
    // Give the component time to update
    setTimeout(async () => {
      const canvas = this.canvasRef.current;
      if (canvas) {
        // Make sure canvas dimensions are properly set
        const parent = canvas.parentElement;
        if (!initializeCanvas(canvas, parent)) {
          console.error("Could not initialize canvas");
          this.setProcessStatus('Error: Canvas initialization failed');
          this.setIsCapturing(false);
          return;
        }
        
        // Generate random position
        const position = getRandomPosition(canvas);
        
        // Draw the dot
        const ctx = canvas.getContext('2d');
        drawRedDot(ctx, position.x, position.y);
        
        // Store current dot position
        this.setCurrentDot(position);
        
        try {
          // Use the shared capture and preview process
          await captureAndPreviewProcess({
            canvasRef: this.canvasRef,
            position,
            captureCounter: this.captureCounter,
            saveImageToServer: this.saveImageToServer,
            setCaptureCounter: this.setCaptureCounter,
            setProcessStatus: this.setProcessStatus,
            toggleTopBar: this.toggleTopBar,
            onStatusUpdate: this.onStatusUpdate,
            captureFolder: 'eye_tracking_captures'
          });
          
          // Set capturing state to false after reasonable delay
          setTimeout(() => {
            this.setIsCapturing(false);
          }, 2200); // Wait a bit longer than the preview duration
          
        } catch (error) {
          console.error("Error in capture and preview process:", error);
          this.setProcessStatus('Error during capture process');
          this.setIsCapturing(false);
          
          // Clear error message after delay
          setTimeout(() => {
            this.setProcessStatus('');
          }, 3000);
        }
      } else {
        console.error("Canvas reference is null - cannot draw dot");
        this.setProcessStatus('Error: Canvas not available');
        this.setIsCapturing(false);
      }
    }, 200);
  };
}

export default RandomDotActions;