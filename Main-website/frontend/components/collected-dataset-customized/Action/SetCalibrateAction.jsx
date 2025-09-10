// SetCalibrateAction.jsx
// Handles the calibration sequence functionality

import React from 'react';
import { generateCalibrationPoints } from './CalibratePoints.jsx';
import { captureAndPreviewProcess } from './countSave.jsx';
import { getRandomPosition } from './countSave.jsx';

class SetCalibrateAction {
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
    
    // TopBar hiding is now handled in index.js
    
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
            
            // Update status displays
            statusIndicator.textContent = `Sequence ${currentSequence}/${times}: Point ${i + 1}/${points.length}`;
            this.setProcessStatus(`Processing calibration point ${i + 1}/${points.length} (Sequence ${currentSequence}/${times})`);
            
            // Clear canvas with yellow background using canvas management system
            this.clearCanvas();
            
            // Draw the calibration point using ORIGINAL coordinates (canvas coordinates)
            const radius = 12; // Standard size for consistency
            this.drawDot(originalPoint.x, originalPoint.y, radius);
            
            // Store current dot position
            this.setCurrentDot(originalPoint);
            
            try {
              // Ensure camera is active before capture
              if (typeof window !== 'undefined' && window.cameraStateManager) {
                console.log('🔍 SetCalibrateAction: Ensuring camera is active before capture...');
                await window.cameraStateManager.ensureCameraActive();
                window.cameraStateManager.debugCameraState();
              }
              
              // Use the shared capture and preview process (like RandomDotAction)
              // This will handle the countdown and capture automatically
              const captureResult = await captureAndPreviewProcess({
                canvasRef: { current: canvas },
                position: originalPoint,
                captureCounter: this.captureCounter,
                setCaptureCounter: this.setCaptureCounter,
                setProcessStatus: this.setProcessStatus,
                onStatusUpdate: this.onStatusUpdate,
                captureFolder: 'eye_tracking_captures'
              });

              if (captureResult && (captureResult.screenImage || captureResult.success)) {
                sequenceSuccessCount++;
              }

              // Clear the dot after capture using canvas management system
              this.clearCanvas();

              // Wait between points
              await new Promise(resolve => setTimeout(resolve, 1200));
              
            } catch (error) {
              console.error(`Error processing calibration point ${i+1} (Sequence ${currentSequence}/${times}):`, error);
              // Clear canvas on error
              this.clearCanvas();
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
        
        // TopBar restoration is now handled by index.js
      }
    }, 200);
  };
}

export default SetCalibrateAction; 