// SetCalibrateAction.jsx
// Handles the calibration sequence functionality

import React from 'react';
import { generateCalibrationPoints } from './CalibratePoints';
import { drawRedDot, runCountdown, showCapturePreview } from './countSave';
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
    
    // Get canvas manager from global scope
    this.canvasManager = typeof window !== 'undefined' ? window.canvasManager : null;
  }

  // Get or create canvas using the new CanvasManager
  getCanvas() {
    if (this.canvasManager) {
      return this.canvasManager.getCanvas() || this.canvasManager.createCanvas();
    }
    
    // Fallback to canvasRef if canvasManager not available
    return this.canvasRef?.current || document.querySelector('#tracking-canvas');
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

        // Use canvas manager to enter fullscreen
        if (this.canvasManager) {
          this.canvasManager.enterFullscreen();
        }

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
          
          // Clear canvas with white background
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw the calibration point with consistent size
          const radius = 12; // Standard size for consistency
          drawRedDot(ctx, point.x, point.y, radius, false);
          
          // Create redraw interval to ensure dot stays visible
          const redrawInterval = setInterval(() => {
            drawRedDot(ctx, point.x, point.y, radius, false);
          }, 200);
          
          // Remove any existing countdown elements
          const existingCountdowns = document.querySelectorAll('.dot-countdown, .calibrate-countdown');
          existingCountdowns.forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el);
          });
          
          // Create custom countdown element
          const countdownElement = document.createElement('div');
          countdownElement.className = 'dot-countdown';
          countdownElement.style.cssText = `
            position: fixed;
            left: ${point.x}px;
            top: ${point.y - 60}px;
            transform: translateX(-50%);
            color: red;
            font-size: 36px;
            font-weight: bold;
            text-shadow: 0 0 10px white, 0 0 20px white;
            z-index: 10000;
            background-color: rgba(255, 255, 255, 0.8);
            border: 2px solid red;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
          `;
          document.body.appendChild(countdownElement);
          
          try {
            // Manual countdown
            for (let count = 3; count > 0; count--) {
              countdownElement.textContent = count;
              this.setProcessStatus(`Point ${i+1}/${points.length}: Countdown ${count}`);
              
              // Force redraw to ensure dot stays visible
              drawRedDot(ctx, point.x, point.y, radius, false);
              
              await new Promise(resolve => setTimeout(resolve, 800));
              
              // Redraw again halfway through the wait
              drawRedDot(ctx, point.x, point.y, radius, false);
            }
            
            // Show checkmark
            countdownElement.textContent = "✓";
            drawRedDot(ctx, point.x, point.y, radius, false);
            
            // Remove countdown element after delay
            setTimeout(() => {
              if (countdownElement.parentNode) {
                countdownElement.parentNode.removeChild(countdownElement);
              }
            }, 300);
            
            // Make sure dot is still visible
            drawRedDot(ctx, point.x, point.y, radius, false);

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
        // Exit fullscreen and restore canvas
        if (this.canvasManager) {
          this.canvasManager.exitFullscreen();
        }
        
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