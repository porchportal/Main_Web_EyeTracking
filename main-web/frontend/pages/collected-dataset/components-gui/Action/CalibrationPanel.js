// components/CalibrationPanel.js
import React, { useState, useRef } from 'react';
import SetCalibrateButton from './SetCalibrateButton';

const CalibrationPanel = ({ triggerCameraAccess }) => {
  const [outputText, setOutputText] = useState('');
  const canvasRef = useRef(null);

  // Function to toggle TopBar visibility
  const toggleTopBar = (show) => {
    // Call the global toggleTopBar function if available
    if (typeof window !== 'undefined' && window.toggleTopBar) {
      window.toggleTopBar(show);
    } else {
      console.log(`TopBar visibility would be set to: ${show}`);
    }
  };

  return (
    <div className="calibration-panel p-4 bg-white rounded-md shadow-md">
      <h2 className="text-lg font-semibold mb-4">Eye Tracking Calibration</h2>
      
      {/* Canvas for drawing dots */}
      <div 
        className="canvas-container mb-4" 
        style={{ 
          position: 'relative', 
          width: '100%', 
          height: '300px', 
          border: '1px solid #e0e0e0', 
          backgroundColor: 'white', 
          borderRadius: '4px' 
        }}
      >
        <canvas 
          ref={canvasRef}
          className="tracking-canvas"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      
      {/* Calibration controls */}
      <div className="controls-container grid grid-cols-1 gap-3">
        <SetCalibrateButton 
          canvasRef={canvasRef}
          setOutputText={setOutputText}
          triggerCameraAccess={triggerCameraAccess}
          toggleTopBar={toggleTopBar}
        />
        
        {/* Status output */}
        {outputText && (
          <div className="status-display p-2 bg-gray-100 rounded-md text-sm">
            {outputText}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalibrationPanel;