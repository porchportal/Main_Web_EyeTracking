// components/Action/ClearAllAction.js
import React from 'react';

const ClearAllAction = ({ canvasRef, onStatusUpdate }) => {
  // Clear the canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Clear All Button - Reset everything
  const handleClearAll = () => {
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
  };

  return {
    component: (
      <button
        onClick={handleClearAll}
        className="app-button w-full"
        style={{
          backgroundColor: '#7CFFDA',
          border: '1px solid #000',
          padding: '3px 10px',
          cursor: 'pointer'
        }}
      >
        Clear All
      </button>
    ),
    clearCanvas,
    handleAction: handleClearAll
  };
};

export default ClearAllAction;