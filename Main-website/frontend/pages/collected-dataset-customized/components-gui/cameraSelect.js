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
  // Load selected cameras from localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedCameras = localStorage.getItem('selectedCameras');
        const storedCameraData = localStorage.getItem('selectedCamerasData');
        
        if (storedCameras) {
          const parsedCameras = JSON.parse(storedCameras);
          if (Array.isArray(parsedCameras) && parsedCameras.length > 0) {
            // Remove any duplicates that might have been saved
            const uniqueCameras = [...new Set(parsedCameras)];
            setSelectedCameras(uniqueCameras);
            
            // Load camera data if available
            if (storedCameraData) {
              try {
                const parsedCameraData = JSON.parse(storedCameraData);
              } catch (dataError) {
                console.warn('Error parsing camera data:', dataError);
              }
            }
            
            setProcessStatus(`Loaded ${uniqueCameras.length} previously selected camera(s) from storage`);
          }
        }
      } catch (error) {
        console.warn('Error loading selected cameras from localStorage:', error);
      }
    }
  }, [setSelectedCameras, setProcessStatus]);

  const handleCameraSelection = useCallback((cameraId, isSelected) => {
    setSelectedCameras(prev => {
      
      let newSelectedCameras;
      if (isSelected) {
        if (!prev.includes(cameraId) && prev.length < 2) {
          newSelectedCameras = [...prev, cameraId];
        } else {
          return prev;
        }
      } else {
        newSelectedCameras = prev.filter(id => id !== cameraId);
      }
      
      // Create camera data with tags for localStorage
      const cameraData = newSelectedCameras.map((id, index) => ({
        id: id,
        tag: index === 0 ? 'main' : 'submain',
        order: index + 1
      }));
      
      // Save to localStorage with camera data
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('selectedCameras', JSON.stringify(newSelectedCameras));
          localStorage.setItem('selectedCamerasData', JSON.stringify(cameraData));
        } catch (error) {
          console.warn('Error saving selected cameras to localStorage:', error);
        }
      }
      
      return newSelectedCameras;
    });
  }, [setSelectedCameras]);

  const closeCameraSelector = useCallback(() => {
    setShowCameraSelector(false);
  }, [setShowCameraSelector]);

  const handleApplySelection = useCallback(() => {
    if (selectedCameras.length > 0) {
      // Ensure selectedCameras is an array before mapping and remove duplicates
      const camerasArray = Array.isArray(selectedCameras) ? [...new Set(selectedCameras)] : [];
      
      // Create camera data with tags
      const cameraData = camerasArray.map((id, index) => ({
        id: id,
        tag: index === 0 ? 'main' : 'submain',
        order: index + 1
      }));
      
      const selectedCameraNames = camerasArray.map((id, index) => {
        const camera = availableCameras.find(cam => cam.id === id);
        const tag = index === 0 ? 'main' : 'submain';
        return camera ? `${camera.label} (${tag})` : `Unknown (${tag})`;
      });
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('selectedCameras', JSON.stringify(camerasArray));
          localStorage.setItem('selectedCamerasData', JSON.stringify(cameraData));
          localStorage.setItem('selectedCamerasTimestamp', Date.now().toString());
        } catch (error) {
          console.warn('Error saving selected cameras to localStorage:', error);
        }
      }
      
      setProcessStatus(`Selected ${camerasArray.length} camera(s): ${selectedCameraNames.join(', ')}`);
      closeCameraSelector();
    } else {
      setProcessStatus('Please select at least one camera');
    }
  }, [selectedCameras, availableCameras, setProcessStatus, closeCameraSelector]);

  const handleClearSelection = useCallback(() => {
    setSelectedCameras([]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('selectedCameras');
        localStorage.removeItem('selectedCamerasData');
        localStorage.removeItem('selectedCamerasTimestamp');
      } catch (error) {
        console.warn('Error clearing selected cameras from localStorage:', error);
      }
    }
    setProcessStatus('Camera selection cleared');
  }, [setSelectedCameras, setProcessStatus]);

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
          </div>

          {/* Available Cameras */}
          <div className="camera-selector-section">
            <h3 className="camera-selector-section-title">
              Available Cameras ({availableCameras.length})
            </h3>
            <div className="camera-selector-info">
              <p>Select up to 2 cameras for dual preview</p>
              <p>Selected: {selectedCameras.length}/2</p>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input 
                    type="checkbox" 
                    id="disableAutoSelect"
                    onChange={(e) => {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('disableCameraAutoSelect', e.target.checked.toString());
                      }
                    }}
                    defaultChecked={typeof window !== 'undefined' && localStorage.getItem('disableCameraAutoSelect') === 'true'}
                  />
                  Disable auto-selection on page load
                </label>
              </div>
              {process.env.NODE_ENV === 'development' && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  <div>Debug cameras: {JSON.stringify(selectedCameras)}</div>
                  <div>Debug data: {JSON.stringify(selectedCameras.map((id, index) => ({
                    id: id,
                    tag: index === 0 ? 'main' : 'submain',
                    order: index + 1
                  })))}</div>
                </div>
              )}
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
                  const selectedIndex = selectedCameras.indexOf(camera.id);
                  const cameraTag = selectedIndex >= 0 ? (selectedIndex === 0 ? 'main' : 'submain') : null;
                  
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
                          {cameraTag && (
                            <span className={`camera-tag ${cameraTag}`}>
                              {cameraTag.toUpperCase()}
                            </span>
                          )}
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
              onClick={handleClearSelection}
              className="camera-selector-btn clear"
            >
              Clear All
            </button>
            <button
              onClick={handleApplySelection}
              className="camera-selector-btn apply"
              disabled={selectedCameras.length === 0}
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

        .camera-tag {
          display: inline-block;
          margin-left: 8px;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .camera-tag.main {
          background-color: #28a745;
          color: white;
        }

        .camera-tag.submain {
          background-color: #ffc107;
          color: #212529;
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
          opacity: 0.6;
        }

        .camera-selector-btn.clear {
          background-color: #dc3545;
          color: white;
        }

        .camera-selector-btn.clear:hover {
          background-color: #c82333;
        }
      `}</style>
    </>
  );
};

export default CameraSelect;
