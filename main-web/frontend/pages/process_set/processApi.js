// pages/process_set/processApi.js - API functions for process_set with improved connection handling

// Utility function for making API requests with retry and better error handling
const fetchWithRetry = async (url, options = {}, retries = 2) => {
  let lastError;
  
  // Get API key from environment variable
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';
  
  // Get backend URL from environment variable
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  
  // Ensure URL is absolute
  const absoluteUrl = url.startsWith('http') ? url : `${backendUrl}${url}`;
  
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
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
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
  
// Get list of files from both capture and enhance folders
export const getFilesList = async () => {
  try {
    // console.log('Fetching files list...');
    const response = await fetchWithRetry('/api/file-api?operation=list');
    // console.log('Raw files list response:', JSON.stringify(response, null, 2));
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to get files list');
    }
    
    // Organize files into capture and enhance arrays
    const organizedFiles = {
      capture: [],
      enhance: []
    };
    
    if (response.files && Array.isArray(response.files)) {
      // console.log('Processing files array:', response.files);
      // Files are already sorted by number from the backend
      response.files.forEach(file => {
        // console.log('Processing file:', file);
        // Check if file is in capture or enhance directory
        if (file.path.includes('eye_tracking_captures')) {
          // console.log('Adding to capture:', file);
          organizedFiles.capture.push(file);
        } else if (file.path.includes('enhance')) {
          // console.log('Adding to enhance:', file);
          organizedFiles.enhance.push(file);
        }
      });
      
      // console.log('Final organized files:', JSON.stringify(organizedFiles, null, 2));
    } else {
      // console.log('No files array in response or not an array:', response.files);
    }
    
    return {
      success: true,
      files: organizedFiles,
      message: response.message || 'Files retrieved successfully'
    };
  } catch (error) {
    console.error('Error getting files list:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to get files list',
      files: { capture: [], enhance: [] }
    };
  }
};
  
// Check file completeness (if webcam, screen, and parameter files exist for each set)
export const checkFilesCompleteness = async () => {
  try {
    const response = await fetch('/api/check-files');
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to check files');
    }

    // Only check files in eye_tracking_captures folder
    const captureFiles = data.files.capture || [];
    const fileNumbers = new Set();
    
    // Extract file numbers from capture files
    captureFiles.forEach(file => {
      const match = file.filename.match(/_(\d+)\./);
      if (match) {
        fileNumbers.add(parseInt(match[1]));
      }
    });

    // Check for missing files in sequence
    const missingFiles = [];
    if (fileNumbers.size > 0) {
      const minNumber = Math.min(...fileNumbers);
      const maxNumber = Math.max(...fileNumbers);
      
      for (let i = minNumber; i <= maxNumber; i++) {
        if (!fileNumbers.has(i)) {
          missingFiles.push(i);
        }
      }
    }

    return {
      success: true,
      isComplete: missingFiles.length === 0,
      missingFiles: missingFiles.length,
      totalFiles: fileNumbers.size
    };
  } catch (error) {
    console.error('Error checking files completeness:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
  
// Preview a specific file
export const previewFile = async (filename) => {
  try {
    // console.log('Fetching preview for file:', filename);
    const response = await fetchWithRetry(`/api/preview-api?filename=${encodeURIComponent(filename)}`);
    // console.log('Raw preview response:', response);
    
    // Check if response has the expected format
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format from preview API');
    }
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to get preview');
    }
    
    return {
      success: true,
      data: response.data,
      type: response.type,
      message: response.message
    };
  } catch (error) {
    console.error('Error previewing file:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to get preview'
    };
  }
};
  
// Check if files need processing
export const checkFilesNeedProcessing = async () => {
  try {
    const response = await fetchWithRetry('/api/file-api?operation=list');
    if (!response.success) {
      throw new Error(response.message || 'Failed to get files list');
    }
    
    // Get unique set numbers from each folder
    const captureSets = new Set();
    const enhanceSets = new Set();
    
    if (response.files && Array.isArray(response.files)) {
      response.files.forEach(file => {
        const match = file.filename.match(/_(\d+)\./);
        if (match) {
          const setNumber = parseInt(match[1]);
          if (file.path.includes('eye_tracking_captures')) {
            captureSets.add(setNumber);
          } else if (file.path.includes('enhance')) {
            enhanceSets.add(setNumber);
          }
        }
      });
    }
    
    const captureCount = captureSets.size;
    const enhanceCount = enhanceSets.size;
    const needsProcessing = captureCount > enhanceCount;
    const filesToProcess = captureCount - enhanceCount;
    
    return {
      success: true,
      needsProcessing,
      captureCount,
      enhanceCount,
      filesToProcess
    };
  } catch (error) {
    console.error('Error checking files:', error);
    return {
      success: false,
      error: error.message,
      needsProcessing: false,
      captureCount: 0,
      enhanceCount: 0,
      filesToProcess: 0
    };
  }
};

// Process files
export const processFiles = async (setNumbers) => {
  try {
    // console.log('Starting processing for sets:', setNumbers);
    const response = await fetchWithRetry('/api/process-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ set_numbers: setNumbers }),
    });
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to start processing');
    }
    
    return {
      success: true,
      message: response.message
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
  
// Compare files between capture and enhance folders
export const compareFileCounts = async () => {
  try {
    const response = await fetchWithRetry('/api/file-api?operation=compare');
    if (!response.success) {
      throw new Error(response.message || 'Failed to compare file counts');
    }
    return {
      success: true,
      captureCount: response.captureCount,
      enhanceCount: response.enhanceCount,
      needsProcessing: response.needsProcessing
    };
  } catch (error) {
    console.error('Error comparing file counts:', error);
    return { 
      success: false, 
      error: error.message,
      captureCount: 0,
      enhanceCount: 0,
      needsProcessing: false
    };
  }
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