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
    this.times = options.times || 1; // Default to 1 if not provided
    this.delay = options.delay || 3; // Default to 3 seconds if not provided
    this.originalCanvasDimensions = null;
  }

  // Get canvas using the global canvas manager
  getCanvas() {
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.getCanvas();
    }
    return this.canvasRef?.current || document.querySelector('#main-canvas');
  }

  // Check if canvas is in fullscreen mode
  isCanvasFullscreen() {
    // Fullscreen functionality removed from simplified canvas manager
    // This method is kept for compatibility but always returns false
    return false;
  }

  // Enter fullscreen using the global canvas manager
  enterFullscreen() {
    // Fullscreen functionality removed from simplified canvas manager
    // This method is kept for compatibility but does nothing
    return null;
  }

  // Exit fullscreen using the global canvas manager
  exitFullscreen() {
    // Fullscreen functionality removed from simplified canvas manager
    // This method is kept for compatibility but does nothing
    return null;
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

  // Transform canvas coordinates to viewport coordinates
  transformCoordinates(canvas, point) {
    if (!canvas || !point) return point;
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + point.x,
      y: rect.top + point.y
    };
  }

  // Main function to handle calibration sequence
  handleSetCalibrate = async () => {
    // Use the settings values passed from index.js
    const times = this.times;
    const delay = this.delay;
    
    console.log(`[SetCalibrateAction] Using passed settings - Times: ${times}, Delay: ${delay}`);
    
    // Hide the TopBar before starting calibration
    // Use the same TopBar control pattern as index.js
    if (typeof window !== 'undefined' && window.toggleTopBar) {
      console.log('SetCalibrateAction: Using global window.toggleTopBar(false)...');
      window.toggleTopBar(false);
      console.log('SetCalibrateAction: TopBar hidden via global window.toggleTopBar');
    } else if (typeof this.toggleTopBar === 'function') {
      console.log('SetCalibrateAction: Using passed toggleTopBar(false)...');
      this.toggleTopBar(false);
      console.log('SetCalibrateAction: TopBar hidden via passed toggleTopBar function');
    }
    
    // Set capturing state if function exists
    if (typeof this.setIsCapturing === 'function') {
      this.setIsCapturing(true);
    }
    
    this.onStatusUpdate?.({
      processStatus: `Starting ${times} calibration sequences with ${delay}s delay...`,
      isCapturing: true
    });
    
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

        // Generate calibration points based on ORIGINAL canvas size
        const points = generateCalibrationPoints(this.originalCanvasDimensions.width, this.originalCanvasDimensions.height);
        
        if (!points || points.length === 0) {
          throw new Error("Failed to generate calibration points");
        }

        // Process all sequences
        let totalSuccessCount = 0;
        let currentSequence = 1;
        
        while (currentSequence <= times) {
          // Update status for current sequence
          this.onStatusUpdate?.({
            processStatus: `Calibration sequence ${currentSequence} of ${times}`,
            isCapturing: true
          });
          
          // Create status indicator for this sequence
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
          statusIndicator.textContent = `Calibration Sequence ${currentSequence}/${times}: Initializing...`;
          document.body.appendChild(statusIndicator);

          // Process each calibration point in this sequence
          let sequenceSuccessCount = 0;
          for (let i = 0; i < points.length; i++) {
          const originalPoint = points[i];
          
          // Transform coordinates for fullscreen display
          const transformedPoint = this.transformCoordinates(canvas, originalPoint);
          
          // Update status displays
          statusIndicator.textContent = `Sequence ${currentSequence}/${times}: Point ${i + 1}/${points.length}`;
          this.setProcessStatus(`Processing calibration point ${i + 1}/${points.length} (Sequence ${currentSequence}/${times})`);
          
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
            left: ${transformedPoint.x - 10}px;
            top: ${transformedPoint.y - 10}px;
            transform: none;
            color: red;
            font-size: 13px;
            font-weight: bold;
            text-shadow: 0 0 4px white, 0 0 6px white, 0 0 8px white;
            z-index: 10000;
            background-color: rgba(255, 255, 255, 0.98);
            border: 1px solid red;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 0 6px rgba(0, 0, 0, 0.7), 0 0 10px rgba(255, 0, 0, 0.5);
            animation: countdownPulse 1s infinite;
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
              this.setProcessStatus(`Point ${i+1}/${points.length} (Sequence ${currentSequence}/${times}): Countdown ${count}`);
              
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
            console.log(`Capturing calibration point ${i+1}/${points.length} (Sequence ${currentSequence}/${times}) at (${originalPoint.x}, ${originalPoint.y})`);
            
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
              sequenceSuccessCount++;
            }

            // Wait a moment before clearing to ensure capture is complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Clear the dot after capture using canvas management system
            this.clearCanvas();

            // Wait between points
            await new Promise(resolve => setTimeout(resolve, 1200));
            
          } catch (error) {
            console.error(`Error processing calibration point ${i+1} (Sequence ${currentSequence}/${times}):`, error);
          } finally {
            // Clean up countdown if it still exists
            if (countdownElement.parentNode) {
              countdownElement.parentNode.removeChild(countdownElement);
            }
            
            // Clear redraw interval
            clearInterval(redrawInterval);
          }
        }
        
        // Sequence complete
        totalSuccessCount += sequenceSuccessCount;
        
        // Update status for sequence completion
        if (statusIndicator) {
          statusIndicator.textContent = `Sequence ${currentSequence}/${times} complete: ${sequenceSuccessCount}/${points.length} points`;
        }
        this.setProcessStatus(`Calibration sequence ${currentSequence}/${times} completed: ${sequenceSuccessCount}/${points.length} points captured`);
        
        // Remove status indicator for this sequence
        setTimeout(() => {
          if (statusIndicator.parentNode) {
            statusIndicator.parentNode.removeChild(statusIndicator);
          }
        }, 2000);
        
        // Wait between sequences for the specified delay time
        if (currentSequence < times) {
          this.onStatusUpdate?.({
            processStatus: `Waiting ${delay}s before next calibration sequence...`,
            isCapturing: true
          });
          
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
        
        // Move to next sequence
        currentSequence++;
      }
      
      // All sequences complete
      this.onStatusUpdate?.({
        processStatus: `Calibration sequences completed: ${totalSuccessCount}/${points.length * times} total points captured`,
        isCapturing: false
      });
        
      } catch (error) {
        console.error("Calibration error:", error);
        this.setProcessStatus(`Calibration error: ${error.message}`);
      } finally {

        
        // Set capturing state to false if function exists
        if (typeof this.setIsCapturing === 'function') {
          this.setIsCapturing(false);
        }
        
        // TopBar restoration is now handled by captureAndPreviewProcess
        // But add a fallback to ensure TopBar is always restored
        setTimeout(() => {
          // Use the same TopBar control pattern as index.js
          if (typeof window !== 'undefined' && window.toggleTopBar) {
            console.log('SetCalibrateAction: Fallback - Using global window.toggleTopBar(true)...');
            window.toggleTopBar(true);
            console.log('SetCalibrateAction: Fallback - TopBar restored via global window.toggleTopBar');
          } else if (typeof this.toggleTopBar === 'function') {
            console.log('SetCalibrateAction: Fallback - Using passed toggleTopBar(true)...');
            this.toggleTopBar(true);
            console.log('SetCalibrateAction: Fallback - TopBar restored via passed toggleTopBar function');
          }
        }, 1000); // Small delay to ensure captureAndPreviewProcess has time to handle it first
      }
    }, 200);
  };
}

export default SetCalibrateAction; 