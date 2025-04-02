// SetCalibrateAction.js - Updated version with proper imports
import CalibrateHandler from './CalibrateHandler';
import { generateCalibrationPoints } from './CalibratePoints';

const SetCalibrateAction = ({ 
  canvasRef, 
  onStatusUpdate, 
  setCaptureCounter,
  saveImageToServer,
  toggleTopBar,
  captureCounter = 1
}) => {
  // Pre-check for canvas readiness
  const isCanvasReady = () => {
    const canvas = canvasRef.current;
    return canvas && canvas.width > 0 && canvas.height > 0;
  };

  // Utility to wait for canvas to be ready
  const waitForCanvas = async (maxTries = 20, interval = 100) => {
    for (let i = 0; i < maxTries; i++) {
      if (isCanvasReady()) {
        return canvasRef.current;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error("Canvas not ready after multiple attempts");
  };

  // Main handler function for the Set Calibrate button
  const handleSetCalibrate = async () => {
    try {
      // Hide TopBar first
      if (toggleTopBar) {
        toggleTopBar(false);
      }
      
      // Update status
      if (onStatusUpdate) {
        onStatusUpdate({
          processStatus: 'Starting calibration sequence',
          isCapturing: true
        });
      }
      
      // Wait for canvas to be ready
      console.log("Waiting for canvas to be ready...");
      const canvas = await waitForCanvas();
      console.log(`Canvas ready: ${canvas.width}x${canvas.height}`);
      
      // Check if canvas dimensions are valid
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error("Canvas has zero dimensions");
      }
      
      // First test if we can generate points
      const testPoints = generateCalibrationPoints(canvas.width, canvas.height);
      if (!testPoints || testPoints.length === 0) {
        throw new Error("Failed to generate calibration points");
      }
      
      // Create a handler for the calibration process
      const calibrateHandler = new CalibrateHandler({
        canvasRef,
        toggleTopBar,
        setOutputText: (status) => {
          if (onStatusUpdate) {
            if (typeof status === 'string') {
              onStatusUpdate(status);
            } else {
              onStatusUpdate({
                processStatus: status,
                isCapturing: true
              });
            }
          }
        },
        captureCounter,
        setCaptureCounter,
        captureFolder: 'eye_tracking_captures',
        onComplete: () => {
          // Update parent component when complete
          if (onStatusUpdate) {
            onStatusUpdate({
              processStatus: 'Calibration completed',
              isCapturing: false
            });
          }
        }
      });
      
      // Start the calibration process
      await calibrateHandler.startCalibration();
      
    } catch (error) {
      console.error('Error in calibration:', error);
      
      // Update parent with error
      if (onStatusUpdate) {
        onStatusUpdate({
          processStatus: `Calibration error: ${error.message}`,
          isCapturing: false
        });
      }
      
      // Show TopBar again
      if (toggleTopBar) {
        toggleTopBar(true);
      }
    }
  };

  return {
    handleAction: handleSetCalibrate
  };
};

export default SetCalibrateAction;