import React, { useState, useEffect } from 'react';
import styles from '../styles/Order&require.module.css';
import { 
  parseImagePaths, 
  getImageUrl, 
  getCheckMarkStatus, 
  getProgressStatus,
  CheckMarkRenderer,
  ProgressRenderer,
  saveProgressToStorage,
  loadProgressFromStorage,
  clearProgressFromStorage,
  isProgressDataStale,
  clearAllStateDataWithCompletion
} from './count&mark.js';

const OrderRequire = ({
  isHydrated,
  showOrderRequire,
  orderRequireMessage,
  orderRequireList = [],
  isManualShow = false, // New prop to indicate if this is a manual show (user clicked button)
  clickedButtons = new Set(), // Track which buttons have been clicked
  imageBackgroundPaths = [], // Array of image paths from MongoDB
  currentUserId = null, // Current user ID for settings access
  buttonClickCount = 0, // Total button clicks from CanvasImage
  currentImageTimes = 1, // Times for current image from CanvasImage
  currentImageIndex = 0, // Current image index
  totalImages = 1, // Total number of images
  currentImagePath = null // Current image path
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [animationState, setAnimationState] = useState('hidden');
  const [parsedImages, setParsedImages] = useState([]);
  const [expandedPath, setExpandedPath] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);


  // Function to handle path name click
  const handlePathClick = (imagePath, index) => {
    if (expandedPath === index) {
      // If already expanded, collapse it
      setExpandedPath(null);
      setIsExpanded(false);
    } else {
      // Expand the clicked path
      setExpandedPath(index);
      setIsExpanded(true);
    }
  };

  // Function to close expanded path
  const closeExpandedPath = () => {
    setExpandedPath(null);
    setIsExpanded(false);
  };

  // Function to clear all state data (can be called from parent component)
  const clearAllState = () => {
    const result = clearAllStateDataWithCompletion(currentUserId);
    return result;
  };

  // Expose clearAllState function to parent component via useEffect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.clearOrderRequireState = clearAllState;
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.clearOrderRequireState;
      }
    };
  }, [currentUserId]);

  // Update parsed images when imageBackgroundPaths change
  useEffect(() => {
    const parsed = parseImagePaths(imageBackgroundPaths);
    setParsedImages(parsed);
  }, [imageBackgroundPaths]);

  // Load progress from localStorage when component mounts or userId changes
  useEffect(() => {
    if (currentUserId && isHydrated) {
      const progressData = loadProgressFromStorage(currentUserId);
      
      // Check if data is stale (older than 24 hours)
      if (isProgressDataStale(progressData, 24)) {
        return;
      }
      
      // Update progress if we have valid data
      if (progressData.buttonClickCount > 0 || progressData.parsedImages.length > 0) {
        // Note: The actual progress values are managed by CanvasImage manager
        // This is just for logging and potential UI updates
      }
    }
  }, [currentUserId, isHydrated]);

  useEffect(() => {
    if (showOrderRequire) {
      setIsVisible(true);
      setAnimationState('visible');
      
      // Only auto-hide if this is NOT a manual show (user clicked button)
      // If it's a manual show, let the user control when to hide it
      if (!isManualShow) {
        // Auto-hide after 8 seconds only for automatic shows
        const timer = setTimeout(() => {
          setAnimationState('hidden');
          setTimeout(() => setIsVisible(false), 300); // Wait for animation to complete
        }, 8000);
        return () => clearTimeout(timer);
      }
    } else {
      setAnimationState('hidden');
      setTimeout(() => setIsVisible(false), 300); // Wait for animation to complete
    }
  }, [showOrderRequire, isManualShow]);

  // Check if Canvas Metrics is visible to adjust positioning
  const isCanvasMetricsVisible = () => {
    if (typeof window !== 'undefined') {
      const metricsDisplay = document.querySelector('.metrics-display');
      if (!metricsDisplay) return false;
      
      // Check if element is visible by checking computed styles
      const computedStyle = window.getComputedStyle(metricsDisplay);
      const isDisplayed = computedStyle.display !== 'none';
      const isOpaque = parseFloat(computedStyle.opacity) > 0;
      const isVisible = computedStyle.visibility !== 'hidden';
      
      return isDisplayed && isOpaque && isVisible;
    }
    return false;
  };

  const [canvasMetricsVisible, setCanvasMetricsVisible] = useState(false);

  useEffect(() => {
    const checkMetricsVisibility = () => {
      const isVisible = isCanvasMetricsVisible();
      setCanvasMetricsVisible(prev => {
        // Only update state if the value actually changed to prevent unnecessary re-renders
        if (prev !== isVisible) {
          return isVisible;
        }
        return prev;
      });
    };

    // Initial check
    checkMetricsVisibility();

    // Use MutationObserver to watch for changes in the metrics display
    let observer;
    if (typeof window !== 'undefined') {
      const metricsDisplay = document.querySelector('.metrics-display');
      if (metricsDisplay) {
        observer = new MutationObserver(() => {
          checkMetricsVisibility();
        });
        
        observer.observe(metricsDisplay, {
          attributes: true,
          attributeFilter: ['style', 'class']
        });
      }
    }

    // Fallback interval for cases where MutationObserver doesn't catch changes
    const interval = setInterval(checkMetricsVisibility, 1000);
    
    return () => {
      if (observer) {
        observer.disconnect();
      }
      clearInterval(interval);
    };
  }, []);

  if (!isHydrated || !isVisible) {
    return null;
  }


  return (
    <>
      {/* Button Sequence notification - positioned on top right */}
      <div 
        className={`${styles.orderRequireBanner} ${styles[animationState]} ${canvasMetricsVisible ? styles.withCanvasMetrics : styles.withoutCanvasMetrics}`}
      >
        <div className={styles.notificationHeader}>
          <span className={styles.headerTitle}>
            🔄 Button Sequence
            {isManualShow && (
              <span className={styles.manualIndicator}>
                (Manual)
              </span>
            )}
            {clickedButtons.size > 0 && (
              <span className={styles.savedIndicator}>
                💾 Saved
              </span>
            )}
          </span>
          <div className={styles.notificationIndicator} />
        </div>
        
        <div className={styles.notificationContent}>
          {/* Requirements list only */}
          {orderRequireList && orderRequireList.length > 0 && (
            <div>
              <ul className={styles.requirementsList}>
                {orderRequireList.map((item, index) => {
                  const { isClicked, className: markClassName } = getCheckMarkStatus(item, clickedButtons, index);
                  return (
                    <li key={index} className={`${styles.requirementItem} ${isClicked ? styles.clicked : ''}`}>
                      <CheckMarkRenderer
                        item={item}
                        index={index}
                        clickedButtons={clickedButtons}
                        className={`${styles.requirementNumber} ${markClassName ? styles.clicked : ''}`}
                      />
                      {item}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Image display section */}
          {parsedImages.length > 0 && (
            <div className={styles.imageDisplaySection}>
              <div className={styles.imageSectionTitle}>
                <span>📸 Background Images ({parsedImages.length})</span>
                {totalImages > 1 && (
                  <span className={styles.currentImageInfo}>
                    Current: {currentImageIndex + 1}/{totalImages}
                    {currentImagePath && (
                      <span className={styles.currentImageName}>
                        - {currentImagePath.split('/').pop()}
                      </span>
                    )}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    alert('Test button works!');
                  }}
                  style={{
                    background: 'rgba(0, 255, 0, 0.2)',
                    border: '1px solid #00ff00',
                    color: '#00ff00',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    marginLeft: '10px'
                  }}
                >
                  TEST
                </button>
              </div>
              <div className={styles.imageListContainer}>
                {parsedImages.map((image, index) => (
                  <div
                    key={index}
                    className={`${styles.imageRow} ${expandedPath === index ? styles.expanded : ''} ${index === currentImageIndex ? styles.currentImage : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePathClick(image.path, index);
                    }}
                  >
                    {/* Image thumbnail */}
                    <div className={styles.imageThumbnail}>
                      <img
                        src={getImageUrl(image.path)}
                        alt={`Background ${index + 1}`}
                        onError={(e) => {
                          // Show placeholder if image fails to load
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                        onLoad={(e) => {
                          // Hide placeholder when image loads successfully
                          e.target.nextSibling.style.display = 'none';
                        }}
                      />
                      <div className={styles.imagePlaceholder}>
                        📷
                      </div>
                    </div>
                    
                    {/* Image info */}
                    <div className={styles.imageInfo}>
                      {/* Path name */}
                      <div className={styles.pathName} title={`Click to ${expandedPath === index ? 'collapse' : 'expand'} full path`}>
                        <span className={styles.pathNameText}>
                          {image.path.split('/').pop() || image.path}
                        </span>
                        {expandedPath === index && (
                          <span className={styles.expandIcon}>
                            ▼
                          </span>
                        )}
                        {expandedPath !== index && (
                          <span className={styles.collapseIcon}>
                            ▶
                          </span>
                        )}
                      </div>
                      
                      {/* Times number with progress */}
                      <div className={styles.timesNumber}>
                        <ProgressRenderer
                          buttonClickCount={buttonClickCount}
                          imageTimes={image.times}
                          isFirstImage={index === 0}
                          className={styles.timesBadge}
                          progressClassName={styles.progressIndicator}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Expanded path display */}
              {isExpanded && expandedPath !== null && (
                <div className={styles.expandedPathContainer}>
                  <div className={styles.expandedPathHeader}>
                    <span className={styles.expandedPathTitle}>
                      Full Path:
                    </span>
                    <button
                      onClick={closeExpandedPath}
                      className={styles.closeButton}
                      title="Close expanded path"
                    >
                      ×
                    </button>
                  </div>
                  <div className={styles.expandedPathContent}>
                    {parsedImages[expandedPath]?.path || ''}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Default message if no requirements */}
          {(!orderRequireList || orderRequireList.length === 0) && (
            <div className={styles.defaultMessage}>
              <p className={styles.defaultMessageText}>
                🔄 No button sequence configured.
              </p>
            </div>
          )}
        </div>

        {/* Close button */}
        <div 
          className={styles.closeButtonContainer}
          onClick={() => {
            setAnimationState('hidden');
            setTimeout(() => setIsVisible(false), 300);
          }}
        >
          ×
        </div>
      </div>

    </>
  );
};

export default OrderRequire;