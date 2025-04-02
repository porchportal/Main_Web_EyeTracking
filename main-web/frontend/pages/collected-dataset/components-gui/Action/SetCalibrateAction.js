// SetCalibrateAction.js - Uses fixed dot positions from CalibratePoints.js
import CalibrateHandler from './CalibrateHandler';
import { generateCalibrationPoints } from './CalibratePoints'; // dot source

const SetCalibrateAction = ({ 
  canvasRef, 
  onStatusUpdate, 
  setCaptureCounter,
  toggleTopBar,
  captureCounter = 1
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

  // Calibration trigger function
  const handleSetCalibrate = async () => {
    try {
      if (toggleTopBar) toggleTopBar(false); // Hide UI

      onStatusUpdate?.({
        processStatus: 'Waiting for canvas...',
        isCapturing: true
      });

      const canvas = await waitForCanvas();
      const points = generateCalibrationPoints(canvas.width, canvas.height); // ← fixed points here

      // CalibrateHandler initialized with fixed points
      const calibrateHandler = new CalibrateHandler({
        canvasRef,
        calibrationPoints: points,
        toggleTopBar,
        setOutputText: (status) => {
          onStatusUpdate?.({
            processStatus: typeof status === 'string' ? status : status.processStatus,
            countdownValue: status?.countdownValue,
            isCapturing: true
          });
        },
        captureCounter,
        setCaptureCounter,
        captureFolder: 'eye_tracking_captures',
        onComplete: () => {
          onStatusUpdate?.({
            processStatus: 'Calibration completed',
            isCapturing: false
          });
          toggleTopBar?.(true);
        }
      });

      // Start the dot sequence
      await calibrateHandler.startCalibration();

    } catch (err) {
      console.error('Calibration error:', err);
      onStatusUpdate?.({
        processStatus: `Calibration failed: ${err.message}`,
        isCapturing: false
      });
      toggleTopBar?.(true);
    }
  };

  return {
    handleAction: handleSetCalibrate
  };
};

export default SetCalibrateAction;