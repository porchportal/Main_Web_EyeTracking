// RandomDotAction.jsx
// Handles the random dot generation and countdown functionality

import React from 'react';
import {
  getRandomPosition,
  drawRedDot,
  captureAndPreviewProcess
} from './countSave.jsx';

class RandomDotAction {
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
    
    // Get canvas manager and utilities from global scope (from actionButton.js)
    this.canvasManager = typeof window !== 'undefined' ? window.canvasManager : null;
    this.canvasUtils = typeof window !== 'undefined' ? window.canvasUtils : null;
  }

  // Get or create canvas using the canvas management system from actionButton.js
  getCanvas() {
    // First try to use canvasUtils from actionButton.js
    if (this.canvasUtils && typeof this.canvasUtils.getCanvas === 'function') {
      return this.canvasUtils.getCanvas();
    }
    
    // Fallback to canvasManager
    if (this.canvasManager && typeof this.canvasManager.getCanvas === 'function') {
      return this.canvasManager.getCanvas() || this.canvasManager.createCanvas();
    }
    
    // Fallback to canvasRef if canvasManager not available
    return this.canvasRef?.current || document.querySelector('#tracking-canvas');
  }

  // Enter fullscreen using the canvas management system
  enterFullscreen() {
    if (this.canvasUtils && typeof this.canvasUtils.enterFullscreen === 'function') {
      return this.canvasUtils.enterFullscreen();
    }
    
    if (this.canvasManager && typeof this.canvasManager.enterFullscreen === 'function') {
      this.canvasManager.enterFullscreen();
      return this.canvasManager.getCanvas();
    }
    
    // Fallback: manually enter fullscreen
    const canvas = this.getCanvas();
    if (canvas) {
      document.body.appendChild(canvas);
      canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 10;
        background-color: yellow;
        border: none;
        display: block;
        opacity: 1;
        pointer-events: auto;
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      `;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Clear with yellow background
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'yellow';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }

  // Exit fullscreen using the canvas management system
  exitFullscreen() {
    if (this.canvasUtils && typeof this.canvasUtils.exitFullscreen === 'function') {
      return this.canvasUtils.exitFullscreen();
    }
    
    if (this.canvasManager && typeof this.canvasManager.exitFullscreen === 'function') {
      this.canvasManager.exitFullscreen();
      return this.canvasManager.getCanvas();
    }
    
    // Fallback: manually exit fullscreen
    const canvas = this.getCanvas();
    if (canvas) {
      const container = document.querySelector('.canvas-container') || 
                        document.querySelector('.main-content') ||
                        document.body;
      container.appendChild(canvas);
      canvas.style.position = 'relative';
      canvas.style.top = '';
      canvas.style.left = '';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = '';
      canvas.style.backgroundColor = 'yellow';
    }
    return canvas;
  }

  // Clear canvas using the canvas management system
  clearCanvas() {
    if (this.canvasUtils && typeof this.canvasUtils.clear === 'function') {
      this.canvasUtils.clear();
      return;
    }
    
    if (this.canvasManager && typeof this.canvasManager.clear === 'function') {
      this.canvasManager.clear();
      return;
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

  // Draw dot using the canvas management system
  drawDot(x, y, radius = 12) {
    if (this.canvasUtils && typeof this.canvasUtils.drawDot === 'function') {
      return this.canvasUtils.drawDot(x, y, radius);
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
    
    // Hide the TopBar before showing dot
    if (typeof this.toggleTopBar === 'function') {
      this.toggleTopBar(false);
    } else if (typeof window !== 'undefined' && window.toggleTopBar) {
      window.toggleTopBar(false);
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
          
          // Set capturing state to false after reasonable delay
          setTimeout(() => {
            if (typeof this.setIsCapturing === 'function') {
              this.setIsCapturing(false);
            }
          }, 2200); // Wait a bit longer than the preview duration
          
        } catch (error) {
          console.error("Error in capture and preview process:", error);
          if (typeof this.setProcessStatus === 'function') {
            this.setProcessStatus('Error during capture process');
          }
          if (typeof this.setIsCapturing === 'function') {
            this.setIsCapturing(false);
          }
          
          // Clear error message after delay
          setTimeout(() => {
            if (typeof this.setProcessStatus === 'function') {
              this.setProcessStatus('');
            }
          }, 3000);
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