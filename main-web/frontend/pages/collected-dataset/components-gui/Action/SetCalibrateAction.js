// Fixed SetRandomAction.js
import { getRandomPosition, drawRedDot, runCountdown, showCapturePreview } from './countSave';
import { captureImagesAtPoint } from '../Helper/savefile';

const SetRandomAction = ({ 
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

  // Main handler for Set Random button
  const handleSetRandom = async () => {
    try {
      // Get control values from the TopBar
      const timeInput = document.querySelector('.control-input-field');
      const delayInput = document.querySelectorAll('.control-input-field')[1];
      
      // Default values if inputs can't be found
      let times = 1;
      let delay = 3;
      
      // Parse input values if available
      if (timeInput) {
        const parsedTime = parseInt(timeInput.value, 10);
        if (!isNaN(parsedTime) && parsedTime > 0) {
          times = parsedTime;
        }
      }
      
      if (delayInput) {
        const parsedDelay = parseInt(delayInput.value, 10);
        if (!isNaN(parsedDelay) && parsedDelay > 0) {
          delay = parsedDelay;
        }
      }
      
      // Hide UI during capture process
      if (toggleTopBar) toggleTopBar(false);
      
      onStatusUpdate?.({
        processStatus: `Starting ${times} random captures with ${delay}s delay...`,
        isCapturing: true,
        remainingCaptures: times
      });
      
      // Wait for canvas to be ready
      const canvas = await waitForCanvas();
      
      // Process all captures sequentially
      let successCount = 0;
      let currentCapture = 1;
      
      while (currentCapture <= times) {
        // Update status for current capture
        onStatusUpdate?.({
          processStatus: `Capture ${currentCapture} of ${times}`,
          remainingCaptures: times - currentCapture + 1,
          isCapturing: true
        });
        
        // Clear canvas before each capture
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Generate random position for this capture
        const position = getRandomPosition(canvas, 20);
        
        // Draw the dot
        drawRedDot(ctx, position.x, position.y);
        
        // Create a redrawInterval to ensure dot stays visible
        let redrawInterval = setInterval(() => {
          drawRedDot(ctx, position.x, position.y, 12, false);
        }, 200);
        
        // Run countdown and wait for it to complete
        await new Promise(resolve => {
          runCountdown(
            position,
            canvas,
            (status) => {
              // Update UI based on status
              if (status.processStatus) {
                onStatusUpdate?.({
                  processStatus: `Capture ${currentCapture}/${times}: ${status.processStatus}`,
                  remainingCaptures: times - currentCapture + 1,
                  isCapturing: true
                });
              }
            },
            resolve // This will be called when countdown completes
          );
        });
        
        // Clear redrawInterval after countdown
        clearInterval(redrawInterval);
        
        // Trigger camera access before capture
        if (triggerCameraAccess) triggerCameraAccess(true);
        
        // Wait briefly for camera to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Capture images at this point
        try {
          const captureResult = await captureImagesAtPoint({
            point: position,
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
          console.error(`Error capturing point ${currentCapture}:`, error);
        }
        
        // Wait between captures for the specified delay time
        if (currentCapture < times) {
          onStatusUpdate?.({
            processStatus: `Waiting ${delay}s before next capture...`,
            remainingCaptures: times - currentCapture,
            isCapturing: true
          });
          
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
        
        // Move to next capture
        currentCapture++;
      }
      
      // Sequence complete
      onStatusUpdate?.({
        processStatus: `Random capture sequence completed: ${successCount}/${times} captures successful`,
        remainingCaptures: 0,
        isCapturing: false
      });
      
      // Turn TopBar back on
      if (toggleTopBar) {
        toggleTopBar(true);
      }
      
    } catch (err) {
      console.error('Random sequence error:', err);
      onStatusUpdate?.({
        processStatus: `Random sequence failed: ${err.message}`,
        isCapturing: false,
        remainingCaptures: 0
      });
      
      // Make sure to restore the UI
      if (toggleTopBar) toggleTopBar(true);
    }
  };

  return {
    handleAction: handleSetRandom
  };
};

export default SetRandomAction;