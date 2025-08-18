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
    this.toggleTopBar = options.toggleTopBar;
    this.setIsCapturing = options.setIsCapturing;
    this.setProcessStatus = options.setProcessStatus;
    this.setCurrentDot = options.setCurrentDot;
    this.triggerCameraAccess = options.triggerCameraAccess;
    this.onStatusUpdate = options.onStatusUpdate;
    this.saveImageToServer = options.saveImageToServer;
    this.setCaptureCounter = options.setCaptureCounter;
    this.captureCounter = options.captureCounter;
  }

  // Get canvas using the global canvas manager
  getCanvas() {
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.getCanvas();
    }
    return this.canvasRef?.current || document.querySelector('#tracking-canvas');
  }

  // Enter fullscreen using the global canvas manager
  enterFullscreen() {
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.enterFullscreen();
    }
    return null;
  }

  // Exit fullscreen using the global canvas manager
  exitFullscreen() {
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.exitFullscreen();
    }
    return null;
  }

  // Clear canvas using the global canvas manager
  clearCanvas() {
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.clear();
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
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.drawDot(x, y, radius);
    }
    
    // Fallback: manually draw dot
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
    
    // 🔥 HIDE THE TOPBAR BEFORE SHOWING DOT 🔥
    console.log('RandomDotAction: Hiding TopBar before showing dot...');
    if (typeof this.toggleTopBar === 'function') {
      this.toggleTopBar(false);
      console.log('RandomDotAction: TopBar hidden via toggleTopBar function');
    } else {
      console.warn('RandomDotAction: No toggleTopBar function available to hide TopBar');
    }
    
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
        // Use canvas management system to enter fullscreen
        this.enterFullscreen();
        
        // Generate random position
        const position = getRandomPosition(canvas);
        
        console.log('RandomDotAction: Generated position:', {
          position,
          canvasDimensions: { width: canvas.width, height: canvas.height },
          canvasStyle: {
            position: canvas.style.position,
            width: canvas.style.width,
            height: canvas.style.height
          },
          canvasRect: canvas.getBoundingClientRect()
        });
        
        // Draw the dot using canvas management system
        this.drawDot(position.x, position.y, 12);
        
        // Store current dot position
        this.setCurrentDot(position);
        
        
        try {
          // Use the shared capture and preview process
          await captureAndPreviewProcess({
            canvasRef: { current: canvas },
            position,
            captureCounter: this.captureCounter,
            saveImageToServer: this.saveImageToServer,
            setCaptureCounter: this.setCaptureCounter,
            setProcessStatus: this.setProcessStatus,
            toggleTopBar: this.toggleTopBar,
            onStatusUpdate: this.onStatusUpdate,
            captureFolder: 'eye_tracking_captures'
          });
          
          // Clear the dot after capture using canvas management system
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
          
          // 🔥 ENSURE TOPBAR IS RESTORED ON ERROR 🔥
          console.log('RandomDotAction: Error case TopBar restoration...');
          if (typeof this.toggleTopBar === 'function') {
            this.toggleTopBar(true);
            console.log('RandomDotAction: TopBar restored via toggleTopBar function (error case)');
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