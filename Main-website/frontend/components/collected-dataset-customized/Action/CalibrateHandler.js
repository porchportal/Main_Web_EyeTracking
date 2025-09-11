// CalibrateHandler.js - Using the existing CaptureHandler class
import { generateCalibrationPoints } from './CalibratePoints.jsx';
import CaptureHandler from './CaptureHandler';
import { drawRedDot } from './DotCaptureUtil';

class CalibrateHandler {
  constructor(config) {
    this.canvasRef = config.canvasRef;
    this.toggleTopBar = config.toggleTopBar;
    this.setOutputText = config.setOutputText;
    this.captureCounter = config.captureCounter || 1;
    this.setCaptureCounter = config.setCaptureCounter;
    this.captureFolder = config.captureFolder || 'eye_tracking_captures';
    this.onComplete = config.onComplete;

    // Accept passed-in calibration points (from SetCalibrateAction.js)
    this.calibrationPoints = config.calibrationPoints || [];

    // Create a CaptureHandler instance for handling the captures
    this.captureHandler = new CaptureHandler(
      // Pass saveImageToServer function
      async (imageData, filename, type, folder) => {
        try {
          const response = await fetch('/api/save-capture', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              imageData,
              filename,
              type,
              folder: this.captureFolder
            })
          });
          
          if (!response.ok) {
            return {};
          }
          
          return await response.json();
        } catch (err) {
          return {};
        }
      },
      // Pass setCaptureCounter function
      (newCounter) => {
        if (typeof newCounter === 'function') {
          this.captureCounter = newCounter(this.captureCounter);
        } else {
          this.captureCounter = newCounter;
        }
        
        if (this.setCaptureCounter) {
          this.setCaptureCounter(this.captureCounter);
        }
      },
      // Pass setProcessStatus function
      (status) => {
        if (this.setOutputText) {
          this.setOutputText(status);
        }
      },
      // Pass toggleTopBar function
      this.toggleTopBar
    );

    // Internals
    this.isProcessing = false;
    this.currentPointIndex = 0;
    this.statusIndicator = null;
  }

  createStatusIndicator() {
    const existingIndicators = document.querySelectorAll('.calibrate-status-indicator');
    existingIndicators.forEach(indicator => indicator.remove());

    const indicator = document.createElement('div');
    indicator.className = 'calibrate-status-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background-color: rgba(0, 102, 204, 0.9);
      color: white;
      font-size: 14px;
      font-weight: bold;
      padding: 8px 12px;
      border-radius: 6px;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;
    document.body.appendChild(indicator);
    this.statusIndicator = indicator;
    return indicator;
  }

  async processCalibrationPoint(point, index, total) {
    try {
      if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
        throw new Error("Invalid calibration point");
      }

      if (this.statusIndicator) {
        this.statusIndicator.textContent = `Processing point ${index + 1}/${total}`;
      }

      // Draw the dot
      const canvas = this.canvasRef.current;
      if (!canvas) {
        throw new Error("Canvas not available");
      }
      
      const ctx = canvas.getContext('2d');
      drawRedDot(ctx, point.x, point.y);
      
      // Create countdown element
      const canvasRect = canvas.getBoundingClientRect();
      const countdownElement = document.createElement('div');
      countdownElement.className = 'calibrate-countdown';
      countdownElement.style.cssText = `
        position: fixed;
        left: ${canvasRect.left + point.x}px;
        top: ${canvasRect.top + point.y - 60}px;
        transform: translateX(-50%);
        color: red;
        font-size: 36px;
        font-weight: bold;
        text-shadow: 0 0 10px white, 0 0 20px white;
        z-index: 9999;
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
      
      // Run countdown
      for (let count = 3; count > 0; count--) {
        countdownElement.textContent = count;
        this.setOutputText?.(`Point ${index + 1}/${total} - countdown ${count}`);
        
        // Make sure dot remains visible during countdown
        drawRedDot(ctx, point.x, point.y);
        
        // Wait for next countdown step
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      // Show capturing indicator
      countdownElement.textContent = "✓";
      this.setOutputText?.(`Capturing point ${index + 1}/${total}`);
      
      // Remove countdown element
      setTimeout(() => {
        if (countdownElement.parentNode) {
          countdownElement.parentNode.removeChild(countdownElement);
        }
      }, 300);
      
      // Use CaptureHandler to handle the capture process
      const captureResult = await this.captureHandler.captureAndShowPreview(
        this.captureCounter,
        this.canvasRef,
        point
      );
      
      // Add null check before using the result
      if (!captureResult) {
        // You might want to set a default or retry logic here
      }
      
      // Wait for the preview to complete
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      return true;
    } catch (err) {
      if (this.statusIndicator) {
        this.statusIndicator.textContent = `Error: ${err.message}`;
      }
      this.setOutputText?.(`Error: ${err.message}`);
      return false;
    }
  }

  async startCalibration() {
    if (this.isProcessing) return false;
    this.isProcessing = true;



    if (this.toggleTopBar) {
      this.toggleTopBar(false);
    }

    const indicator = this.createStatusIndicator();
    indicator.textContent = 'Initializing calibration...';

    try {
      const canvas = this.canvasRef.current;
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas is not ready');
      }

      // Only generate if none were passed in
      if (!this.calibrationPoints || this.calibrationPoints.length === 0) {
        this.calibrationPoints = generateCalibrationPoints(canvas.width, canvas.height);

        if (!this.calibrationPoints || this.calibrationPoints.length === 0) {
          throw new Error('Failed to generate calibration points');
        }
      }

      this.setOutputText?.(`Starting calibration with ${this.calibrationPoints.length} points`);
      
      let successCount = 0;
      for (let i = 0; i < this.calibrationPoints.length; i++) {
        const success = await this.processCalibrationPoint(
          this.calibrationPoints[i], 
          i, 
          this.calibrationPoints.length
        );
        
        if (success) {
          successCount++;
        }
        
        // Small delay between points
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      this.setOutputText?.(`Calibration completed: ${successCount}/${this.calibrationPoints.length} points captured`);
      if (this.statusIndicator) {
        this.statusIndicator.textContent = `Calibration complete: ${successCount}/${this.calibrationPoints.length} points`;
      }
      
      // TopBar restoration is now handled by index.js
      
      if (this.onComplete) {
        this.onComplete();
      }

    } catch (error) {
      // console.error('Calibration error:', error);
      // this.setOutputText?.(`Calibration error: ${error.message}`);
      // if (this.statusIndicator) {
      //   this.statusIndicator.textContent = `Error: ${error.message}`;
      // }
      
      // // Make sure we turn TopBar back on even on error
      // if (this.toggleTopBar) {
      //   this.toggleTopBar(true);
      // }
  
      // Show error message
      if (this.setProcessStatus) {
        this.setProcessStatus('Error: ' + error.message);
      }
      
      // TopBar restoration is now handled by index.js
      
      // Return a default object to prevent null reference errors
      return {
        screenImage: '',
        webcamImage: '',
        success: false
      };
    } finally {
      this.isProcessing = false;
      
      // Remove the status indicator after a delay
      setTimeout(() => {
        if (this.statusIndicator && this.statusIndicator.parentNode) {
          this.statusIndicator.parentNode.removeChild(this.statusIndicator);
        }
      }, 3000);
    }
  }
}

export default CalibrateHandler;