// pages/process_set/processApi.js - API functions for process_set with improved connection handling

// Utility function for making API requests with retry and better error handling
const fetchWithRetry = async (url, options = {}, retries = 2) => {
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
      console.log(`Fetching ${absoluteUrl}${i > 0 ? ` (retry ${i}/${retries})` : ''}`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
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
        console.error(`API error (${response.status}):`, errorText);
        
        // Special handling for 401 (Unauthorized)
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your configuration.');
        }
        
        throw new Error(`API returned ${response.status}: ${errorText || response.statusText}`);
      }
      
      // Try to parse JSON response
      try {
        const data = await response.json();
        return data;
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error(`Failed to parse response: ${parseError.message}`);
      }
    } catch (error) {
      console.error(`Fetch error (attempt ${i+1}/${retries+1}):`, error);
      lastError = error;
      
      // If this was an abort error (timeout), log it specifically
      if (error.name === 'AbortError') {
        console.error('Request timed out');
      }
      
      // If we have retries left, wait before trying again
      if (i < retries) {
        const delay = 1000 * Math.pow(2, i); // Exponential backoff: 1s, 2s, 4s, etc.
        // console.log(`Waiting ${delay}ms before retry...`);
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

// Check if the backend is connected
export const checkBackendConnection = async () => {
  try {
    // console.log('Checking backend connection...');
    const response = await fetchWithRetry('/api/check-backend-connection');
    // console.log('Backend connection response:', response);
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
    // Get user ID from localStorage if not provided
    if (!userId) {
      userId = localStorage.getItem('userId') || 'default';
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
    // Get user ID from localStorage if not provided
    if (!userId) {
      userId = localStorage.getItem('userId') || 'default';
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
    // Get user ID from localStorage if not provided
    if (!userId) {
      userId = localStorage.getItem('userId') || 'default';
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
    // Get user ID from localStorage if not provided
    if (!userId) {
      userId = localStorage.getItem('userId') || 'default';
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

// Note: processFiles function has been moved to index.js to keep processing logic centralized
  
// Compare files between capture and enhance folders (now handled by checkFilesNeedProcessing)
export const compareFileCounts = async (userId = null) => {
  // This function is now handled by checkFilesNeedProcessing
  return await checkFilesNeedProcessing(userId);
};
  
// Check if processing is currently running
export const checkProcessingStatus = async () => {
  try {
    // console.log('Requesting processing status...');
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