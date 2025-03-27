// components/Action/ClearAllAction.js
import { useCallback } from 'react';

export const useClearAll = ({ canvasRef, onStatusUpdate }) => {
  // Clear the canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [canvasRef]);

  // Clear All Button - Reset everything
  const handleClearAll = useCallback(() => {
    clearCanvas();
    
    // Reset status
    onStatusUpdate({
      processStatus: '',
      remainingCaptures: 0,
      isCapturing: false,
      countdownValue: null
    });
    
    // Briefly show cleared message
    onStatusUpdate({
      processStatus: 'Canvas cleared'
    });
    
    // Clear the message after a delay
    setTimeout(() => {
      onStatusUpdate({
        processStatus: ''
      });
    }, 1500);
  }, [clearCanvas, onStatusUpdate]);

  return {
    clearCanvas,
    handleAction: handleClearAll
  };
};

export default useClearAll;