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
    
    // Store original canvas dimensions for coordinate transformation
    this.originalCanvasDimensions = null;
  }

  // Get or create canvas using the canvas management system from actionButton.js
  getCanvas() {
    // Use the global canvas manager
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.getCanvas();
    }
    
    // Fallback to canvasUtils from actionButton.js
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

  // Transform canvas coordinates to viewport coordinates when in fullscreen
  transformCoordinates(canvas, point) {
    if (!canvas || !point) return point;
    
    // If canvas is in fullscreen mode, we need to transform coordinates
    const isFullscreen = this.canvasManager?.isInFullscreen() || 
                        this.canvasUtils?.isFullscreen?.() ||
                        (canvas.style.position === 'fixed' && canvas.style.width === '100vw');
    
    console.log('Transform coordinates check:', {
      canvasPosition: canvas.style.position,
      canvasWidth: canvas.style.width,
      canvasHeight: canvas.style.height,
      isFullscreen,
      originalPoint: point,
      canvasRect: canvas.getBoundingClientRect()
    });
    
    if (isFullscreen) {
      // Get the canvas's bounding rect to understand its position in the viewport
      const canvasRect = canvas.getBoundingClientRect();
      
      // Check if canvas is properly positioned
      const isProperlyPositioned = canvasRect.left === 0 && canvasRect.top === 0 &&
                                  canvasRect.width === window.innerWidth && 
                                  canvasRect.height === window.innerHeight;
      
      console.log('Canvas positioning check:', {
        canvasRect,
        windowSize: { width: window.innerWidth, height: window.innerHeight },
        isProperlyPositioned
      });
      
      // Calculate the scale factors
      const scaleX = canvasRect.width / canvas.width;
      const scaleY = canvasRect.height / canvas.height;
      
      // Transform the coordinates
      const transformedPoint = {
        x: point.x * scaleX + canvasRect.left,
        y: point.y * scaleY + canvasRect.top,
        label: point.label
      };
      
      console.log('Coordinate transformation:', {
        original: point,
        transformed: transformedPoint,
        canvasRect,
        scale: { x: scaleX, y: scaleY },
        canvasDimensions: { width: canvas.width, height: canvas.height }
      });
      
      return transformedPoint;
    }
    
    // If not fullscreen, return original coordinates
    return point;
  }

  // Enter fullscreen using the canvas management system
  enterFullscreen() {
    // Use the global canvas manager
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.enterFullscreen();
    }
    
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
      // Store original dimensions before going fullscreen
      this.originalCanvasDimensions = {
        width: canvas.width,
        height: canvas.height
      };
      
      // Remove canvas from its current parent
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      
      // Append to body and set fullscreen styles
      document.body.appendChild(canvas);
      
      // Set fullscreen styles with proper positioning
      canvas.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 99999 !important;
        background-color: yellow !important;
        border: none !important;
        display: block !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        transform: none !important;
      `;
      
      // Set canvas dimensions to match viewport
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Clear with yellow background
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'yellow';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Force a reflow to ensure styles are applied
      canvas.offsetHeight;
      
      console.log('Canvas fullscreen setup:', {
        width: canvas.width,
        height: canvas.height,
        style: canvas.style.cssText,
        rect: canvas.getBoundingClientRect()
      });
    }
    return canvas;
  }

  // Exit fullscreen using the canvas management system
  exitFullscreen() {
    // Use the global canvas manager
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.exitFullscreen();
    }
    
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
      
      // Restore original dimensions if available
      if (this.originalCanvasDimensions) {
        canvas.width = this.originalCanvasDimensions.width;
        canvas.height = this.originalCanvasDimensions.height;
        this.originalCanvasDimensions = null;
      }
    }
    return canvas;
  }

  // Restore elements that were hidden during fullscreen
  restoreHiddenElements() {
    const hiddenElements = document.querySelectorAll('[data-hidden-by-canvas="true"]');
    hiddenElements.forEach(el => {
      el.style.display = '';
      el.removeAttribute('data-hidden-by-canvas');
    });
  }

  // Clear canvas using the canvas management system
  clearCanvas() {
    // Use the global canvas manager
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.clear();
    }
    
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
    // Use the global canvas manager
    if (typeof window !== 'undefined' && window.globalCanvasManager) {
      return window.globalCanvasManager.drawDot(x, y, radius);
    }
    
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

  // Test coordinate transformation
  testCoordinateTransformation(canvas) {
    console.log('Testing coordinate transformation...');
    
    const testPoint = { x: 100, y: 100, label: 'Test' };
    const transformed = this.transformCoordinates(canvas, testPoint);
    
    console.log('Test transformation result:', {
      original: testPoint,
      transformed: transformed,
      canvasInfo: {
        width: canvas.width,
        height: canvas.height,
        style: {
          position: canvas.style.position,
          width: canvas.style.width,
          height: canvas.style.height
        },
        rect: canvas.getBoundingClientRect()
      }
    });
    
    return transformed;
  }

  // Ensure canvas is properly positioned and sized for fullscreen
  ensureCanvasFullscreen(canvas) {
    if (!canvas) return false;
    
    // Remove any conflicting elements that might interfere
    this.removeConflictingElements();
    
    // Ensure canvas is in body
    if (canvas.parentNode !== document.body) {
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      document.body.appendChild(canvas);
    }
    
    // Force canvas to cover entire viewport
    canvas.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 99999 !important;
      background-color: white !important;
      border: none !important;
      display: block !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      transform: none !important;
    `;
    
    // Set dimensions to match viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Clear with white background
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Force reflow
    canvas.offsetHeight;
    
    // Verify positioning
    const rect = canvas.getBoundingClientRect();
    const isProperlyPositioned = rect.left === 0 && rect.top === 0 &&
                                rect.width === window.innerWidth && 
                                rect.height === window.innerHeight;
    
    console.log('Canvas fullscreen verification:', {
      rect,
      windowSize: { width: window.innerWidth, height: window.innerHeight },
      isProperlyPositioned,
      canvasDimensions: { width: canvas.width, height: canvas.height }
    });
    
    return isProperlyPositioned;
  }

  // Remove any conflicting elements that might interfere with fullscreen canvas
  removeConflictingElements() {
    // Hide any elements that might interfere with fullscreen display
    const elementsToHide = [
      '.topbar',
      '.canvas-container', 
      '.main-content',
      '.metrics-panel',
      '.display-metrics',
      'nav',
      'header',
      '.button-groups',
      '.control-buttons'
    ];
    
    elementsToHide.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el.style.display !== 'none') {
          el.style.display = 'none';
          el.setAttribute('data-hidden-by-canvas', 'true');
        }
      });
    });
    
    // Remove any existing countdown elements
    const existingCountdowns = document.querySelectorAll('.dot-countdown, .calibrate-countdown');
    existingCountdowns.forEach(el => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
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

        // Store original canvas dimensions before going fullscreen
        this.originalCanvasDimensions = {
          width: canvas.width,
          height: canvas.height
        };

        // Use canvas management system to enter fullscreen
        this.enterFullscreen();

        // Ensure canvas is properly positioned and sized
        const isProperlyPositioned = this.ensureCanvasFullscreen(canvas);
        if (!isProperlyPositioned) {
          console.warn('Canvas not properly positioned for fullscreen, attempting to fix...');
          // Try one more time after a short delay
          setTimeout(() => {
            this.ensureCanvasFullscreen(canvas);
          }, 100);
        }

        // Test coordinate transformation
        this.testCoordinateTransformation(canvas);

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
            
            const captureResult = await captureImagesAtPoint({
              point: originalPoint, // Use original coordinates for capture
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
        
        // Restore hidden elements
        this.restoreHiddenElements();
        
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