// count&mark.js - Utility functions for check mark logic and localStorage management

// ============================================================================
// CHECK MARK LOGIC
// ============================================================================

/**
 * Get check mark status for a requirement item
 * @param {string} item - The requirement item text
 * @param {Set} clickedButtons - Set of clicked button names
 * @param {number} index - Index of the item in the list
 * @returns {Object} - { isClicked: boolean, className: string }
 */
export const getCheckMarkStatus = (item, clickedButtons, index) => {
  const isClicked = clickedButtons.has(item);
  return {
    isClicked,
    className: isClicked ? 'clicked' : ''
  };
};

/**
 * CheckMarkRenderer component for rendering check marks
 * @param {Object} props - Component props
 * @param {string} props.item - The requirement item text
 * @param {number} props.index - Index of the item in the list
 * @param {Set} props.clickedButtons - Set of clicked button names
 * @param {string} props.className - CSS class name for styling
 * @returns {JSX.Element} - Check mark element
 */
export const CheckMarkRenderer = ({ item, index, clickedButtons, className }) => {
  const { isClicked } = getCheckMarkStatus(item, clickedButtons, index);
  
  return (
    <span className={className}>
      {isClicked ? '✓' : index + 1}
    </span>
  );
};

// ============================================================================
// PROGRESS LOGIC
// ============================================================================

/**
 * Get progress status for image times
 * @param {number} buttonClickCount - Current number of button clicks
 * @param {number} imageTimes - Total times required for the image
 * @param {boolean} isFirstImage - Whether this is the first image
 * @returns {Object} - { progress: string, isComplete: boolean, percentage: number }
 */
export const getProgressStatus = (buttonClickCount, imageTimes, isFirstImage) => {
  if (!isFirstImage) {
    return {
      progress: `Times: ${imageTimes}`,
      isComplete: false,
      percentage: 0
    };
  }

  const isComplete = buttonClickCount >= imageTimes;
  const percentage = imageTimes > 0 ? Math.round((buttonClickCount / imageTimes) * 100) : 0;
  
  return {
    progress: `Times: ${buttonClickCount}/${imageTimes}`,
    isComplete,
    percentage
  };
};

/**
 * ProgressRenderer component for rendering progress information
 * @param {Object} props - Component props
 * @param {number} props.buttonClickCount - Current number of button clicks
 * @param {number} props.imageTimes - Total times required for the image
 * @param {boolean} props.isFirstImage - Whether this is the first image
 * @param {string} props.className - CSS class name for the times badge
 * @param {string} props.progressClassName - CSS class name for the progress indicator
 * @returns {JSX.Element} - Progress element
 */
export const ProgressRenderer = ({ 
  buttonClickCount, 
  imageTimes, 
  isFirstImage, 
  className, 
  progressClassName 
}) => {
  const { progress, isComplete, percentage } = getProgressStatus(
    buttonClickCount, 
    imageTimes, 
    isFirstImage
  );

  return (
    <>
      <span className={className}>
        {progress}
      </span>
      {isFirstImage && buttonClickCount > 0 && (
        <span className={progressClassName}>
          {isComplete ? '✓ Complete' : `${percentage}%`}
        </span>
      )}
    </>
  );
};

// ============================================================================
// IMAGE PATH PARSING
// ============================================================================

/**
 * Parse image paths from MongoDB format "[times]-path"
 * @param {Array} imagePaths - Array of image path strings
 * @returns {Array} - Array of parsed image objects
 */
export const parseImagePaths = (imagePaths) => {
  if (!imagePaths || !Array.isArray(imagePaths)) return [];
  
  return imagePaths.map((path, index) => {
    if (typeof path === 'string' && path.includes('-')) {
      // Parse format "[times]-path"
      const match = path.match(/^\[(\d+)\]-(.+)$/);
      if (match) {
        return {
          times: parseInt(match[1], 10),
          path: match[2],
          originalPath: path,
          index: index
        };
      }
    }
    // Fallback for simple paths
    return {
      times: 1,
      path: path,
      originalPath: path,
      index: index
    };
  });
};

/**
 * Generate image URL using canvasFront-image API
 * @param {string} imagePath - The image path
 * @returns {string} - The generated URL
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  
  // Extract filename from path
  const filename = imagePath.split('/').pop();
  if (!filename) return imagePath;
  
  // Use canvasFront-image API
  return `/api/canvasFront-image/${filename}`;
};

// ============================================================================
// LOCALSTORAGE MANAGEMENT
// ============================================================================

/**
 * Save clicked buttons to localStorage
 * @param {Set} clickedButtons - Set of clicked button names
 * @param {string} userId - User ID for user-specific storage
 */
export const saveClickedButtonsToStorage = (clickedButtons, userId = null) => {
  if (typeof window === 'undefined') return;
  
  try {
    const storageKey = userId ? `clickedButtons_${userId}` : 'clickedButtons';
    const buttonsArray = Array.from(clickedButtons);
    localStorage.setItem(storageKey, JSON.stringify(buttonsArray));
    console.log('Saved clicked buttons to localStorage:', buttonsArray);
  } catch (error) {
    console.error('Error saving clicked buttons to localStorage:', error);
  }
};

/**
 * Load clicked buttons from localStorage
 * @param {string} userId - User ID for user-specific storage
 * @returns {Set} - Set of clicked button names
 */
export const loadClickedButtonsFromStorage = (userId = null) => {
  if (typeof window === 'undefined') return new Set();
  
  try {
    const storageKey = userId ? `clickedButtons_${userId}` : 'clickedButtons';
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const buttonsArray = JSON.parse(stored);
      console.log('Loaded clicked buttons from localStorage:', buttonsArray);
      return new Set(buttonsArray);
    }
  } catch (error) {
    console.error('Error loading clicked buttons from localStorage:', error);
  }
  
  return new Set();
};

/**
 * Clear clicked buttons from localStorage
 * @param {string} userId - User ID for user-specific storage
 */
export const clearClickedButtonsFromStorage = (userId = null) => {
  if (typeof window === 'undefined') return;
  
  try {
    const storageKey = userId ? `clickedButtons_${userId}` : 'clickedButtons';
    localStorage.removeItem(storageKey);
    console.log('Cleared clicked buttons from localStorage');
  } catch (error) {
    console.error('Error clearing clicked buttons from localStorage:', error);
  }
};

/**
 * Get all stored clicked buttons keys from localStorage
 * @returns {Array} - Array of storage keys
 */
export const getAllClickedButtonsKeys = () => {
  if (typeof window === 'undefined') return [];
  
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('clickedButtons')) {
      keys.push(key);
    }
  }
  return keys;
};

// ============================================================================
// BUTTON TRACKING UTILITIES
// ============================================================================

/**
 * Track a button click and update storage
 * @param {string} buttonName - Name of the clicked button
 * @param {Set} clickedButtons - Current set of clicked buttons
 * @param {Function} setClickedButtons - State setter for clicked buttons
 * @param {string} userId - User ID for user-specific storage
 * @returns {Set} - Updated set of clicked buttons
 */
export const trackButtonClick = (buttonName, clickedButtons, setClickedButtons, userId = null) => {
  const newSet = new Set([...clickedButtons, buttonName]);
  setClickedButtons(newSet);
  saveClickedButtonsToStorage(newSet, userId);
  return newSet;
};

/**
 * Clear all button clicks and update storage
 * @param {Function} setClickedButtons - State setter for clicked buttons
 * @param {string} userId - User ID for user-specific storage
 */
export const clearAllButtonClicks = (setClickedButtons, userId = null) => {
  const newSet = new Set();
  setClickedButtons(newSet);
  clearClickedButtonsFromStorage(userId);
  return newSet;
};

/**
 * Initialize button clicks from storage
 * @param {Function} setClickedButtons - State setter for clicked buttons
 * @param {string} userId - User ID for user-specific storage
 * @returns {Set} - Set of clicked buttons loaded from storage
 */
export const initializeButtonClicks = (setClickedButtons, userId = null) => {
  const loadedButtons = loadClickedButtonsFromStorage(userId);
  setClickedButtons(loadedButtons);
  return loadedButtons;
};

// ============================================================================
// PROGRESS LOCALSTORAGE MANAGEMENT
// ============================================================================

/**
 * Save progress data to localStorage
 * @param {number} buttonClickCount - Current number of button clicks
 * @param {number} currentImageTimes - Times for current image
 * @param {Array} parsedImages - Array of parsed image objects
 * @param {string} userId - User ID for user-specific storage
 */
export const saveProgressToStorage = (buttonClickCount, currentImageTimes, parsedImages, userId = null) => {
  if (typeof window === 'undefined') return;
  
  try {
    const storageKey = userId ? `progress_${userId}` : 'progress';
    const progressData = {
      buttonClickCount,
      currentImageTimes,
      parsedImages,
      timestamp: Date.now()
    };
    localStorage.setItem(storageKey, JSON.stringify(progressData));
    console.log('Saved progress to localStorage:', progressData);
  } catch (error) {
    console.error('Error saving progress to localStorage:', error);
  }
};

/**
 * Load progress data from localStorage
 * @param {string} userId - User ID for user-specific storage
 * @returns {Object} - Progress data object
 */
export const loadProgressFromStorage = (userId = null) => {
  if (typeof window === 'undefined') {
    return {
      buttonClickCount: 0,
      currentImageTimes: 1,
      parsedImages: [],
      timestamp: 0
    };
  }
  
  try {
    const storageKey = userId ? `progress_${userId}` : 'progress';
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const progressData = JSON.parse(stored);
      console.log('Loaded progress from localStorage:', progressData);
      return progressData;
    }
  } catch (error) {
    console.error('Error loading progress from localStorage:', error);
  }
  
  return {
    buttonClickCount: 0,
    currentImageTimes: 1,
    parsedImages: [],
    timestamp: 0
  };
};

/**
 * Clear progress data from localStorage
 * @param {string} userId - User ID for user-specific storage
 */
export const clearProgressFromStorage = (userId = null) => {
  if (typeof window === 'undefined') return;
  
  try {
    const storageKey = userId ? `progress_${userId}` : 'progress';
    localStorage.removeItem(storageKey);
    console.log('Cleared progress from localStorage');
  } catch (error) {
    console.error('Error clearing progress from localStorage:', error);
  }
};

/**
 * Check if progress data is stale (older than 24 hours)
 * @param {Object} progressData - Progress data object
 * @param {number} maxAgeHours - Maximum age in hours (default: 24)
 * @returns {boolean} - True if data is stale
 */
export const isProgressDataStale = (progressData, maxAgeHours = 24) => {
  if (!progressData || !progressData.timestamp) return true;
  
  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds
  return (now - progressData.timestamp) > maxAge;
};

/**
 * Get all stored progress keys from localStorage
 * @returns {Array} - Array of storage keys
 */
export const getAllProgressKeys = () => {
  if (typeof window === 'undefined') return [];
  
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('progress')) {
      keys.push(key);
    }
  }
  return keys;
};

// ============================================================================
// PROGRESS CALCULATION UTILITIES
// ============================================================================

/**
 * Calculate overall progress across all images
 * @param {Array} parsedImages - Array of parsed image objects
 * @param {number} totalButtonClicks - Total number of button clicks
 * @returns {Object} - { totalRequired: number, completed: number, percentage: number }
 */
export const calculateOverallProgress = (parsedImages, totalButtonClicks) => {
  if (!parsedImages || parsedImages.length === 0) {
    return { totalRequired: 0, completed: 0, percentage: 0 };
  }

  const totalRequired = parsedImages.reduce((sum, image) => sum + image.times, 0);
  const completed = Math.min(totalButtonClicks, totalRequired);
  const percentage = totalRequired > 0 ? Math.round((completed / totalRequired) * 100) : 0;

  return { totalRequired, completed, percentage };
};

/**
 * Get progress summary for display
 * @param {Array} parsedImages - Array of parsed image objects
 * @param {number} totalButtonClicks - Total number of button clicks
 * @returns {string} - Formatted progress summary
 */
export const getProgressSummary = (parsedImages, totalButtonClicks) => {
  const { totalRequired, completed, percentage } = calculateOverallProgress(parsedImages, totalButtonClicks);
  
  if (totalRequired === 0) {
    return 'No progress data available';
  }
  
  return `${completed}/${totalRequired} (${percentage}%)`;
};

// ============================================================================
// EXPORT ALL UTILITIES
// ============================================================================

export default {
  // Check mark functions
  getCheckMarkStatus,
  CheckMarkRenderer,
  
  // Progress functions
  getProgressStatus,
  ProgressRenderer,
  
  // Image parsing functions
  parseImagePaths,
  getImageUrl,
  
  // LocalStorage functions
  saveClickedButtonsToStorage,
  loadClickedButtonsFromStorage,
  clearClickedButtonsFromStorage,
  getAllClickedButtonsKeys,
  
  // Button tracking functions
  trackButtonClick,
  clearAllButtonClicks,
  initializeButtonClicks,
  
  // Progress localStorage functions
  saveProgressToStorage,
  loadProgressFromStorage,
  clearProgressFromStorage,
  isProgressDataStale,
  getAllProgressKeys,
  
  // Progress calculation functions
  calculateOverallProgress,
  getProgressSummary
};
