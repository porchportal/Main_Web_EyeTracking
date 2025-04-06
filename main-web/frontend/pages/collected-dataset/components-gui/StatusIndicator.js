// components-gui/StatusIndicator.js
import React, { useEffect } from 'react';

const StatusIndicator = ({ 
  isTopBarShown = true, 
  isCanvasVisible = false,
  onStatusChange = () => {},
  style = {} 
}) => {
  useEffect(() => {
    const message = `TopBar ${isTopBarShown ? 'shown' : 'hidden'}, Canvas: ${isCanvasVisible ? 'Visible' : 'Hidden'}`;
    onStatusChange(message);
  }, [isTopBarShown, isCanvasVisible, onStatusChange]);

  return (
    <div 
      className="status-indicator"
      style={{
        position: 'fixed',
        top: '10px',
        right: '60px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '8px',
        fontSize: '12px',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
        zIndex: 9999,
        ...style
      }}
    >
      {/* TopBar Status */}
      <div 
        className="status-item"
        style={{
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <div 
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: isTopBarShown ? '#00cc00' : '#ff0000',
            marginRight: '6px'
          }} 
        />
        <span>TopBar {isTopBarShown ? 'shown' : 'hidden'}</span>
      </div>
      
      {/* Canvas Status */}
      <div 
        className="status-item"
        style={{
          display: 'flex',
          alignItems: 'center',
          transition: 'color 0.3s, background-color 0.3s'
        }}
      >
        <div 
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: isCanvasVisible ? '#00cc00' : '#ff0000',
            marginRight: '6px',
            transition: 'background-color 0.3s'
          }} 
        />
        <span>Canvas: {isCanvasVisible ? 'Visible' : 'Hidden'}</span>
      </div>
    </div>
  );
};

export default StatusIndicator;