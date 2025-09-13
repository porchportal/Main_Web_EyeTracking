// pages/process_set/processApi.js - API functions for process_set with improved connection handling

// Utility function for making API requests with retry and better error handling
const fetchWithRetry = async (url, options = {}, retries = 3, customTimeout = 10000) => {
  let lastError;
  
  // Get API key from environment variable
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;
  
  // Get backend URL from environment variable
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  
  // Use relative URL for browser fetches
  const isBrowser = typeof window !== 'undefined';
  const absoluteUrl = isBrowser ? url : (url.startsWith('http') ? url : `${backendUrl}${url}`);

  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), customTimeout);
      
      const response = await fetch(absoluteUrl, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        }
      });
      
      clearTimeout(timeout);
      
      // Check for response errors
      if (!response.ok) {
        const errorText = await response.text();
        
        // Special handling for different error codes
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your configuration.');
        } else if (response.status === 503) {
          throw new Error('Service temporarily unavailable. Please try again in a moment.');
        } else if (response.status >= 500) {
          throw new Error(`Server error (${response.status}). Please try again later.`);
        }
        
        throw new Error(`API returned ${response.status}: ${errorText || response.statusText}`);
      }
      
      // Try to parse JSON response
      try {
        const data = await response.json();
        return data;
      } catch (parseError) {
        throw new Error(`Failed to parse response: ${parseError.message}`);
      }
    } catch (error) {
      lastError = error;
      
      // If this was an abort error (timeout), don't retry
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection.');
      }
      
      // If this is a 503 error, wait longer before retrying
      if (error.message.includes('503') || error.message.includes('Service temporarily unavailable')) {
        if (i < retries) {
          const delay = 2000 * Math.pow(2, i); // Longer delay for 503: 2s, 4s, 8s
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // If we have retries left, wait before trying again
      if (i < retries) {
        const delay = 1000 * Math.pow(2, i); // Exponential backoff: 1s, 2s, 4s, etc.
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we got here, all retries failed
  throw lastError;
};

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

// Cache for current user ID to avoid repeated API calls
let currentUserIdCache = null;
let userIdCacheTimestamp = 0;
const USER_ID_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get the actual user ID from the backend
export const getCurrentUserId = async () => {
  try {
    // Check if we have a valid cached user ID
    const now = Date.now();
    if (currentUserIdCache && (now - userIdCacheTimestamp) < USER_ID_CACHE_DURATION) {
      return currentUserIdCache;
    }

    // Get user ID from backend
    const response = await fetchWithRetry('/api/current-user-id', {}, 1, 5000);
    
    if (response.success && response.userId) {
      currentUserIdCache = response.userId;
      userIdCacheTimestamp = now;
      return response.userId;
    } else {
      throw new Error(response.error || 'Failed to get user ID');
    }
  } catch (error) {
    console.error('Error getting current user ID:', error);
    // Fallback to localStorage or 'default'
    const fallbackUserId = localStorage.getItem('userId') || 'default';
    console.warn(`Using fallback user ID: ${fallbackUserId}`);
    return fallbackUserId;
  }
};

// Check if the backend is connected
export const checkBackendConnection = async () => {
  try {
    const response = await fetchWithRetry('/api/check-backend-connection');
    return {
      success: true,
      connected: response.connected || false,
      status: response.status || 'unknown'
    };
  } catch (error) {
    console.error('Backend connection check failed:', error);
    return {
      success: false,
      connected: false,
      error: error.message,
      status: 'error'
    };
  }
};
  
// Get list of files from a specific folder using readDataset API
export const getFilesList = async (folder, userId = null) => {
  try {
    // Get user ID from backend if not provided
    if (!userId) {
      userId = await getCurrentUserId();
    }
    
    // Get files from specified folder
    const response = await fetchWithRetry(`/api/for-process-folder/readDataset/${encodeURIComponent(userId)}?operation=list&folder=${encodeURIComponent(folder)}`);
    
    if (response.success && response.files) {
      return {
        success: true,
        files: response.files,
        message: `Found ${response.files.length} files in ${folder} folder`
      };
    } else {
      return {
        success: false,
        error: response.error || 'Failed to get files list',
        files: [],
        message: `Failed to get files from ${folder} folder`
      };
    }
  } catch (error) {
    console.error('Error getting files list:', error);
    return {
      success: false,
      error: error.message,
      files: [],
      message: `Failed to get files from ${folder} folder`
    };
  }
};
  
// Check file completeness using readDataset API
export const checkFilesCompleteness = async (userId = null) => {
  try {
    // Get user ID from backend if not provided
    if (!userId) {
      userId = await getCurrentUserId();
    }
    
    const response = await fetchWithRetry(`/api/for-process-folder/readDataset/${encodeURIComponent(userId)}?operation=check-completeness`);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to check files');
    }

    return {
      success: true,
      isComplete: response.isComplete,
      missingFiles: response.missingFiles,
      totalFiles: response.totalSets,
      incompleteSets: response.incompleteSets || []
    };
  } catch (error) {
    console.error('Error checking files completeness:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
  
// Preview a specific file using readDataset API
export const previewFile = async (filename, userId = null, folder = 'captures') => {
  try {
    // Get user ID from backend if not provided
    if (!userId) {
      userId = await getCurrentUserId();
    }
    
    const data = await fetchWithRetry(`/api/for-process-folder/readDataset/${encodeURIComponent(userId)}?filename=${encodeURIComponent(filename)}&folder=${encodeURIComponent(folder)}`);
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to get preview');
    }

    return {
      success: true,
      data: data.data,
      type: data.type
    };
  } catch (error) {
    console.error('Preview API error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
  
// Check if files need processing using readDataset API
export const checkFilesNeedProcessing = async (userId = null) => {
  try {
    // Get user ID from backend if not provided
    if (!userId) {
      userId = await getCurrentUserId();
    }
    
    const response = await fetchWithRetry(`/api/for-process-folder/readDataset/${encodeURIComponent(userId)}?operation=compare`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to get files list');
    }
    
    const captureCount = response.captureCount || 0;
    const enhanceCount = response.enhanceCount || 0;
    const needsProcessing = captureCount > enhanceCount;
    const filesToProcess = captureCount - enhanceCount;
    
    return {
      success: true,
      needsProcessing,
      captureCount,
      enhanceCount,
      filesToProcess,
      setsNeedingProcessing: response.setsNeedingProcessing || []
    };
  } catch (error) {
    console.error('Error checking files:', error);
    return {
      success: false,
      error: error.message,
      needsProcessing: false,
      captureCount: 0,
      enhanceCount: 0,
      filesToProcess: 0,
      setsNeedingProcessing: []
    };
  }
};

// Process files function that calls the new aprocess-file endpoint
export const processFiles = async (setNumbers, userId = null, enhanceFace) => {
  try {
    // Get user ID from backend if not provided
    if (!userId) {
      userId = await getCurrentUserId();
    }

    // Get auth service URL from environment (which proxies to image service)
    const authServiceUrl = process.env.NEXT_PUBLIC_API_URL;
    
    // Use the new aprocess-file endpoint with longer timeout for image processing
    const response = await fetchWithRetry(`/api/for-process-folder/aprocess-file/${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify({ setNumbers, enhanceFace }),
    }, 0, 300000); // Use 0 retries but 5 minute timeout for image processing

    if (!response.success) {
      throw new Error(response.error || 'Failed to process files');
    }

    return {
      success: true,
      message: 'Files processed successfully',
      data: response
    };
  } catch (error) {
    console.error('Error processing files:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to process files'
    };
  }
};
  
// Compare files between capture and enhance folders (now handled by checkFilesNeedProcessing)
export const compareFileCounts = async (userId = null) => {
  // This function is now handled by checkFilesNeedProcessing
  return await checkFilesNeedProcessing(userId);
};
  
// Check if processing is currently running
export const checkProcessingStatus = async () => {
  try {
    const response = await fetchWithRetry('/api/process-status-api', {}, 1); // Only 1 retry for status checks
    
    // If fetch succeeded but response is malformed, handle it gracefully
    if (!response || typeof response !== 'object') {
      console.error('Invalid response format:', response);
      return { 
        success: false, 
        error: `Invalid response format: ${typeof response}`,
        isProcessing: false
      };
    }
    
    return response;
  } catch (error) {
    console.error('Error checking processing status:', error);
    return { 
      success: false, 
      error: error.message,
      isProcessing: false
    };
  }
};

// Add default export component
export default function ProcessApiPage() {
  return null; // This is a utility file, so we don't need to render anything
}