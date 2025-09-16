// pages/process_set/readDataset.js - Dataset reading utilities for image preview with folder support

// Import getCurrentUserId from processApi to ensure consistent user ID handling
import { getCurrentUserId } from './processApi';

// Utility function for making API requests with retry and better error handling
const fetchWithRetry = async (url, options = {}, retries = 3) => {
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
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
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

/**
 * Read and process dataset images from the backend
 * This utility handles different types of files and provides preview functionality
 */
export class DatasetReader {
  constructor() {
    this.cache = new Map(); // Cache for loaded images
    this.loadingPromises = new Map(); // Track ongoing loading operations
  }

  /**
   * Check if a file is an image based on its extension
   * @param {string} filename - The filename to check
   * @returns {boolean} - True if the file is an image
   */
  isImageFile(filename) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return imageExtensions.includes(extension);
  }

  /**
   * Check if a file is a CSV/text file
   * @param {string} filename - The filename to check
   * @returns {boolean} - True if the file is a text/CSV file
   */
  isTextFile(filename) {
    const textExtensions = ['.csv', '.txt', '.json', '.log'];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return textExtensions.includes(extension);
  }

  /**
   * Get the file type for preview purposes
   * @param {string} filename - The filename to analyze
   * @returns {string} - 'image', 'text', or 'unknown'
   */
  getFileType(filename) {
    if (this.isImageFile(filename)) {
      return 'image';
    } else if (this.isTextFile(filename)) {
      return 'text';
    }
    return 'unknown';
  }

  /**
   * Read a file from the backend and return preview data
   * @param {string} filename - The filename to read
   * @param {string} userId - The user ID (optional, will use localStorage if not provided)
   * @param {boolean} useCache - Whether to use cached data if available
   * @param {string} folder - The folder to read from (captures, enhance, complete)
   * @returns {Promise<Object>} - Preview data object
   */
  async readFile(filename, userId = null, useCache = true, folder = 'captures') {
    // Create cache key that includes folder
    const cacheKey = `${folder}:${filename}`;
    
    // Check cache first if enabled
    if (useCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Check if already loading this file
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    // Create loading promise
    const loadingPromise = this._loadFileFromBackend(filename, userId, folder);
    this.loadingPromises.set(cacheKey, loadingPromise);

    try {
      const result = await loadingPromise;
      
      // Cache the result if successful
      if (result.success && useCache) {
        this.cache.set(cacheKey, result);
      }
      
      return result;
    } finally {
      // Clean up loading promise
      this.loadingPromises.delete(cacheKey);
    }
  }

  /**
   * Internal method to load file from backend
   * @param {string} filename - The filename to load
   * @param {string} userId - The user ID
   * @param {string} folder - The folder to load from
   * @returns {Promise<Object>} - Preview data object
   */
  async _loadFileFromBackend(filename, userId, folder = 'captures') {
    try {
      
      // Get user ID from backend if not provided
      if (!userId) {
        userId = await getCurrentUserId();
      }

      // Call the new readDataset API with folder support
      const result = await this._callReadDatasetAPI(filename, userId, folder);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load file');
      }

      // Determine file type
      const fileType = this.getFileType(filename);
      
      // Process the data based on file type
      let processedData = result.data;
      let processedType = result.type || fileType;

      // For images, ensure we have proper base64 data
      if (fileType === 'image' && processedData) {
        // If data doesn't start with data:image, assume it's base64 and add the prefix
        if (!processedData.startsWith('data:image/')) {
          const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
          const mimeType = extension === '.png' ? 'image/png' : 
                          extension === '.gif' ? 'image/gif' : 
                          extension === '.webp' ? 'image/webp' : 'image/jpeg';
          processedData = `data:${mimeType};base64,${processedData}`;
        }
        processedType = 'image';
      }

      return {
        success: true,
        data: processedData,
        type: processedType,
        filename: filename,
        fileType: fileType,
        folder: folder,
        userId: userId,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error(`Error loading file ${filename} from ${folder}:`, error);
      return {
        success: false,
        error: error.message,
        filename: filename,
        folder: folder,
        data: null,
        type: 'unknown'
      };
    }
  }

  /**
   * Call the readDataset API endpoint
   * @param {string} filename - The filename to load
   * @param {string} userId - The user ID
   * @param {string} folder - The folder to load from
   * @returns {Promise<Object>} - API response
   */
  async _callReadDatasetAPI(filename, userId, folder) {
    try {
      const url = `/api/for-process-folder/readDataset/${encodeURIComponent(userId)}?filename=${encodeURIComponent(filename)}&folder=${encodeURIComponent(folder)}`;
      const data = await fetchWithRetry(url);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get preview');
      }

      return {
        success: true,
        data: data.data,
        type: data.type
      };
    } catch (error) {
      console.error('ReadDataset API error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get list of files from a specific folder
   * @param {string} folder - The folder to list files from
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} - Files list response
   */
  async getFilesList(folder, userId = null) {
    try {
      // Get user ID from backend if not provided
      if (!userId) {
        userId = await getCurrentUserId();
      }

      const url = `/api/for-process-folder/readDataset/${encodeURIComponent(userId)}?operation=list&folder=${encodeURIComponent(folder)}`;
      const data = await fetchWithRetry(url);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get files list');
      }

      return {
        success: true,
        files: data.files || [],
        message: data.message || 'Files retrieved successfully'
      };
    } catch (error) {
      console.error('Error getting files list:', error);
      return {
        success: false,
        error: error.message,
        files: []
      };
    }
  }

  /**
   * Check file completeness
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} - Completeness check response
   */
  async checkFilesCompleteness(userId = null) {
    try {
      // Get user ID from backend if not provided
      if (!userId) {
        userId = await getCurrentUserId();
      }

      const url = `/api/for-process-folder/readDataset/${encodeURIComponent(userId)}?operation=check-completeness`;
      const data = await fetchWithRetry(url);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to check files completeness');
      }

      return {
        success: true,
        isComplete: data.isComplete,
        missingFiles: data.missingFiles,
        totalFiles: data.totalSets,
        incompleteSets: data.incompleteSets || []
      };
    } catch (error) {
      console.error('Error checking files completeness:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if files need processing
   * @param {string} userId - The user ID
   * @param {boolean} enhanceFace - Whether to use enhance mode
   * @returns {Promise<Object>} - Processing check response
   */
  async checkFilesNeedProcessing(userId = null, enhanceFace = false) {
    try {
      // Get user ID from backend if not provided
      if (!userId) {
        userId = await getCurrentUserId();
      }

      const url = `/api/for-process-folder/readDataset/${encodeURIComponent(userId)}?operation=compare&enhanceFace=${enhanceFace}`;
      const data = await fetchWithRetry(url);
      
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to check files processing');
      }

      const captureCount = data.captureCount || 0;
      const enhanceCount = data.enhanceCount || 0;
      const completeCount = data.completeCount || 0;
      // ✅ FIXED: Use the totalProcessedCount directly from the API response
      // The API already calculates the correct count based on enhanceFace setting
      const totalProcessedCount = data.totalProcessedCount !== undefined ? data.totalProcessedCount : 0;
      
      // ✅ FIXED: Calculate needsProcessing correctly using the API response
      const needsProcessing = captureCount > totalProcessedCount;
      const filesToProcess = captureCount - totalProcessedCount;
      

      return {
        success: true,
        needsProcessing,
        captureCount,
        enhanceCount,
        completeCount,
        totalProcessedCount,
        filesToProcess,
        setsNeedingProcessing: data.setsNeedingProcessing || []
      };
    } catch (error) {
      console.error('Error checking files processing:', error);
      return {
        success: false,
        error: error.message,
        needsProcessing: false,
        captureCount: 0,
        enhanceCount: 0,
        completeCount: 0,
        totalProcessedCount: 0,
        filesToProcess: 0,
        setsNeedingProcessing: []
      };
    }
  }

  /**
   * Preload multiple files for better performance
   * @param {Array<string>} filenames - Array of filenames to preload
   * @param {string} userId - The user ID
   * @param {string} folder - The folder to preload from
   * @returns {Promise<Array<Object>>} - Array of preview data objects
   */
  async preloadFiles(filenames, userId = null, folder = 'captures') {
    // Get user ID from backend if not provided
    if (!userId) {
      userId = await getCurrentUserId();
    }
    
    const promises = filenames.map(filename => 
      this.readFile(filename, userId, true, folder)
    );

    try {
      const results = await Promise.allSettled(promises);
      return results.map((result, index) => ({
        filename: filenames[index],
        success: result.status === 'fulfilled' ? result.value.success : false,
        data: result.status === 'fulfilled' ? result.value.data : null,
        type: result.status === 'fulfilled' ? result.value.type : 'unknown',
        folder: folder,
        error: result.status === 'rejected' ? result.reason.message : 
               (result.status === 'fulfilled' && !result.value.success ? result.value.error : null)
      }));
    } catch (error) {
      console.error('Error preloading files:', error);
      return filenames.map(filename => ({
        filename,
        success: false,
        data: null,
        type: 'unknown',
        folder: folder,
        error: error.message
      }));
    }
  }

  /**
   * Clear the cache for a specific file or all files
   * @param {string} filename - Optional filename to clear, if not provided clears all
   */
  clearCache(filename = null) {
    if (filename) {
      this.cache.delete(filename);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      files: Array.from(this.cache.keys()),
      loadingCount: this.loadingPromises.size
    };
  }

  /**
   * Check if a file is currently being loaded
   * @param {string} filename - The filename to check
   * @returns {boolean} - True if the file is being loaded
   */
  isLoading(filename) {
    return this.loadingPromises.has(filename);
  }

  /**
   * Get file metadata without loading the actual content
   * @param {string} filename - The filename to get metadata for
   * @returns {Object} - File metadata
   */
  getFileMetadata(filename) {
    return {
      filename,
      fileType: this.getFileType(filename),
      isImage: this.isImageFile(filename),
      isText: this.isTextFile(filename),
      isCached: this.cache.has(filename),
      isLoading: this.isLoading(filename)
    };
  }
}

// Create a singleton instance
export const datasetReader = new DatasetReader();

// Export utility functions for convenience
export const readFile = (filename, userId, useCache = true, folder = 'captures') => 
  datasetReader.readFile(filename, userId, useCache, folder);

export const preloadFiles = (filenames, userId, folder = 'captures') => 
  datasetReader.preloadFiles(filenames, userId, folder);

export const isImageFile = (filename) => 
  datasetReader.isImageFile(filename);

export const isTextFile = (filename) => 
  datasetReader.isTextFile(filename);

export const getFileType = (filename) => 
  datasetReader.getFileType(filename);

export const clearCache = (filename) => 
  datasetReader.clearCache(filename);

export const getCacheStats = () => 
  datasetReader.getCacheStats();

// New utility functions for folder-based operations
export const readFileFromFolder = (filename, folder, userId, useCache = true) => 
  datasetReader.readFile(filename, userId, useCache, folder);

export const preloadFilesFromFolder = (filenames, folder, userId) => 
  datasetReader.preloadFiles(filenames, userId, folder);

export const readImageFromBackend = (filename, userId, folder = 'captures') => 
  datasetReader.readFile(filename, userId, true, folder);

export const getImagePreviewUrl = (filename, userId, folder = 'captures') => {
  // This function can be used to get a preview URL for images
  return `/api/for-process-folder/readDataset/${encodeURIComponent(userId)}?filename=${encodeURIComponent(filename)}&folder=${encodeURIComponent(folder)}`;
};

// New utility functions for file operations
export const getFilesList = (folder, userId) => 
  datasetReader.getFilesList(folder, userId);

export const checkFilesCompleteness = (userId) => 
  datasetReader.checkFilesCompleteness(userId);

export const checkFilesNeedProcessing = (userId, enhanceFace = false) => 
  datasetReader.checkFilesNeedProcessing(userId, enhanceFace);

// Debug utility function
export const debugDatasetReader = () => {
  console.warn('Dataset Reader Debug Info:');
  console.warn('- Cache size:', datasetReader.getCacheStats().size);
  console.warn('- Cached files:', datasetReader.getCacheStats().files);
  console.warn('- Loading files:', datasetReader.getCacheStats().loadingCount);
  console.warn('- Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(datasetReader)));
};

// Default export
export default datasetReader;
