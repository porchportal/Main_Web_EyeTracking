// SetCalibrateAction.jsx
// Handles the calibration sequence functionality

import React from 'react';
import { generateCalibrationPoints } from './CalibratePoints.jsx';
import { drawRedDot, runCountdown, showCapturePreview } from './countSave.jsx';
import { captureImagesAtPoint } from '../Helper/savefile';

class SetCalibrateAction {
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
        z-index: 99999;
        background-color: white;
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
      
      // Clear with white background
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
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
      canvas.style.backgroundColor = 'white';
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
      ctx.fillStyle = 'white';
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

  // Main function to handle calibration sequence
  handleSetCalibrate = async () => {
    // Hide the TopBar before starting calibration
    if (typeof this.toggleTopBar === 'function') {
      this.toggleTopBar(false);
    } else if (typeof window !== 'undefined' && window.toggleTopBar) {
      window.toggleTopBar(false);
    }
    
    this.setIsCapturing(true);
    this.setProcessStatus('Starting calibration sequence...');
    
    // Update parent component if available
    if (this.onStatusUpdate) {
      this.onStatusUpdate({
        processStatus: 'Starting calibration sequence...',
        isCapturing: true
      });
    }
    
    // Give the component time to update
    setTimeout(async () => {
      try {
        const canvas = await this.waitForCanvas();
        if (!canvas) {
          throw new Error("Canvas not available");
        }

        // Use canvas management system to enter fullscreen
        this.enterFullscreen();

        // Generate calibration points based on canvas size
        const points = generateCalibrationPoints(canvas.width, canvas.height);
        
        if (!points || points.length === 0) {
          throw new Error("Failed to generate calibration points");
        }

        // Create status indicator
        const statusIndicator = document.createElement('div');
        statusIndicator.className = 'calibrate-status-indicator';
        statusIndicator.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background-color: rgba(0, 102, 204, 0.9);
          color: white;
          font-size: 16px;
          font-weight: bold;
          padding: 10px 15px;
          border-radius: 8px;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        statusIndicator.textContent = 'Calibration: Initializing...';
        document.body.appendChild(statusIndicator);

        // Process each calibration point
        let successCount = 0;
        for (let i = 0; i < points.length; i++) {
          const point = points[i];
          
          // Update status displays
          statusIndicator.textContent = `Calibration: Point ${i + 1}/${points.length}`;
          this.setProcessStatus(`Processing calibration point ${i + 1}/${points.length}`);
          
          // Clear canvas with white background using canvas management system
          this.clearCanvas();
          
          // Draw the calibration point using canvas management system
          const radius = 12; // Standard size for consistency
          this.drawDot(point.x, point.y, radius);
          
          // Create redraw interval to ensure dot stays visible
          const redrawInterval = setInterval(() => {
            this.drawDot(point.x, point.y, radius);
          }, 200);
          
          // Remove any existing countdown elements
          const existingCountdowns = document.querySelectorAll('.dot-countdown, .calibrate-countdown');
          existingCountdowns.forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el);
          });
          
          // Create custom countdown element positioned at the same location as the dot
          const countdownElement = document.createElement('div');
          countdownElement.className = 'dot-countdown';
          countdownElement.style.cssText = `
            position: fixed;
            left: ${point.x}px;
            top: ${point.y}px;
            transform: translate(-50%, -50%);
            color: red;
            font-size: 24px;
            font-weight: bold;
            text-shadow: 0 0 10px white, 0 0 20px white;
            z-index: 10000;
            background-color: rgba(255, 255, 255, 0.9);
            border: 2px solid red;
            border-radius: 50%;
            width: 48px;
            height: 48px;
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 0 15px rgba(0, 0, 0, 0.4);
          `;
          document.body.appendChild(countdownElement);
          
          try {
            // Manual countdown
            for (let count = 3; count > 0; count--) {
              countdownElement.textContent = count;
              this.setProcessStatus(`Point ${i+1}/${points.length}: Countdown ${count}`);
              
              // Force redraw to ensure dot stays visible
              this.drawDot(point.x, point.y, radius);
              
              await new Promise(resolve => setTimeout(resolve, 800));
              
              // Redraw again halfway through the wait
              this.drawDot(point.x, point.y, radius);
            }
            
            // Show checkmark
            countdownElement.textContent = "✓";
            this.drawDot(point.x, point.y, radius);
            
            // Remove countdown element immediately
            if (countdownElement.parentNode) {
              countdownElement.parentNode.removeChild(countdownElement);
            }
            
            // Make sure dot is still visible
            this.drawDot(point.x, point.y, radius);

            // Capture images at this point
            console.log(`Capturing calibration point ${i+1}/${points.length} at (${point.x}, ${point.y})`);
            
            const captureResult = await captureImagesAtPoint({
              point: point,
              captureCount: this.captureCounter,
              canvasRef: { current: canvas },
              setCaptureCount: this.setCaptureCounter,
              showCapturePreview
            });

            if (captureResult && (captureResult.screenImage || captureResult.success)) {
              successCount++;
            }

            // Wait a moment before clearing to ensure capture is complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Clear the dot after capture using canvas management system
            this.clearCanvas();

            // Wait between points
            await new Promise(resolve => setTimeout(resolve, 1200));
            
          } catch (error) {
            console.error(`Error processing calibration point ${i+1}:`, error);
          } finally {
            // Clean up countdown if it still exists
            if (countdownElement.parentNode) {
              countdownElement.parentNode.removeChild(countdownElement);
            }
            
            // Clear redraw interval
            clearInterval(redrawInterval);
          }
        }
        
        // Calibration complete
        if (statusIndicator) {
          statusIndicator.textContent = `Calibration complete: ${successCount}/${points.length} points`;
        }
        this.setProcessStatus(`Calibration completed: ${successCount}/${points.length} points captured`);
        
        // Remove status indicator after delay
        setTimeout(() => {
          if (statusIndicator.parentNode) {
            statusIndicator.parentNode.removeChild(statusIndicator);
          }
        }, 3000);
        
      } catch (error) {
        console.error("Calibration error:", error);
        this.setProcessStatus(`Calibration error: ${error.message}`);
      } finally {
        // Exit fullscreen and restore canvas using canvas management system
        this.exitFullscreen();
        
        this.setIsCapturing(false);
        
        // Show TopBar again after a delay
        setTimeout(() => {
          if (typeof this.toggleTopBar === 'function') {
            this.toggleTopBar(true);
          } else if (typeof window !== 'undefined' && window.toggleTopBar) {
            window.toggleTopBar(true);
          }
        }, 1000);
      }
    }, 200);
  };
}

export default SetCalibrateAction; 