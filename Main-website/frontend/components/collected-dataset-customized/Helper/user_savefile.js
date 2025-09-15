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
 * Load selected cameras from localStorage
 * @returns {Array} - Array of selected camera IDs
 */
const loadSelectedCamerasFromStorage = () => {
  if (typeof window !== 'undefined') {
    try {
      const storedCameras = localStorage.getItem('selectedCameras');
      const storedCameraData = localStorage.getItem('selectedCamerasData');
      
      if (storedCameras) {
        const parsedCameras = JSON.parse(storedCameras);
        if (Array.isArray(parsedCameras) && parsedCameras.length > 0) {
          console.log('Loaded selected cameras from localStorage for capture:', parsedCameras);
          
          // Load camera data with tags if available
          if (storedCameraData) {
            try {
              const parsedCameraData = JSON.parse(storedCameraData);
              console.log('Loaded camera data with tags for capture:', parsedCameraData);
            } catch (dataError) {
              console.warn('Error parsing camera data for capture:', dataError);
            }
          }
          
          return parsedCameras;
        }
      }
    } catch (error) {
      console.warn('Error loading selected cameras from localStorage:', error);
    }
  }
  return [];
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
    
    console.log(`🔄 Attempting to save ${type} file for user ${userId}:`, {
      filename,
      type,
      captureGroup,
      imageDataLength: imageData?.length || 0,
      hasImageData: !!imageData
    });
    
    const requestBody = { 
      imageData, 
      filename, 
      type,
      captureGroup
    };
    
    console.log('📤 Sending request to:', `/api/user-captures/save/${userId}`);
    console.log('📤 Request body keys:', Object.keys(requestBody));
    
    const response = await fetch(`/api/user-captures/save/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log(`📥 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Server error response:', errorData);
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Successfully saved ${type} file for user ${userId}:`, result);
    return result;
  } catch (error) {
    console.error(`❌ Error saving ${type} file:`, error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
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
    
    console.log(`🔄 Attempting to save CSV file for user ${userId}:`, {
      filename,
      captureGroup,
      csvDataLength: csvData?.length || 0,
      hasCsvData: !!csvData
    });
    
    // Convert CSV data to base64
    const base64Data = btoa(unescape(encodeURIComponent(csvData)));
    const dataUrl = `data:text/csv;base64,${base64Data}`;
    
    console.log('📤 Sending CSV request to:', `/api/user-captures/save/${userId}`);
    
    const response = await fetch(`/api/user-captures/save/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
      },
      body: JSON.stringify({ 
        imageData: dataUrl, 
        filename, 
        type: 'parameters',
        captureGroup
      })
    });
    
    console.log(`📥 CSV Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ CSV Server error response:', errorData);
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Successfully saved CSV file for user ${userId}:`, result);
    return result;
  } catch (error) {
    console.error(`❌ Error saving CSV file:`, error);
    console.error('CSV Error details:', {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
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
        'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
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
        'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
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
    console.log(`🎯 Starting user-specific capture for user: ${userId}`);
    console.log(`📍 Capture point: x=${point.x}, y=${point.y}`);
    
    // Create a unique ID for this capture group
    const captureGroupId = `capture-${Date.now()}-${userId}`;
    console.log(`🆔 Generated capture group ID: ${captureGroupId}`);
    
    // File patterns for saving
    const screenFilename = 'screen_001.jpg';
    const webcamFilename = 'webcam_001.jpg';
    const subWebcamFilename = 'webcam_sub_001.jpg';
    const parameterFilename = 'parameter_001.csv';
    
    const canvas = canvasRef.current;
    let screenImage = null;
    let webcamImage = null;
    let captureNumber = null;
    
    // Variables to store webcam resolution
    let webcamWidth = 0;
    let webcamHeight = 0;
    
    console.log('📸 Starting image capture process...');
    
    // 1. Prepare all data first
    
    // 1.1 Canvas/screen image
    if (canvas) {
      screenImage = canvas.toDataURL('image/png');
      console.log(`📱 Screen image captured, length: ${screenImage.length}`);
    } else {
      console.warn('⚠️ No canvas available for screen capture');
    }

    // 1.2 Webcam image - Try to get the highest resolution available
    let webcamImagePreview = null;
    const videoElement = window.videoElement || document.querySelector('video');
    
    console.log('📹 Video element for capture:', {
      found: !!videoElement,
      videoWidth: videoElement?.videoWidth,
      videoHeight: videoElement?.videoHeight,
      readyState: videoElement?.readyState,
      srcObject: !!videoElement?.srcObject
    });
    
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
        
        // Draw video frame to canvas - remove horizontal mirroring for capture
        // The video element has scaleX(-1) for display, but we want the original orientation for capture
        tempCtx.save();
        tempCtx.scale(-1, 1); // Mirror horizontally to counteract the display mirroring
        tempCtx.translate(-tempCanvas.width, 0); // Move to correct position after scaling
        tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.restore();
        
        // Get high-resolution image
        webcamImage = tempCanvas.toDataURL('image/jpeg', 0.95);
        console.log('📷 Webcam image captured successfully:', {
          width: tempCanvas.width,
          height: tempCanvas.height,
          imageLength: webcamImage.length
        });
        
        // Create lower resolution version for preview
        const previewCanvas = document.createElement('canvas');
        const previewCtx = previewCanvas.getContext('2d');
        previewCanvas.width = 320;
        previewCanvas.height = 240;
        // Also fix the preview image orientation
        previewCtx.save();
        previewCtx.scale(-1, 1);
        previewCtx.translate(-previewCanvas.width, 0);
        previewCtx.drawImage(videoElement, 0, 0, previewCanvas.width, previewCanvas.height);
        previewCtx.restore();
        webcamImagePreview = previewCanvas.toDataURL('image/jpeg', 0.8);
        
        console.log('🖼️ Preview image created:', {
          width: previewCanvas.width,
          height: previewCanvas.height,
          imageLength: webcamImagePreview.length
        });
        
        // Clean up temporary canvas
        tempCanvas.remove();
        previewCanvas.remove();
      } catch (webcamError) {
        console.error("❌ Error capturing webcam:", webcamError);
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
          
          // Also fix the fallback capture orientation
          tempCtx.save();
          tempCtx.scale(-1, 1);
          tempCtx.translate(-tempCanvas.width, 0);
          tempCtx.drawImage(tempVideo, 0, 0, tempCanvas.width, tempCanvas.height);
          tempCtx.restore();
          webcamImage = tempCanvas.toDataURL('image/jpeg', 0.95);
          
          tempVideo.pause();
          tempVideo.remove();
          tempCanvas.remove();
        } catch (fallbackErr) {
          console.error("❌ All webcam capture methods failed:", fallbackErr);
          webcamWidth = 640;
          webcamHeight = 480;
        }
      }
    } else {
      console.warn('⚠️ No video element found for webcam capture');
    }

    // 1.3 Parameter data - Now including webcam resolution, user ID, and selected camera info with tags
    const selectedCameras = loadSelectedCamerasFromStorage();
    const cameraInfo = selectedCameras.length > 0 ? selectedCameras.join(';') : 'default';
    
    // Load camera data with tags
    let cameraDataInfo = 'default';
    if (typeof window !== 'undefined') {
      try {
        const storedCameraData = localStorage.getItem('selectedCamerasData');
        if (storedCameraData) {
          const parsedCameraData = JSON.parse(storedCameraData);
          cameraDataInfo = parsedCameraData.map(cam => `${cam.id}:${cam.tag}`).join(';');
        }
      } catch (error) {
        console.warn('Error loading camera data for CSV:', error);
      }
    }
    
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
      `selected_cameras,${cameraInfo}`,
      `camera_data,${cameraDataInfo}`,
      `camera_count,${selectedCameras.length}`,
      `timestamp,${new Date().toISOString()}`,
      `group_id,${captureGroupId}`
    ].join('\n');
    
    console.log('📊 Parameter data prepared:', {
      userId,
      captureGroupId,
      csvDataLength: csvData.length
    });
    
    // 2. Save all files with the same group ID so they get the same number
    
    console.log('💾 Starting file save process...');
    
    // 2.1 Save parameter file
    console.log('📄 Saving parameter file...');
    const paramResult = await saveCSVToUserServer(csvData, parameterFilename, captureGroupId);
    
    if (paramResult && paramResult.success) {
      captureNumber = paramResult.number;
      console.log(`✅ Server assigned capture number: ${captureNumber} for group: ${captureGroupId}`);
    } else {
      console.error('❌ Failed to save parameter file');
    }
    
    // 2.2 Save screen image if available
    let screenResult = null;
    if (screenImage) {
      console.log('📱 Saving screen image...');
      screenResult = await saveImageToUserServer(screenImage, screenFilename, 'screen', captureGroupId);
      if (screenResult && screenResult.success) {
        console.log('✅ Screen image saved successfully');
      } else {
        console.error('❌ Failed to save screen image');
      }
    } else {
      console.warn('⚠️ No screen image to save');
    }
    
    // 2.3 Save webcam image if available
    let webcamResult = null;
    if (webcamImage) {
      console.log('📷 Saving webcam image...');
      webcamResult = await saveImageToUserServer(webcamImage, webcamFilename, 'webcam', captureGroupId);
      if (webcamResult && webcamResult.success) {
        console.log('✅ Webcam image saved successfully');
      } else {
        console.error('❌ Failed to save webcam image');
      }
    } else {
      console.warn('⚠️ No webcam image to save');
    }
    
    // 3. Show preview if needed - use the lower resolution version for preview
    if (showCapturePreview && typeof showCapturePreview === 'function') {
      console.log('🖼️ Showing capture preview...');
      showCapturePreview(screenImage, webcamImagePreview || webcamImage, point);
    }
    
    // 4. Increment counter for next capture
    if (setCaptureCount && typeof setCaptureCount === 'function') {
      setCaptureCount(prevCount => prevCount + 1);
      console.log('🔢 Capture counter incremented');
    }
    
    // 5. Return results
    const result = {
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
    
    console.log('🎉 Capture completed successfully:', {
      captureId: captureGroupId,
      captureNumber: captureNumber,
      hasScreenImage: !!screenImage,
      hasWebcamImage: !!webcamImage,
      userId: userId,
      saveResults: {
        parameter: paramResult?.success,
        screen: screenResult?.success,
        webcam: webcamResult?.success
      }
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Error in captureImagesAtUserPoint:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
    throw error;
  }
};
