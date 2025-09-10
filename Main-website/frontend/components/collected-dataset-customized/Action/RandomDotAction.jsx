// RandomDotAction.jsx
// Handles the random dot generation and countdown functionality

import React from 'react';
import {
  getRandomPosition,
  drawRedDot,
  captureAndPreviewProcess
} from './countSave.jsx';

class RandomDotAction {
  constructor(options) {
    this.canvasRef = options.canvasRef;
    this.setIsCapturing = options.setIsCapturing;
    this.setProcessStatus = options.setProcessStatus;
    this.setCurrentDot = options.setCurrentDot;
    this.triggerCameraAccess = options.triggerCameraAccess;
    this.onStatusUpdate = options.onStatusUpdate;
    this.saveImageToServer = options.saveImageToServer;
    this.setCaptureCounter = options.setCaptureCounter;
    this.captureCounter = options.captureCounter;
  }

  // Get canvas using the global canvas manager from index.js
  getCanvas() {
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.getCanvas();
    }
    return this.canvasRef?.current || document.querySelector('#main-canvas');
  }


  // Clear canvas using the global canvas manager
  clearCanvas() {
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.clearCanvas();
    }
    
    // Fallback: manually clear canvas
    const canvas = this.getCanvas();
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'yellow';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Draw dot using the global canvas manager
  drawDot(x, y, radius = 12) {
    // Get canvas using the global canvas manager
    const canvas = this.getCanvas();
    if (canvas) {
      const ctx = canvas.getContext('2d');
      drawRedDot(ctx, x, y, radius, false);
      return true;
    }
    return false;
  }

  // Main function to handle random dot generation and capture
  handleRandomDot = async () => {
    // Clean up any existing countdown elements first
    const existingCountdowns = document.querySelectorAll('.dot-countdown, .backup-countdown, .test-countdown');
    existingCountdowns.forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    
    // TopBar hiding is now handled in index.js
    
    // Set capturing state if function exists
    if (typeof this.setIsCapturing === 'function') {
      this.setIsCapturing(true);
    }
    
    if (typeof this.setProcessStatus === 'function') {
      this.setProcessStatus('Generating random dot...');
    }
    
    // Update parent component if available
    if (this.onStatusUpdate) {
      this.onStatusUpdate({
        processStatus: 'Generating random dot...',
        isCapturing: true
      });
    }
    
    // Give the component time to update
    setTimeout(async () => {
      const canvas = this.getCanvas();
      if (canvas) {
        // Generate random position
        const position = getRandomPosition(canvas);
        
        // Draw the dot using canvas management system
        this.drawDot(position.x, position.y, 12);
        
        // Store current dot position
        this.setCurrentDot(position);
        
        
        try {
          // Ensure camera is active before capture
          if (typeof window !== 'undefined' && window.cameraStateManager) {
            await window.cameraStateManager.ensureCameraActive();
            window.cameraStateManager.debugCameraState();
          }
          
          // Use the shared capture and preview process
          await captureAndPreviewProcess({
            canvasRef: { current: canvas },
            position,
            captureCounter: this.captureCounter,
            saveImageToServer: this.saveImageToServer,
            setCaptureCounter: this.setCaptureCounter,
            setProcessStatus: this.setProcessStatus,
            onStatusUpdate: this.onStatusUpdate,
            captureFolder: 'eye_tracking_captures'
          });
          
          // Clear the dot using canvas management system
          this.clearCanvas();
          
          // Set capturing state to false immediately
          if (typeof this.setIsCapturing === 'function') {
            this.setIsCapturing(false);
          }
          
        } catch (error) {
          console.error("Error in capture and preview process:", error);
          if (typeof this.setProcessStatus === 'function') {
            this.setProcessStatus('Error during capture process');
          }
          if (typeof this.setIsCapturing === 'function') {
            this.setIsCapturing(false);
          }
          
          // Clear error message and ensure TopBar is restored immediately
          if (typeof this.setProcessStatus === 'function') {
            this.setProcessStatus('');
          }
          

        }
      } else {
        console.error("Canvas reference is null - cannot draw dot");
        if (typeof this.setProcessStatus === 'function') {
          this.setProcessStatus('Error: Canvas not available');
        }
        if (typeof this.setIsCapturing === 'function') {
          this.setIsCapturing(false);
        }
      }
    }, 200);
  };
}

export default RandomDotAction; 