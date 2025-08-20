// SetRandomAction.jsx
// Handles the set random sequence functionality

import React from 'react';
import { getRandomPosition, drawRedDot, runCountdown, showCapturePreview } from './countSave.jsx';
import { captureImagesAtUserPoint } from '../Helper/user_savefile';

class SetRandomAction {
  constructor(config) {
    // Required properties
    this.canvasRef = config.canvasRef;
    this.onStatusUpdate = config.onStatusUpdate;
    this.setCaptureCounter = config.setCaptureCounter;
    this.toggleTopBar = config.toggleTopBar;
    this.captureCounter = config.captureCounter || 1;
    this.triggerCameraAccess = config.triggerCameraAccess;
    this.setIsCapturing = config.setIsCapturing;
    this.setProcessStatus = config.setProcessStatus;
    
    // Settings values passed from index.js (linked from adminSettings through TopBar)
    this.times = config.times || 1;
    this.delay = config.delay || 3;
    
    console.log(`[SetRandomAction] Constructor received settings - Times: ${this.times}, Delay: ${this.delay}`);
    
    // Get canvas manager and utilities from global scope (from actionButton.js)
    this.canvasManager = typeof window !== 'undefined' ? window.canvasManager : null;
    this.canvasUtils = typeof window !== 'undefined' ? window.canvasUtils : null;
  }

  // Get or create canvas using the canvas management system from index.js
  getCanvas() {
    // First try to use canvasUtils from index.js
    if (this.canvasUtils && typeof this.canvasUtils.getCanvas === 'function') {
      return this.canvasUtils.getCanvas();
    }
    
    // Fallback to canvasManager
    if (this.canvasManager && typeof this.canvasManager.getCanvas === 'function') {
      return this.canvasManager.getCanvas();
    }
    
    // Fallback to global canvas manager
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.getCanvas();
    }
    
    // Fallback to canvasRef if canvasManager not available
    return this.canvasRef?.current || document.querySelector('#main-canvas');
  }

  // Clear canvas using the global canvas manager
  clearCanvas() {
    if (this.canvasManager && typeof this.canvasManager.clearCanvas === 'function') {
      return this.canvasManager.clearCanvas();
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
    // Get canvas using the canvas management system
    const canvas = this.getCanvas();
    if (canvas) {
      const ctx = canvas.getContext('2d');
      drawRedDot(ctx, x, y, radius, false);
      return true;
    }
    return false;
  }

  // Wait until canvas is fully ready
  async waitForCanvas(maxTries = 20, interval = 100) {
    for (let i = 0; i < maxTries; i++) {
      const canvas = this.getCanvas();
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        return canvas;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error("Canvas not ready after multiple attempts");
  }

  // Main handler for Set Random button
  handleAction = async () => {
    try {
      // Use the settings values passed from index.js (linked from adminSettings through TopBar)
      const times = this.times;
      const delay = this.delay;
      
      console.log(`[SetRandomAction] Using passed settings - Times: ${times}, Delay: ${delay}`);
      
      // Hide UI during capture process
      // Use the same TopBar control pattern as index.js
      if (typeof window !== 'undefined' && window.toggleTopBar) {
        console.log('SetRandomAction: Using global window.toggleTopBar(false)...');
        window.toggleTopBar(false);
        console.log('SetRandomAction: TopBar hidden via global window.toggleTopBar');
      } else if (this.toggleTopBar) {
        console.log('SetRandomAction: Using passed toggleTopBar(false)...');
        this.toggleTopBar(false);
        console.log('SetRandomAction: TopBar hidden via passed toggleTopBar function');
      }
      
      // Set capturing state if function exists
      if (typeof this.setIsCapturing === 'function') {
        this.setIsCapturing(true);
      }
      
      this.onStatusUpdate?.({
        processStatus: `Starting ${times} random captures with ${delay}s delay...`,
        isCapturing: true,
        remainingCaptures: times
      });
      
      // Wait for canvas to be ready
      const canvas = await this.waitForCanvas();
      

      
      // Process all captures sequentially
      let successCount = 0;
      let currentCapture = 1;
      
      while (currentCapture <= times) {
        // Update status for current capture
        this.onStatusUpdate?.({
          processStatus: `Capture ${currentCapture} of ${times}`,
          remainingCaptures: times - currentCapture + 1,
          isCapturing: true
        });
        
        // Clear canvas before each capture using canvas management system
        this.clearCanvas();
        
        // Generate random position for this capture
        const position = getRandomPosition(canvas, 20);
        
        // Draw the dot using canvas management system
        this.drawDot(position.x, position.y, 12);
        
        // Create a redrawInterval to ensure dot stays visible
        let redrawInterval = setInterval(() => {
          this.drawDot(position.x, position.y, 12);
        }, 200);
        
        // Run countdown and wait for it to complete
        await new Promise(resolve => {
          runCountdown(
            position,
            canvas,
            (status) => {
              // Update UI based on status
              if (status.processStatus) {
                this.onStatusUpdate?.({
                  processStatus: `Capture ${currentCapture}/${times}: ${status.processStatus}`,
                  remainingCaptures: times - currentCapture + 1,
                  isCapturing: true
                });
              }
            },
            resolve // This will be called when countdown completes
          );
        });
        
        // Clear redrawInterval after countdown
        clearInterval(redrawInterval);
        
        // Trigger camera access before capture
        if (this.triggerCameraAccess) {
          try {
            const cameraResult = this.triggerCameraAccess(true);
            if (!cameraResult) {
              console.warn('Camera access failed, but continuing with capture');
            }
          } catch (error) {
            console.warn('Camera access error, but continuing with capture:', error);
          }
        }
        
        // Wait briefly for camera to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Capture images at this point
        try {
          const captureResult = await captureImagesAtUserPoint({
            point: position,
            captureCount: this.captureCounter,
            canvasRef: { current: canvas },
            setCaptureCount: this.setCaptureCounter,
            showCapturePreview
          });
          
          if (captureResult && (captureResult.screenImage || captureResult.success)) {
            successCount++;
          }
          
          // Increment counter
          if (this.setCaptureCounter) {
            this.setCaptureCounter(prev => prev + 1);
          }
        } catch (error) {
          console.error(`Error capturing point ${currentCapture}:`, error);
        }
        
        // Wait between captures for the specified delay time
        if (currentCapture < times) {
          this.onStatusUpdate?.({
            processStatus: `Waiting ${delay}s before next capture...`,
            remainingCaptures: times - currentCapture,
            isCapturing: true
          });
          
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
        
        // Move to next capture
        currentCapture++;
      }
      
      // Sequence complete
      this.onStatusUpdate?.({
        processStatus: `Random capture sequence completed: ${successCount}/${times} captures successful`,
        remainingCaptures: 0,
        isCapturing: false
      });
      
      // Set capturing state to false if function exists
      if (typeof this.setIsCapturing === 'function') {
        this.setIsCapturing(false);
      }
      
      // Clear the last dot using canvas management system
      this.clearCanvas();
      

      
      // Turn TopBar back on
      // Use the same TopBar control pattern as index.js
      if (typeof window !== 'undefined' && window.toggleTopBar) {
        console.log('SetRandomAction: Using global window.toggleTopBar(true)...');
        window.toggleTopBar(true);
        console.log('SetRandomAction: TopBar restored via global window.toggleTopBar');
      } else if (this.toggleTopBar) {
        console.log('SetRandomAction: Using passed toggleTopBar(true)...');
        this.toggleTopBar(true);
        console.log('SetRandomAction: TopBar restored via passed toggleTopBar function');
      }
      
    } catch (err) {
      console.error('Random sequence error:', err);
      this.onStatusUpdate?.({
        processStatus: `Random sequence failed: ${err.message}`,
        isCapturing: false,
        remainingCaptures: 0
      });
      
      // Set capturing state to false if function exists
      if (typeof this.setIsCapturing === 'function') {
        this.setIsCapturing(false);
      }
      
      // Make sure to restore the UI
      // Use the same TopBar control pattern as index.js
      if (typeof window !== 'undefined' && window.toggleTopBar) {
        console.log('SetRandomAction: Error case - Using global window.toggleTopBar(true)...');
        window.toggleTopBar(true);
        console.log('SetRandomAction: Error case - TopBar restored via global window.toggleTopBar');
      } else if (this.toggleTopBar) {
        console.log('SetRandomAction: Error case - Using passed toggleTopBar(true)...');
        this.toggleTopBar(true);
        console.log('SetRandomAction: Error case - TopBar restored via passed toggleTopBar function');
      }
    }
  };
}

export default SetRandomAction; 