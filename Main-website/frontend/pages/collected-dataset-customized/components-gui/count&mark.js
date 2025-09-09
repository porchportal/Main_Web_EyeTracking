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

/**
 * Clear all localStorage data related to button clicks and progress
 * @param {string} userId - User ID for user-specific storage
 * @returns {Object} - { success: boolean, clearedKeys: Array, message: string }
 */
export const clearAllStateData = (userId = null) => {
  if (typeof window === 'undefined') {
    return {
      success: false,
      clearedKeys: [],
      message: 'localStorage not available (server-side)'
    };
  }
  
  try {
    const clearedKeys = [];
    
    // Clear clicked buttons data
    const clickedButtonsKey = userId ? `clickedButtons_${userId}` : 'clickedButtons';
    if (localStorage.getItem(clickedButtonsKey)) {
      localStorage.removeItem(clickedButtonsKey);
      clearedKeys.push(clickedButtonsKey);
    }
    
    // Clear progress data
    const progressKey = userId ? `progress_${userId}` : 'progress';
    if (localStorage.getItem(progressKey)) {
      localStorage.removeItem(progressKey);
      clearedKeys.push(progressKey);
    }
    
    // Clear any other related keys (fallback for any missed keys)
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('clickedButtons') || key.startsWith('progress'))) {
        allKeys.push(key);
      }
    }
    
    // Remove any remaining related keys
    allKeys.forEach(key => {
      if (!clearedKeys.includes(key)) {
        localStorage.removeItem(key);
        clearedKeys.push(key);
      }
    });
    
    console.log('Cleared all state data from localStorage:', clearedKeys);
    
    return {
      success: true,
      clearedKeys,
      message: `Successfully cleared ${clearedKeys.length} localStorage entries`
    };
  } catch (error) {
    console.error('Error clearing state data from localStorage:', error);
    return {
      success: false,
      clearedKeys: [],
      message: `Error clearing localStorage: ${error.message}`
    };
  }
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
// BUTTON COMPLETION COUNTER
// ============================================================================

/**
 * Track button completion and increment counter
 * @param {string} buttonName - Name of the completed button
 * @param {string} userId - User ID for user-specific storage
 * @returns {Object} - { success: boolean, newCount: number, message: string }
 */
export const trackButtonCompletion = (buttonName, userId = null) => {
  if (typeof window === 'undefined') {
    return {
      success: false,
      newCount: 0,
      message: 'localStorage not available (server-side)'
    };
  }
  
  try {
    const storageKey = userId ? `buttonCompletion_${userId}` : 'buttonCompletion';
    const stored = localStorage.getItem(storageKey);
    
    let completionData = stored ? JSON.parse(stored) : {};
    
    // Initialize button count if it doesn't exist
    if (!completionData[buttonName]) {
      completionData[buttonName] = 0;
    }
    
    // Increment the counter
    completionData[buttonName] += 1;
    completionData.lastUpdated = Date.now();
    
    // Save back to localStorage
    localStorage.setItem(storageKey, JSON.stringify(completionData));
    
    console.log(`Button completion tracked: ${buttonName} - Count: ${completionData[buttonName]}`);
    
    return {
      success: true,
      newCount: completionData[buttonName],
      message: `${buttonName} completion count: ${completionData[buttonName]}`
    };
  } catch (error) {
    console.error('Error tracking button completion:', error);
    return {
      success: false,
      newCount: 0,
      message: `Error tracking completion: ${error.message}`
    };
  }
};

/**
 * Get button completion count
 * @param {string} buttonName - Name of the button
 * @param {string} userId - User ID for user-specific storage
 * @returns {number} - Current completion count
 */
export const getButtonCompletionCount = (buttonName, userId = null) => {
  if (typeof window === 'undefined') return 0;
  
  try {
    const storageKey = userId ? `buttonCompletion_${userId}` : 'buttonCompletion';
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      const completionData = JSON.parse(stored);
      return completionData[buttonName] || 0;
    }
  } catch (error) {
    console.error('Error getting button completion count:', error);
  }
  
  return 0;
};

/**
 * Get all button completion counts
 * @param {string} userId - User ID for user-specific storage
 * @returns {Object} - Object with all button completion counts
 */
export const getAllButtonCompletionCounts = (userId = null) => {
  if (typeof window === 'undefined') return {};
  
  try {
    const storageKey = userId ? `buttonCompletion_${userId}` : 'buttonCompletion';
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      const completionData = JSON.parse(stored);
      // Remove lastUpdated from the returned object
      const { lastUpdated, ...counts } = completionData;
      return counts;
    }
  } catch (error) {
    console.error('Error getting all button completion counts:', error);
  }
  
  return {};
};

/**
 * Clear button completion counts
 * @param {string} userId - User ID for user-specific storage
 * @returns {Object} - { success: boolean, message: string }
 */
export const clearButtonCompletionCounts = (userId = null) => {
  if (typeof window === 'undefined') {
    return {
      success: false,
      message: 'localStorage not available (server-side)'
    };
  }
  
  try {
    const storageKey = userId ? `buttonCompletion_${userId}` : 'buttonCompletion';
    localStorage.removeItem(storageKey);
    
    console.log('Button completion counts cleared');
    
    return {
      success: true,
      message: 'Button completion counts cleared successfully'
    };
  } catch (error) {
    console.error('Error clearing button completion counts:', error);
    return {
      success: false,
      message: `Error clearing completion counts: ${error.message}`
    };
  }
};

/**
 * Clear all state data including button completion counts
 * @param {string} userId - User ID for user-specific storage
 * @returns {Object} - { success: boolean, clearedKeys: Array, message: string }
 */
export const clearAllStateDataWithCompletion = (userId = null) => {
  if (typeof window === 'undefined') {
    return {
      success: false,
      clearedKeys: [],
      message: 'localStorage not available (server-side)'
    };
  }
  
  try {
    const clearedKeys = [];
    
    // Clear clicked buttons data
    const clickedButtonsKey = userId ? `clickedButtons_${userId}` : 'clickedButtons';
    if (localStorage.getItem(clickedButtonsKey)) {
      localStorage.removeItem(clickedButtonsKey);
      clearedKeys.push(clickedButtonsKey);
    }
    
    // Clear progress data
    const progressKey = userId ? `progress_${userId}` : 'progress';
    if (localStorage.getItem(progressKey)) {
      localStorage.removeItem(progressKey);
      clearedKeys.push(progressKey);
    }
    
    // Clear button completion data
    const completionKey = userId ? `buttonCompletion_${userId}` : 'buttonCompletion';
    if (localStorage.getItem(completionKey)) {
      localStorage.removeItem(completionKey);
      clearedKeys.push(completionKey);
    }
    
    // Clear button counter data
    const counterKey = userId ? `buttonCounter_${userId}` : 'buttonCounter';
    if (localStorage.getItem(counterKey)) {
      localStorage.removeItem(counterKey);
      clearedKeys.push(counterKey);
    }
    
    // Clear any other related keys (fallback for any missed keys)
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('clickedButtons') || key.startsWith('progress') || key.startsWith('buttonCompletion') || key.startsWith('buttonCounter'))) {
        allKeys.push(key);
      }
    }
    
    // Remove any remaining related keys
    allKeys.forEach(key => {
      if (!clearedKeys.includes(key)) {
        localStorage.removeItem(key);
        clearedKeys.push(key);
      }
    });
    
    console.log('Cleared all state data including completion counts from localStorage:', clearedKeys);
    
    return {
      success: true,
      clearedKeys,
      message: `Successfully cleared ${clearedKeys.length} localStorage entries including completion counts`
    };
  } catch (error) {
    console.error('Error clearing state data with completion from localStorage:', error);
    return {
      success: false,
      clearedKeys: [],
      message: `Error clearing localStorage: ${error.message}`
    };
  }
};

// ============================================================================
// BUTTON COMPLETION COUNTER
// ============================================================================

/**
 * Counter function to track button completions
 * @param {number} number - Number to add to the counter (default: 1)
 * @param {string} userId - User ID for user-specific storage
 * @param {number} imageIndex - Image index for per-image counting (optional)
 * @returns {Object} - { success: boolean, newCount: number, message: string }
 */
export const counter = (number = 1, userId = null, imageIndex = null) => {
  if (typeof window === 'undefined') {
    return {
      success: false,
      newCount: 0,
      message: 'localStorage not available (server-side)'
    };
  }
  
  try {
    // Create storage key based on whether we're tracking per-image or globally
    let storageKey;
    if (imageIndex !== null) {
      storageKey = userId ? `buttonCounter_${userId}_image_${imageIndex}` : `buttonCounter_image_${imageIndex}`;
    } else {
      storageKey = userId ? `buttonCounter_${userId}` : 'buttonCounter';
    }
    
    const stored = localStorage.getItem(storageKey);
    
    let currentCount = stored ? parseInt(stored, 10) : 0;
    
    // Add the number to current count
    currentCount += number;
    
    // Save back to localStorage
    localStorage.setItem(storageKey, currentCount.toString());
    
    // Enhanced logging to debug the issue
    console.log(`🔢 COUNTER DEBUG:`, {
      function: 'counter',
      number: number,
      userId: userId,
      imageIndex: imageIndex,
      storageKey: storageKey,
      previousCount: stored ? parseInt(stored, 10) : 0,
      newCount: currentCount,
      stackTrace: new Error().stack
    });
    
    return {
      success: true,
      newCount: currentCount,
      message: `Counter updated: +${number} = ${currentCount}${imageIndex !== null ? ` (Image ${imageIndex + 1})` : ''}`
    };
  } catch (error) {
    console.error('Error updating button counter:', error);
    return {
      success: false,
      newCount: 0,
      message: `Error updating counter: ${error.message}`
    };
  }
};

/**
 * Get current button counter value
 * @param {string} userId - User ID for user-specific storage
 * @returns {number} - Current counter value
 */
export const getButtonCounter = (userId = null) => {
  if (typeof window === 'undefined') return 0;
  
  try {
    const storageKey = userId ? `buttonCounter_${userId}` : 'buttonCounter';
    const stored = localStorage.getItem(storageKey);
    return stored ? parseInt(stored, 10) : 0;
  } catch (error) {
    console.error('Error getting button counter:', error);
    return 0;
  }
};

/**
 * Reset button counter to 0
 * @param {string} userId - User ID for user-specific storage
 * @returns {Object} - { success: boolean, message: string }
 */
export const resetButtonCounter = (userId = null) => {
  if (typeof window === 'undefined') {
    return {
      success: false,
      message: 'localStorage not available (server-side)'
    };
  }
  
  try {
    const storageKey = userId ? `buttonCounter_${userId}` : 'buttonCounter';
    localStorage.removeItem(storageKey);
    
    console.log('Button counter reset to 0');
    
    return {
      success: true,
      message: 'Button counter reset successfully'
    };
  } catch (error) {
    console.error('Error resetting button counter:', error);
    return {
      success: false,
      message: `Error resetting counter: ${error.message}`
    };
  }
};

/**
 * Get counter for specific image
 * @param {number} imageIndex - Image index
 * @param {string} userId - User ID for user-specific storage
 * @returns {number} - Current counter value for the image
 */
export const getImageCounter = (imageIndex, userId = null) => {
  if (typeof window === 'undefined') return 0;
  
  try {
    const storageKey = userId ? `buttonCounter_${userId}_image_${imageIndex}` : `buttonCounter_image_${imageIndex}`;
    const stored = localStorage.getItem(storageKey);
    return stored ? parseInt(stored, 10) : 0;
  } catch (error) {
    console.error('Error getting image counter:', error);
    return 0;
  }
};

/**
 * Get all image counters
 * @param {string} userId - User ID for user-specific storage
 * @returns {Object} - Object with image counters
 */
export const getAllImageCounters = (userId = null) => {
  if (typeof window === 'undefined') return {};
  
  try {
    const counters = {};
    const prefix = userId ? `buttonCounter_${userId}_image_` : 'buttonCounter_image_';
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const imageIndex = key.replace(prefix, '');
        const count = localStorage.getItem(key);
        counters[imageIndex] = parseInt(count, 10) || 0;
      }
    }
    
    return counters;
  } catch (error) {
    console.error('Error getting all image counters:', error);
    return {};
  }
};

/**
 * Reset counter for specific image
 * @param {number} imageIndex - Image index
 * @param {string} userId - User ID for user-specific storage
 * @returns {Object} - { success: boolean, message: string }
 */
export const resetImageCounter = (imageIndex, userId = null) => {
  if (typeof window === 'undefined') {
    return {
      success: false,
      message: 'localStorage not available (server-side)'
    };
  }
  
  try {
    const storageKey = userId ? `buttonCounter_${userId}_image_${imageIndex}` : `buttonCounter_image_${imageIndex}`;
    localStorage.removeItem(storageKey);
    
    console.log(`Image counter for image ${imageIndex + 1} reset to 0`);
    
    return {
      success: true,
      message: `Image counter for image ${imageIndex + 1} reset successfully`
    };
  } catch (error) {
    console.error('Error resetting image counter:', error);
    return {
      success: false,
      message: `Error resetting image counter: ${error.message}`
    };
  }
};

/**
 * Reset all image counters
 * @param {string} userId - User ID for user-specific storage
 * @returns {Object} - { success: boolean, message: string }
 */
export const resetAllImageCounters = (userId = null) => {
  if (typeof window === 'undefined') {
    return {
      success: false,
      message: 'localStorage not available (server-side)'
    };
  }
  
  try {
    const prefix = userId ? `buttonCounter_${userId}_image_` : 'buttonCounter_image_';
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log(`Reset ${keysToRemove.length} image counters`);
    
    return {
      success: true,
      message: `Reset ${keysToRemove.length} image counters successfully`
    };
  } catch (error) {
    console.error('Error resetting all image counters:', error);
    return {
      success: false,
      message: `Error resetting image counters: ${error.message}`
    };
  }
};

/**
 * Debug function to get all button-related localStorage data
 * @param {string} userId - User ID for user-specific storage
 * @returns {Object} - All button-related localStorage data
 */
export const debugButtonStorage = (userId = null) => {
  if (typeof window === 'undefined') {
    return { error: 'localStorage not available (server-side)' };
  }
  
  try {
    const debugData = {
      userId: userId,
      timestamp: new Date().toISOString(),
      localStorage: {}
    };
    
    // Get all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('clickedButtons') || 
        key.startsWith('progress') || 
        key.startsWith('buttonCompletion') || 
        key.startsWith('buttonCounter')
      )) {
        debugData.localStorage[key] = localStorage.getItem(key);
      }
    }
    
    console.log('🔍 BUTTON STORAGE DEBUG:', debugData);
    return debugData;
  } catch (error) {
    console.error('Error debugging button storage:', error);
    return { error: error.message };
  }
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
  clearAllStateData,
  
  // Progress calculation functions
  calculateOverallProgress,
  getProgressSummary,
  
  // Button completion counter functions
  trackButtonCompletion,
  getButtonCompletionCount,
  getAllButtonCompletionCounts,
  clearButtonCompletionCounts,
  clearAllStateDataWithCompletion,
  
  // Button counter functions
  counter,
  getButtonCounter,
  resetButtonCounter,
  getImageCounter,
  getAllImageCounters,
  resetImageCounter,
  resetAllImageCounters,
  debugButtonStorage
};
