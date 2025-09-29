import { useState, useEffect } from 'react';
import styles from './showPreview.module.css';

export default function ShowPreview({ result, enhanceFace, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const [showPositions, setShowPositions] = useState(false);
  const [imageScale, setImageScale] = useState({ scaleX: 1, scaleY: 1 });
  
  // Debug logging
  console.log('🔧 DEBUG - ShowPreview received data:');
  console.log('   ✨ enhanceFace:', enhanceFace);
  console.log('   📊 result:', result);
  console.log('   🎯 face_detected:', result?.face_detected);
  console.log('   📏 image dimensions:', result?.image?.width, 'x', result?.image?.height);
  console.log('   📐 original dimensions:', result?.image?.original_width, 'x', result?.image?.original_height);
  console.log('   🖼️ image data length:', result?.image?.data?.length);
  console.log('   📦 metrics available:', Object.keys(result?.metrics || {}));
  console.log('   🎯 face_box:', result?.metrics?.face_box);
  console.log('   👁️ left_eye_box:', result?.metrics?.left_eye_box);
  console.log('   👁️ right_eye_box:', result?.metrics?.right_eye_box);

  useEffect(() => {
    // Trigger animation when component mounts
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleImageLoad = (e) => {
    console.log('✅ Image loaded successfully');
    
    // Calculate scale ratio between original image and displayed image
    const img = e.target;
    const originalWidth = result.image.width;
    const originalHeight = result.image.height;
    const displayedWidth = img.clientWidth;
    const displayedHeight = img.clientHeight;
    
    const scaleX = displayedWidth / originalWidth;
    const scaleY = displayedHeight / originalHeight;
    
    console.log('📏 DEBUG - Image scale calculation:');
    console.log('   📐 Original dimensions:', originalWidth, 'x', originalHeight);
    console.log('   🖼️ Displayed dimensions:', displayedWidth, 'x', displayedHeight);
    console.log('   📊 Scale ratios:', { scaleX, scaleY });
    
    setImageScale({ scaleX, scaleY });
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!result || !result.success) {
    return null;
  }

  return (
    <div 
      className={`${styles.overlay} ${isVisible ? styles.visible : ''}`}
      onClick={handleBackdropClick}
    >
      <div className={`${styles.modal} ${isVisible ? styles.modalVisible : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>AI Face Analysis Results</h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close preview"
          >
            <svg className={styles.closeIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Face Detection Status */}
          <div className={styles.statusCard}>
            <div className={styles.statusHeader}>
              <div className={`${styles.statusIndicator} ${result.face_detected ? styles.detected : styles.notDetected}`}></div>
              <span className={styles.statusText}>
                {result.face_detected ? 'Face Detected' : 'No Face Detected'}
              </span>
              <div className={styles.enhanceStatus}>
                Enhanced: {enhanceFace ? 'Yes' : 'No'}
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className={styles.metricsGrid}>
            {/* Head Pose Angles */}
            {result.metrics.head_pose && (
              <div className={styles.metricCard}>
                <h3 className={styles.metricTitle}>Head Pose Angles</h3>
                <div className={styles.angleGrid}>
                  <div className={styles.angleItem}>
                    <div className={styles.angleValue}>{result.metrics.head_pose.pitch}°</div>
                    <div className={styles.angleLabel}>Pitch</div>
                  </div>
                  <div className={styles.angleItem}>
                    <div className={styles.angleValue}>{result.metrics.head_pose.yaw}°</div>
                    <div className={styles.angleLabel}>Yaw</div>
                  </div>
                  <div className={styles.angleItem}>
                    <div className={styles.angleValue}>{result.metrics.head_pose.roll}°</div>
                    <div className={styles.angleLabel}>Roll</div>
                  </div>
                </div>
              </div>
            )}

            {/* Posture and Gaze */}
            {(result.metrics.posture || result.metrics.gaze_direction || result.image) && (
              <div className={styles.metricCard}>
                <h3 className={styles.metricTitle}>Analysis</h3>
                <div className={styles.analysisGrid}>
                  {result.metrics.posture && (
                    <div className={styles.analysisItem}>
                      <div className={styles.analysisLabel}>Posture</div>
                      <div className={styles.analysisValue}>{result.metrics.posture}</div>
                    </div>
                  )}
                  {result.metrics.gaze_direction && (
                    <div className={styles.analysisItem}>
                      <div className={styles.analysisLabel}>Gaze Direction</div>
                      <div className={styles.analysisValue}>{result.metrics.gaze_direction}</div>
                    </div>
                  )}
                  {result.image && (
                    <div className={styles.analysisItem}>
                      <div className={styles.analysisLabel}>Image Dimensions</div>
                      <div className={styles.analysisValue}>
                        {enhanceFace ? (
                          <div className={styles.dimensionContainer}>
                            <div className={styles.dimensionRow}>
                              <span className={styles.dimensionLabel}>Before:</span>
                              <span className={styles.dimensionValue}>
                                {result.image.original_width || result.image.width} × {result.image.original_height || result.image.height}
                              </span>
                            </div>
                            <div className={styles.dimensionRow}>
                              <span className={styles.dimensionLabel}>After:</span>
                              <span className={styles.dimensionValue}>
                                {result.image.width} × {result.image.height}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className={styles.dimensionValue}>
                            {result.image.width} × {result.image.height}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Eye States */}
            {(result.metrics.left_eye_state || result.metrics.right_eye_state) && (
              <div className={styles.metricCard}>
                <h3 className={styles.metricTitle}>Eye States</h3>
                <div className={styles.eyeGrid}>
                  {result.metrics.left_eye_state && (
                    <div className={styles.eyeItem}>
                      <div className={styles.eyeLabel}>Left Eye</div>
                      <div className={styles.eyeValue}>{result.metrics.left_eye_state}</div>
                      {result.metrics.left_eye_ear && (
                        <div className={styles.eyeEar}>EAR: {result.metrics.left_eye_ear}</div>
                      )}
                    </div>
                  )}
                  {result.metrics.right_eye_state && (
                    <div className={styles.eyeItem}>
                      <div className={styles.eyeLabel}>Right Eye</div>
                      <div className={styles.eyeValue}>{result.metrics.right_eye_state}</div>
                      {result.metrics.right_eye_ear && (
                        <div className={styles.eyeEar}>EAR: {result.metrics.right_eye_ear}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Distance Information */}
            {(result.metrics.distance_cm_from_face || result.metrics.distance_cm_from_eye) && (
              <div className={styles.metricCard}>
                <h3 className={styles.metricTitle}>Distance Information</h3>
                <div className={styles.distanceGrid}>
                  {result.metrics.distance_cm_from_face && (
                    <div className={styles.distanceItem}>
                      <div className={styles.distanceLabel}>Face Distance</div>
                      <div className={styles.distanceValue}>{result.metrics.distance_cm_from_face} cm</div>
                    </div>
                  )}
                  {result.metrics.distance_cm_from_eye && (
                    <div className={styles.distanceItem}>
                      <div className={styles.distanceLabel}>Eye Distance</div>
                      <div className={styles.distanceValue}>{result.metrics.distance_cm_from_eye} cm</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Processed Image */}
          {result.image && result.image.data && (
            <div className={styles.imageSection}>
              <div className={styles.imageHeader}>
                <h3 className={styles.imageTitle}>Processed Image</h3>
                <div className={styles.imageControls}>
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={showPositions}
                      onChange={(e) => setShowPositions(e.target.checked)}
                      className={styles.toggleInput}
                    />
                    <span className={styles.toggleSlider}></span>
                    <span className={styles.toggleText}>Show Positions</span>
                  </label>
                </div>
              </div>
              <div className={styles.imageContainer}>
                <div className={styles.imageWrapper}>
                  {result.image && result.image.data ? (
                    <img 
                      src={`data:image/jpeg;base64,${result.image.data}`} 
                      alt="Processed face image with AI annotations" 
                      className={styles.processedImage}
                      onLoad={handleImageLoad}
                      onError={(e) => console.error('❌ Image failed to load:', e)}
                    />
                  ) : (
                    <div className={styles.imageError}>
                      <p>❌ No processed image data available</p>
                      <p>Image data: {result.image ? 'Present' : 'Missing'}</p>
                      <p>Data length: {result.image?.data?.length || 0}</p>
                    </div>
                  )}
                  {showPositions && result.metrics && (
                    <div className={styles.positionOverlay}>
                      {console.log('🎯 DEBUG - Rendering position overlays:', {
                        showPositions,
                        hasMetrics: !!result.metrics,
                        imageScale,
                        faceBox: result.metrics.face_box,
                        leftEyeBox: result.metrics.left_eye_box,
                        rightEyeBox: result.metrics.right_eye_box,
                        scaledFaceBox: result.metrics.face_box ? {
                          left: result.metrics.face_box.min[0] * imageScale.scaleX,
                          top: result.metrics.face_box.min[1] * imageScale.scaleY,
                          width: (result.metrics.face_box.max[0] - result.metrics.face_box.min[0]) * imageScale.scaleX,
                          height: (result.metrics.face_box.max[1] - result.metrics.face_box.min[1]) * imageScale.scaleY
                        } : null
                      })}
                      {/* Face Box */}
                      {result.metrics.face_box && (
                        <div 
                          className={styles.positionBox}
                          style={{
                            left: `${result.metrics.face_box.min[0] * imageScale.scaleX}px`,
                            top: `${result.metrics.face_box.min[1] * imageScale.scaleY}px`,
                            width: `${(result.metrics.face_box.max[0] - result.metrics.face_box.min[0]) * imageScale.scaleX}px`,
                            height: `${(result.metrics.face_box.max[1] - result.metrics.face_box.min[1]) * imageScale.scaleY}px`,
                          }}
                        >
                          <span className={styles.positionLabel}>Face</span>
                        </div>
                      )}
                      
                      {/* Left Eye Box */}
                      {result.metrics.left_eye_box && (
                        <div 
                          className={styles.positionBox}
                          style={{
                            left: `${result.metrics.left_eye_box.min[0] * imageScale.scaleX}px`,
                            top: `${result.metrics.left_eye_box.min[1] * imageScale.scaleY}px`,
                            width: `${(result.metrics.left_eye_box.max[0] - result.metrics.left_eye_box.min[0]) * imageScale.scaleX}px`,
                            height: `${(result.metrics.left_eye_box.max[1] - result.metrics.left_eye_box.min[1]) * imageScale.scaleY}px`,
                          }}
                        >
                          <span className={styles.positionLabel}>L Eye</span>
                        </div>
                      )}
                      
                      {/* Right Eye Box */}
                      {result.metrics.right_eye_box && (
                        <div 
                          className={styles.positionBox}
                          style={{
                            left: `${result.metrics.right_eye_box.min[0] * imageScale.scaleX}px`,
                            top: `${result.metrics.right_eye_box.min[1] * imageScale.scaleY}px`,
                            width: `${(result.metrics.right_eye_box.max[0] - result.metrics.right_eye_box.min[0]) * imageScale.scaleX}px`,
                            height: `${(result.metrics.right_eye_box.max[1] - result.metrics.right_eye_box.min[1]) * imageScale.scaleY}px`,
                          }}
                        >
                          <span className={styles.positionLabel}>R Eye</span>
                        </div>
                      )}
                      
                      {/* Eye Centers */}
                      {result.metrics.left_eye_position_x && result.metrics.left_eye_position_y && (
                        <div 
                          className={styles.positionPoint}
                          style={{
                            left: `${result.metrics.left_eye_position_x * imageScale.scaleX}px`,
                            top: `${result.metrics.left_eye_position_y * imageScale.scaleY}px`,
                          }}
                        >
                          <span className={styles.positionLabel}>L Center</span>
                        </div>
                      )}
                      
                      {result.metrics.right_eye_position_x && result.metrics.right_eye_position_y && (
                        <div 
                          className={styles.positionPoint}
                          style={{
                            left: `${result.metrics.right_eye_position_x * imageScale.scaleX}px`,
                            top: `${result.metrics.right_eye_position_y * imageScale.scaleY}px`,
                          }}
                        >
                          <span className={styles.positionLabel}>R Center</span>
                        </div>
                      )}
                      
                      {/* Nose Position */}
                      {result.metrics.nose_position_x && result.metrics.nose_position_y && (
                        <div 
                          className={styles.positionPoint}
                          style={{
                            left: `${result.metrics.nose_position_x * imageScale.scaleX}px`,
                            top: `${result.metrics.nose_position_y * imageScale.scaleY}px`,
                          }}
                        >
                          <span className={styles.positionLabel}>Nose</span>
                        </div>
                      )}
                      
                      {/* Chin Position */}
                      {result.metrics.chin_position_x && result.metrics.chin_position_y && (
                        <div 
                          className={styles.positionPoint}
                          style={{
                            left: `${result.metrics.chin_position_x * imageScale.scaleX}px`,
                            top: `${result.metrics.chin_position_y * imageScale.scaleY}px`,
                          }}
                        >
                          <span className={styles.positionLabel}>Chin</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button 
            className={styles.closeModalButton}
            onClick={onClose}
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
