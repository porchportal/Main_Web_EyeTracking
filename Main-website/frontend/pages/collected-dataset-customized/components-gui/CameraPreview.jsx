import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import cameraStyles from '../styles/camera-ui.module.css';

// Dynamically import the camera component with SSR disabled
const DynamicCameraAccess = dynamic(
  () => import('./cameraAccess'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '480px',
        height: '360px',
        background: '#f0f8ff',
        border: '2px solid #0066cc',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        zIndex: 25
      }}>
        <div style={{ fontSize: '48px', marginBottom: '15px' }}>📷</div>
        <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#0066cc' }}>
          Loading camera...
        </p>
      </div>
    )
  }
);

/**
 * CameraPreview Component
 *
 * Handles displaying camera preview(s) with support for single or dual cameras
 *
 * @param {boolean} isHydrated - Whether the component is hydrated on client
 * @param {boolean} showCamera - Whether to show the camera preview
 * @param {boolean} isCameraActive - Whether the camera is active (can be hidden but active)
 * @param {Array} selectedCameras - Array of selected camera IDs
 * @param {Function} handleCameraClose - Callback when camera is closed
 * @param {Function} handleCameraReady - Callback when camera is ready
 * @param {Object} videoRef - Reference to video element (optional)
 */
const CameraPreview = ({
  isHydrated = false,
  showCamera = false,
  isCameraActive = false,
  selectedCameras = [],
  handleCameraClose,
  handleCameraReady,
  videoRef = null
}) => {
  const [showCameraInfo, setShowCameraInfo] = useState(false);
  const [cameraInfoData, setCameraInfoData] = useState({});

  // Close Camera Info when camera preview is closed
  useEffect(() => {
    if (!showCamera && !isCameraActive) {
      setShowCameraInfo(false);
      setCameraInfoData({});
    }
  }, [showCamera, isCameraActive]);

  // Don't render if not hydrated or conditions not met
  if (!isHydrated || typeof window === 'undefined' || (!showCamera && !isCameraActive)) {
    return null;
  }

  // Handle camera info updates from child cameras
  const handleCameraInfoUpdate = (cameraIndex, info) => {
    setCameraInfoData(prev => ({
      ...prev,
      [cameraIndex]: info
    }));
  };

  // Handle config button click from child cameras
  const handleConfigToggle = (isOpen) => {
    setShowCameraInfo(isOpen);
  };

  // Determine if we have multiple cameras
  const hasMultipleCameras = Array.isArray(selectedCameras) && selectedCameras.length > 1;
  const hasCameras = Array.isArray(selectedCameras) && selectedCameras.length > 0;

  return (
    <>
      <div
        className={`${cameraStyles.cameraPreviewContainer} ${hasMultipleCameras ? cameraStyles.dualCamera : cameraStyles.singleCamera}`}
      >
        {hasCameras ? (
          // Show selected cameras
          selectedCameras.map((cameraId, index) => (
            <DynamicCameraAccess
              key={`camera-${cameraId}-${index}-${showCamera}-${isCameraActive}`}
              isShowing={showCamera}
              isHidden={!showCamera && isCameraActive}
              onClose={handleCameraClose}
              onCameraReady={handleCameraReady}
              selectedCameras={selectedCameras}
              cameraIndex={index}
              videoRef={videoRef}
              onCameraInfoUpdate={(info) => handleCameraInfoUpdate(index, info)}
              onConfigToggle={handleConfigToggle}
              showCameraInfo={showCameraInfo}
            />
          ))
        ) : (
          // Fallback to single camera if none selected
          <DynamicCameraAccess
            key={`camera-default-${showCamera}-${isCameraActive}`}
            isShowing={showCamera}
            isHidden={!showCamera && isCameraActive}
            onClose={handleCameraClose}
            onCameraReady={handleCameraReady}
            selectedCameras={[]}
            cameraIndex={0}
            videoRef={videoRef}
            onCameraInfoUpdate={(info) => handleCameraInfoUpdate(0, info)}
            onConfigToggle={handleConfigToggle}
            showCameraInfo={showCameraInfo}
          />
        )}
      </div>

      {/* Camera Info Sidebar - Controlled by CameraPreview */}
      {showCameraInfo && Object.keys(cameraInfoData).length > 0 && (
        <div className={cameraStyles.cameraInfoSidebar}>
          <div className={cameraStyles.cameraInfoHeader}>
            <h3>Camera Info</h3>
            <button
              onClick={() => setShowCameraInfo(false)}
              className={cameraStyles.cameraInfoClose}
            >
              ×
            </button>
          </div>

          <div className={cameraStyles.cameraInfoContent}>
            {Object.entries(cameraInfoData).map(([cameraIndex, info]) => (
              <div key={cameraIndex}>
                {Object.keys(cameraInfoData).length > 1 && (
                  <div className={cameraStyles.cameraInfoDivider}>
                    Camera {parseInt(cameraIndex) + 1}
                  </div>
                )}

                <div className={cameraStyles.cameraInfoSection}>
                  <div className={cameraStyles.cameraInfoLabel}>Camera</div>
                  <div className={cameraStyles.cameraInfoValue}>Camera {parseInt(cameraIndex) + 1}</div>
                </div>

                <div className={cameraStyles.cameraInfoSection}>
                  <div className={cameraStyles.cameraInfoLabel}>Resolution</div>
                  <div className={cameraStyles.cameraInfoValue}>
                    {info.resolution || 'N/A'}
                  </div>
                </div>

                <div className={cameraStyles.cameraInfoSection}>
                  <div className={cameraStyles.cameraInfoLabel}>FPS</div>
                  <div className={cameraStyles.cameraInfoValue}>{info.fps || 0} fps</div>
                </div>

                <div className={cameraStyles.cameraInfoSection}>
                  <div className={cameraStyles.cameraInfoLabel}>Status</div>
                  <div className={`${cameraStyles.cameraInfoValue} ${cameraStyles.cameraInfoStatus}`}>
                    <span className={`${cameraStyles.statusIndicator} ${info.isVideoReady ? cameraStyles.statusActive : cameraStyles.statusInactive}`}></span>
                    {info.status || 'Unknown'}
                  </div>
                </div>

                <div className={cameraStyles.cameraInfoSection}>
                  <div className={cameraStyles.cameraInfoLabel}>Stream</div>
                  <div className={cameraStyles.cameraInfoValue}>
                    {info.streamTracks || 'No stream'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default CameraPreview;
