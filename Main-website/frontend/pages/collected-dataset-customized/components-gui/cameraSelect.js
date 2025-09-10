import React, { useState, useCallback, useEffect } from 'react';

const CameraSelect = ({ 
  showCameraSelector, 
  setShowCameraSelector, 
  availableCameras, 
  setAvailableCameras,
  selectedCameras, 
  setSelectedCameras,
  setProcessStatus,
  getAvailableCameras
}) => {
  const handleCameraSelection = useCallback((cameraId, isSelected) => {
    setSelectedCameras(prev => {
      if (isSelected) {
        if (!prev.includes(cameraId) && prev.length < 2) {
          return [...prev, cameraId];
        }
      } else {
        return prev.filter(id => id !== cameraId);
      }
      return prev;
    });
  }, [setSelectedCameras]);

  const closeCameraSelector = useCallback(() => {
    setShowCameraSelector(false);
  }, [setShowCameraSelector]);

  const handleApplySelection = useCallback(() => {
    if (selectedCameras.length > 0) {
      const selectedCameraNames = selectedCameras.map(id => {
        const camera = availableCameras.find(cam => cam.id === id);
        return camera ? camera.label : 'Unknown';
      });
      setProcessStatus(`Selected ${selectedCameras.length} camera(s): ${selectedCameraNames.join(', ')}`);
      closeCameraSelector();
    } else {
      setProcessStatus('Please select at least one camera');
    }
  }, [selectedCameras, availableCameras, setProcessStatus, closeCameraSelector]);

  // Auto-fetch cameras when modal opens
  useEffect(() => {
    if (showCameraSelector && getAvailableCameras) {
      getAvailableCameras();
    }
  }, [showCameraSelector, getAvailableCameras]);

  if (!showCameraSelector) {
    return null;
  }

  return (
    <>
      <div className="camera-selector-modal" style={{ zIndex: 25 }}>
        <div className="camera-selector-dialog">
          <div className="camera-selector-header">
            <h2 className="camera-selector-title">📷 Camera Selection</h2>
            <button
              onClick={closeCameraSelector}
              className="camera-selector-close-btn"
            >
              ×
            </button>
          </div>

          {/* Available Cameras */}
          <div className="camera-selector-section">
            <h3 className="camera-selector-section-title">
              Available Cameras ({availableCameras.length})
            </h3>
            <div className="camera-selector-info">
              <p>Select up to 2 cameras for dual preview</p>
              <p>Selected: {selectedCameras.length}/2</p>
            </div>
            {availableCameras.length === 0 ? (
              <p className="camera-selector-no-cameras">
                No cameras detected. Please check your camera permissions.
              </p>
            ) : (
              <div className="camera-selector-list">
                {availableCameras.map((camera) => {
                  const isSelected = selectedCameras.includes(camera.id);
                  const isDisabled = !isSelected && selectedCameras.length >= 2;
                  
                  return (
                    <label 
                      key={camera.id} 
                      className={`camera-selector-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={(e) => handleCameraSelection(camera.id, e.target.checked)}
                        className="camera-selector-checkbox"
                      />
                      <div>
                        <div className="camera-selector-item-label">
                          {camera.label}
                        </div>
                        <div className="camera-selector-item-id">
                          ID: {camera.id.substring(0, 20)}...
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="camera-selector-actions">
            <button
              onClick={closeCameraSelector}
              className="camera-selector-btn cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleApplySelection}
              className="camera-selector-btn apply"
            >
              Apply ({selectedCameras.length} selected)
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* Camera selector modal styles */
        .camera-selector-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 25;
        }

        .camera-selector-dialog {
          background-color: white;
          border-radius: 8px;
          padding: 20px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          outline: none;
        }

        .camera-selector-dialog:focus {
          outline: none;
        }

        .camera-selector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e0e0e0;
        }

        .camera-selector-title {
          margin: 0;
          font-size: 18px;
          font-weight: bold;
          color: #333;
        }

        .camera-selector-close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background-color 0.2s ease;
        }

        .camera-selector-close-btn:hover {
          background-color: #f0f0f0;
        }

        .camera-selector-section {
          margin-bottom: 20px;
        }

        .camera-selector-section-title {
          margin: 0 0 15px 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .camera-selector-info {
          background-color: #f8f9fa;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
          border-left: 4px solid #007bff;
        }

        .camera-selector-info p {
          margin: 0;
          font-size: 14px;
          color: #666;
        }

        .camera-selector-info p:first-child {
          font-weight: 500;
          color: #333;
        }

        .camera-selector-no-cameras {
          text-align: center;
          color: #666;
          font-style: italic;
          padding: 20px;
          background-color: #f9f9f9;
          border-radius: 4px;
        }

        .camera-selector-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .camera-selector-item {
          display: flex;
          align-items: center;
          padding: 12px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          background-color: white;
        }

        .camera-selector-item:hover {
          background-color: #f8f9fa;
          border-color: #007bff;
        }

        .camera-selector-item.selected {
          background-color: #e3f2fd;
          border-color: #2196f3;
        }

        .camera-selector-item.disabled {
          background-color: #f5f5f5;
          border-color: #e0e0e0;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .camera-selector-item.disabled:hover {
          background-color: #f5f5f5;
          border-color: #e0e0e0;
        }

        .camera-selector-checkbox {
          margin-right: 12px;
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .camera-selector-item-label {
          font-weight: 500;
          color: #333;
          margin-bottom: 2px;
        }

        .camera-selector-item-id {
          font-size: 12px;
          color: #666;
          font-family: monospace;
        }

        .camera-selector-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding-top: 15px;
          border-top: 1px solid #e0e0e0;
        }

        .camera-selector-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .camera-selector-btn.cancel {
          background-color: #6c757d;
          color: white;
        }

        .camera-selector-btn.cancel:hover {
          background-color: #5a6268;
        }

        .camera-selector-btn.apply {
          background-color: #007bff;
          color: white;
        }

        .camera-selector-btn.apply:hover {
          background-color: #0056b3;
        }

        .camera-selector-btn.apply:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
};

export default CameraSelect;
