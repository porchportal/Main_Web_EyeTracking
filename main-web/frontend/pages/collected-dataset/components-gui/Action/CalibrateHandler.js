// CalibrateHandler.js - Handles the calibration process
import { generateCalibrationPoints } from './CalibratePoints';
import {
  drawRedDot,
  captureAndPreviewProcess
} from './countSave';

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

      const canvas = this.canvasRef.current;
      const ctx = canvas.getContext('2d');
      drawRedDot(ctx, point.x, point.y);

      if (this.statusIndicator) {
        this.statusIndicator.textContent = `Processing point ${index + 1}/${total}`;
      }

      await captureAndPreviewProcess({
        canvasRef: this.canvasRef,
        position: point,
        captureCounter: this.captureCounter,
        saveImageToServer: async (imageData, filename, type, folder) => {
          const response = await fetch('/api/save-capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageData,
              filename,
              type,
              folder: this.captureFolder
            })
          });

          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
          }

          return await response.json();
        },
        setCaptureCounter: (newCounter) => {
          this.captureCounter = newCounter;
          this.setCaptureCounter?.(newCounter);
        },
        setProcessStatus: (status) => {
          this.setOutputText?.(status);
        },
        toggleTopBar: this.toggleTopBar,
        onStatusUpdate: (status) => {
          const msg = typeof status === 'string' ? status : `Point ${index + 1}/${total} - ${status.countdownValue || status.processStatus}`;
          this.setOutputText?.(msg);
        },
        captureFolder: this.captureFolder
      });

      return true;
    } catch (err) {
      console.error(`Error processing point ${index + 1}:`, err);
      this.statusIndicator.textContent = `Error: ${err.message}`;
      this.setOutputText?.(`Error: ${err.message}`);
      return false;
    }
  }

  async startCalibration() {
    if (this.isProcessing) return false;
    this.isProcessing = true;

    this.toggleTopBar?.(false);

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

      for (let i = 0; i < this.calibrationPoints.length; i++) {
        const success = await this.processCalibrationPoint(this.calibrationPoints[i], i, this.calibrationPoints.length);
        if (!success) break;
      }

      this.setOutputText?.('Calibration completed');
      this.statusIndicator.textContent = 'Calibration completed';
      this.toggleTopBar?.(true);
      this.onComplete?.();

    } catch (error) {
      console.error('Calibration error:', error);
      this.setOutputText?.(`Calibration error: ${error.message}`);
      this.statusIndicator.textContent = `Error: ${error.message}`;
      this.toggleTopBar?.(true);
    } finally {
      this.isProcessing = false;
    }
  }
}

export default CalibrateHandler;