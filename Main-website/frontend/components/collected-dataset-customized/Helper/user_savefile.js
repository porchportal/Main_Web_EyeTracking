// user_savefile.js - User-specific capture file saving
import { getOrCreateUserId } from '../../../utils/consentManager';

/**
 * Get current user ID or generate a default one
 * @returns {string} User ID
 */
const getCurrentUserId = () => {
  try {
    const userId = getOrCreateUserId();
    if (userId) {
      return userId;
    }
    
    // Generate a default user ID if none exists
    const defaultUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('Generated default user ID:', defaultUserId);
    return defaultUserId;
  } catch (error) {
    console.error('Error getting user ID:', error);
    // Fallback to timestamp-based ID
    return `user_${Date.now()}`;
  }
};

/**
 * Save an image or data to the server for a specific user
 * @param {string} imageData - Base64 encoded image data
 * @param {string} filename - Filename pattern to save as
 * @param {string} type - Type of file (screen, webcam, parameters)
 * @param {string} captureGroup - Unique ID for grouping files from the same capture
 * @returns {Promise<Object>} - Server response
 */
export const saveImageToUserServer = async (imageData, filename, type, captureGroup = null) => {
  try {
    const userId = getCurrentUserId();
    
    const response = await fetch(`/api/user-captures/save/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'your-api-key'
      },
      body: JSON.stringify({ 
        imageData, 
        filename, 
        type,
        captureGroup
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server error:', errorData);
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Saved ${type} file for user ${userId}:`, result);
    return result;
  } catch (error) {
    console.error(`❌ Error saving ${type} file:`, error);
    throw error;
  }
};

/**
 * Save CSV data to the server for a specific user
 * @param {string} csvData - CSV data as string
 * @param {string} filename - Filename pattern to save as
 * @param {string} captureGroup - Unique ID for grouping files from the same capture
 * @returns {Promise<Object>} - Server response
 */
export const saveCSVToUserServer = async (csvData, filename, captureGroup = null) => {
  try {
    const userId = getCurrentUserId();
    
    // Convert CSV data to base64
    const base64Data = btoa(unescape(encodeURIComponent(csvData)));
    const dataUrl = `data:text/csv;base64,${base64Data}`;
    
    const response = await fetch(`/api/user-captures/save/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'your-api-key'
      },
      body: JSON.stringify({ 
        imageData: dataUrl, 
        filename, 
        type: 'parameters',
        captureGroup
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server error:', errorData);
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Saved CSV file for user ${userId}:`, result);
    return result;
  } catch (error) {
    console.error(`❌ Error saving CSV file:`, error);
    throw error;
  }
};

/**
 * Get user capture status
 * @returns {Promise<Object>} - User capture status
 */
export const getUserCaptureStatus = async () => {
  try {
    const userId = getCurrentUserId();
    
    const response = await fetch(`/api/user-captures/status/${userId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'your-api-key'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server error:', errorData);
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`📊 Capture status for user ${userId}:`, result);
    return result;
  } catch (error) {
    console.error(`❌ Error getting capture status:`, error);
    throw error;
  }
};

/**
 * Clear all capture files for the current user
 * @returns {Promise<Object>} - Clear operation result
 */
export const clearUserCaptures = async () => {
  try {
    const userId = getCurrentUserId();
    
    const response = await fetch(`/api/user-captures/clear/${userId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'your-api-key'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server error:', errorData);
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`🗑️ Cleared captures for user ${userId}:`, result);
    return result;
  } catch (error) {
    console.error(`❌ Error clearing captures:`, error);
    throw error;
  }
};

/**
 * Capture and save images at a specific point with user-specific storage
 * @param {Object} options - Capture options
 * @returns {Promise<Object>} - Capture results
 */
export const captureImagesAtUserPoint = async ({ point, captureCount = 1, canvasRef, setCaptureCount, showCapturePreview }) => {
  try {
    const userId = getCurrentUserId();
    console.log(`Starting user-specific capture for user: ${userId}`);
    
    // Create a unique ID for this capture group
    const captureGroupId = `capture-${Date.now()}-${userId}`;
    console.log(`Generated capture group ID: ${captureGroupId}`);
    
    // File patterns for saving
    const screenFilename = 'screen_001.jpg';
    const webcamFilename = 'webcam_001.jpg';
    const parameterFilename = 'parameter_001.csv';
    
    const canvas = canvasRef.current;
    let screenImage = null;
    let webcamImage = null;
    let captureNumber = null;
    
    // Variables to store webcam resolution
    let webcamWidth = 0;
    let webcamHeight = 0;
    
    // 1. Prepare all data first
    
    // 1.1 Canvas/screen image
    if (canvas) {
      screenImage = canvas.toDataURL('image/png');
    }

    // 1.2 Webcam image - Try to get the highest resolution available
    let webcamImagePreview = null;
    const videoElement = window.videoElement || document.querySelector('video');
    
    if (videoElement) {
      try {
        // Create a temporary canvas to capture webcam
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Set canvas size to video dimensions
        tempCanvas.width = videoElement.videoWidth || 640;
        tempCanvas.height = videoElement.videoHeight || 480;
        
        // Store webcam resolution
        webcamWidth = tempCanvas.width;
        webcamHeight = tempCanvas.height;
        
        // Draw video frame to canvas
        tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Get high-resolution image
        webcamImage = tempCanvas.toDataURL('image/jpeg', 0.95);
        
        // Create lower resolution version for preview
        const previewCanvas = document.createElement('canvas');
        const previewCtx = previewCanvas.getContext('2d');
        previewCanvas.width = 320;
        previewCanvas.height = 240;
        previewCtx.drawImage(videoElement, 0, 0, previewCanvas.width, previewCanvas.height);
        webcamImagePreview = previewCanvas.toDataURL('image/jpeg', 0.8);
        
        // Clean up temporary canvas
        tempCanvas.remove();
        previewCanvas.remove();
      } catch (webcamError) {
        console.error("Error capturing webcam:", webcamError);
        // Fallback: try to get webcam from video element directly
        try {
          const tempVideo = document.createElement('video');
          tempVideo.srcObject = videoElement.srcObject;
          await tempVideo.play();
          
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          tempCanvas.width = videoElement.videoWidth || 640;
          tempCanvas.height = videoElement.videoHeight || 480;
          
          webcamWidth = tempCanvas.width;
          webcamHeight = tempCanvas.height;
          
          tempCtx.drawImage(tempVideo, 0, 0, tempCanvas.width, tempCanvas.height);
          webcamImage = tempCanvas.toDataURL('image/jpeg', 0.95);
          
          tempVideo.pause();
          tempVideo.remove();
          tempCanvas.remove();
        } catch (fallbackErr) {
          console.error("All webcam capture methods failed:", fallbackErr);
          webcamWidth = 640;
          webcamHeight = 480;
        }
      }
    }

    // 1.3 Parameter data - Now including webcam resolution and user ID
    const csvData = [
      "name,value",
      `user_id,${userId}`,
      `dot_x,${point.x}`,
      `dot_y,${point.y}`,
      `canvas_width,${canvas?.width || 0}`,
      `canvas_height,${canvas?.height || 0}`,
      `window_width,${window.innerWidth}`,
      `window_height,${window.innerHeight}`,
      `webcam_resolution_width,${webcamWidth}`,
      `webcam_resolution_height,${webcamHeight}`,
      `timestamp,${new Date().toISOString()}`,
      `group_id,${captureGroupId}`
    ].join('\n');
    
    // 2. Save all files with the same group ID so they get the same number
    
    // 2.1 Save parameter file
    const paramResult = await saveCSVToUserServer(csvData, parameterFilename, captureGroupId);
    
    if (paramResult && paramResult.success) {
      captureNumber = paramResult.number;
      console.log(`Server assigned capture number: ${captureNumber} for group: ${captureGroupId}`);
    }
    
    // 2.2 Save screen image if available
    let screenResult = null;
    if (screenImage) {
      screenResult = await saveImageToUserServer(screenImage, screenFilename, 'screen', captureGroupId);
    }
    
    // 2.3 Save webcam image if available
    let webcamResult = null;
    if (webcamImage) {
      webcamResult = await saveImageToUserServer(webcamImage, webcamFilename, 'webcam', captureGroupId);
    }
    
    // 3. Show preview if needed - use the lower resolution version for preview
    if (showCapturePreview && typeof showCapturePreview === 'function') {
      showCapturePreview(screenImage, webcamImagePreview || webcamImage, point);
    }
    
    // 4. Increment counter for next capture
    if (setCaptureCount && typeof setCaptureCount === 'function') {
      setCaptureCount(prevCount => prevCount + 1);
    }
    
    // 5. Return results
    return {
      success: true,
      captureId: captureGroupId,
      captureNumber: captureNumber,
      screenImage: screenImage,
      webcamImage: webcamImage,
      userId: userId,
      results: {
        parameter: paramResult,
        screen: screenResult,
        webcam: webcamResult
      }
    };
    
  } catch (error) {
    console.error('❌ Error in captureImagesAtUserPoint:', error);
    throw error;
  }
};
