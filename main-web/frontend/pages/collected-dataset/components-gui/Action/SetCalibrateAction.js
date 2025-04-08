// Fixed SetCalibrateAction.js - Resolving reference errors
import { generateCalibrationPoints } from './CalibratePoints';
import { drawRedDot, runCountdown, createCountdownElement, showCapturePreview } from './countSave';
import { captureImagesAtPoint } from '../Helper/savefile';

const SetCalibrateAction = ({ 
  canvasRef, 
  onStatusUpdate, 
  setCaptureCounter,
  toggleTopBar,
  captureCounter = 1,
  triggerCameraAccess
}) => {
  // Wait until canvas is fully ready
  const waitForCanvas = async (maxTries = 20, interval = 100) => {
    for (let i = 0; i < maxTries; i++) {
      const canvas = canvasRef.current;
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        return canvas;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error("Canvas not ready after multiple attempts");
  };

  // Calibration trigger function - using the same process as Random Dot
  const handleSetCalibrate = async () => {
    try {
      // Hide UI
      if (toggleTopBar) toggleTopBar(false);

      onStatusUpdate?.({
        processStatus: 'Initializing calibration...',
        isCapturing: true
      });

      // Wait for canvas to be ready
      const canvas = await waitForCanvas();
      
      // Generate calibration points
      const points = generateCalibrationPoints(canvas.width, canvas.height);
      
      if (!points || points.length === 0) {
        throw new Error("Failed to generate calibration points");
      }
      
      // Create status indicator
      const statusIndicator = document.createElement('div');
      statusIndicator.className = 'calibrate-status-indicator';
      statusIndicator.style.cssText = `
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
      statusIndicator.textContent = 'Calibration: Initializing...';
      document.body.appendChild(statusIndicator);
      
      // Access webcam before starting calibration
      if (triggerCameraAccess) triggerCameraAccess(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Process each calibration point
      let successCount = 0;
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        
        statusIndicator.textContent = `Calibration: Point ${i + 1}/${points.length}`;
        
        onStatusUpdate?.({
          processStatus: `Processing point ${i + 1}/${points.length}`,
          isCapturing: true
        });
        
        // Clear the canvas before drawing new point
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the dot - JUST LIKE RANDOM DOT
        drawRedDot(ctx, point.x, point.y);
        
        // Run countdown - JUST LIKE RANDOM DOT
        await new Promise(resolve => {
          runCountdown(
            point,
            canvas,
            (status) => {
              // Update UI based on status
              if (status.processStatus) {
                onStatusUpdate?.({
                  processStatus: status.processStatus,
                  isCapturing: true
                });
              }
            },
            resolve // This will be called when countdown completes
          );
        });
        
        // Capture images at this point - JUST LIKE RANDOM DOT
        try {
          // Trigger camera access again to ensure it's on
          if (triggerCameraAccess) triggerCameraAccess(true);
          
          // Use the same captureImagesAtPoint function used by Random Dot
          const captureResult = await captureImagesAtPoint({
            point: point,
            captureCount: captureCounter,
            canvasRef: { current: canvas },
            setCaptureCount: setCaptureCounter,
            showCapturePreview
          });
          
          if (captureResult && (captureResult.screenImage || captureResult.success)) {
            successCount++;
          }
          
          // Increment counter
          if (setCaptureCounter) {
            setCaptureCounter(prev => prev + 1);
          }
        } catch (error) {
          console.error(`Error capturing point ${i+1}:`, error);
        }
        
        // Wait between points
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
      
      // Calibration complete
      statusIndicator.textContent = `Calibration complete: ${successCount}/${points.length} points`;
      onStatusUpdate?.({
        processStatus: `Calibration completed: ${successCount}/${points.length} points captured`,
        isCapturing: false
      });
      
      // Remove the status indicator after a delay
      setTimeout(() => {
        if (statusIndicator.parentNode) {
          statusIndicator.parentNode.removeChild(statusIndicator);
        }
      }, 3000);
      
      // Turn TopBar back on
      if (toggleTopBar) {
        toggleTopBar(true);
      }

    } catch (err) {
      console.error('Calibration error:', err);
      onStatusUpdate?.({
        processStatus: `Calibration failed: ${err.message}`,
        isCapturing: false
      });
      if (toggleTopBar) toggleTopBar(true);
    }
  };

  return {
    handleAction: handleSetCalibrate
  };
};

export default SetCalibrateAction;