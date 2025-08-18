// SetCalibrateAction.jsx
// Handles the calibration sequence functionality

import React from 'react';
import { generateCalibrationPoints } from './CalibratePoints.jsx';
import { captureAndPreviewProcess } from './countSave.jsx';
import { getRandomPosition } from './countSave.jsx';

class SetCalibrateAction {
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
    this.originalCanvasDimensions = null;
  }

  // Get canvas using the global canvas manager
  getCanvas() {
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.getCanvas();
    }
    return this.canvasRef?.current || document.querySelector('#tracking-canvas');
  }

  // Check if canvas is in fullscreen mode
  isCanvasFullscreen() {
    const isFullscreen = typeof window !== 'undefined' && window.globalCanvasManager ? 
      window.globalCanvasManager.isInFullscreen() : false;
    
    const canvas = this.getCanvas();
    return isFullscreen || (canvas && canvas.style.position === 'fixed' && canvas.style.width === '100vw');
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
      // Draw the dot with a bright red color
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'red';
      ctx.fill();
      
      // Add glow effect for better visibility
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Add a second larger glow for even better visibility
      ctx.beginPath();
      ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      return true;
    }
    return false;
  }

  // Wait for canvas to be available
  async waitForCanvas() {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const canvas = this.getCanvas();
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        return canvas;
      }
      
      console.log(`Waiting for canvas... attempt ${attempts + 1}/${maxAttempts}`);
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    console.error('Canvas not available after maximum attempts');
    return null;
  }

  // Main function to handle calibration sequence
  handleSetCalibrate = async () => {
    // Hide the TopBar before starting calibration
    if (typeof this.toggleTopBar === 'function') {
      this.toggleTopBar(false);
    }
    
    // Set capturing state if function exists
    if (typeof this.setIsCapturing === 'function') {
      this.setIsCapturing(true);
    }
    
    if (typeof this.setProcessStatus === 'function') {
      this.setProcessStatus('Starting calibration sequence...');
    }
    
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

        // Store original canvas dimensions before going fullscreen
        this.originalCanvasDimensions = {
          width: canvas.width,
          height: canvas.height
        };

        // Use canvas management system to enter fullscreen
        this.enterFullscreen();

        // Generate calibration points based on ORIGINAL canvas size
        const points = generateCalibrationPoints(this.originalCanvasDimensions.width, this.originalCanvasDimensions.height);
        
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
          const originalPoint = points[i];
          
          // Transform coordinates for fullscreen display
          const transformedPoint = this.transformCoordinates(canvas, originalPoint);
          
          // Update status displays
          statusIndicator.textContent = `Calibration: Point ${i + 1}/${points.length}`;
          this.setProcessStatus(`Processing calibration point ${i + 1}/${points.length}`);
          
          // Clear canvas with white background using canvas management system
          this.clearCanvas();
          
          // Draw the calibration point using ORIGINAL coordinates (canvas coordinates)
          const radius = 12; // Standard size for consistency
          this.drawDot(originalPoint.x, originalPoint.y, radius);
          
          // Create redraw interval to ensure dot stays visible
          const redrawInterval = setInterval(() => {
            this.drawDot(originalPoint.x, originalPoint.y, radius);
          }, 200);
          
          // Remove any existing countdown elements
          const existingCountdowns = document.querySelectorAll('.dot-countdown, .calibrate-countdown');
          existingCountdowns.forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el);
          });
          
          // Create custom countdown element positioned using TRANSFORMED coordinates (viewport coordinates)
          const countdownElement = document.createElement('div');
          countdownElement.className = 'dot-countdown';
          countdownElement.style.cssText = `
            position: fixed;
            left: ${transformedPoint.x}px;
            top: ${transformedPoint.y}px;
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
          
          // Debug: Log positioning information
          console.log(`Point ${i+1} positioning:`, {
            originalPoint,
            transformedPoint,
            countdownPosition: {
              left: transformedPoint.x,
              top: transformedPoint.y
            },
            canvasInfo: {
              width: canvas.width,
              height: canvas.height,
              rect: canvas.getBoundingClientRect()
            }
          });
          
          try {
            // Manual countdown
            for (let count = 3; count > 0; count--) {
              countdownElement.textContent = count;
              this.setProcessStatus(`Point ${i+1}/${points.length}: Countdown ${count}`);
              
              // Force redraw to ensure dot stays visible (using original coordinates)
              this.drawDot(originalPoint.x, originalPoint.y, radius);
              
              await new Promise(resolve => setTimeout(resolve, 800));
              
              // Redraw again halfway through the wait
              this.drawDot(originalPoint.x, originalPoint.y, radius);
            }
            
            // Show checkmark
            countdownElement.textContent = "✓";
            this.drawDot(originalPoint.x, originalPoint.y, radius);
            
            // Remove countdown element immediately
            if (countdownElement.parentNode) {
              countdownElement.parentNode.removeChild(countdownElement);
            }
            
            // Make sure dot is still visible
            this.drawDot(originalPoint.x, originalPoint.y, radius);

            // Capture images at this point (use original coordinates for capture)
            console.log(`Capturing calibration point ${i+1}/${points.length} at (${originalPoint.x}, ${originalPoint.y})`);
            
            const captureResult = await captureAndPreviewProcess({
              canvasRef: { current: canvas },
              position: originalPoint,
              captureCounter: this.captureCounter,
              setCaptureCounter: this.setCaptureCounter,
              setProcessStatus: this.setProcessStatus,
              toggleTopBar: this.toggleTopBar,
              onStatusUpdate: this.onStatusUpdate,
              captureFolder: 'eye_tracking_captures'
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
        
        // Set capturing state to false if function exists
        if (typeof this.setIsCapturing === 'function') {
          this.setIsCapturing(false);
        }
        
        // TopBar restoration is now handled by captureAndPreviewProcess
      }
    }, 200);
  };
}

export default SetCalibrateAction; 