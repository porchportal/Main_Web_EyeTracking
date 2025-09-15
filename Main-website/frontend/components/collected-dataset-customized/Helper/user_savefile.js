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
 * Get highest resolution camera constraints for a specific device
 * @param {string} deviceId - Camera device ID
 * @returns {Promise<Object>} - Camera constraints with highest resolution
 */
const getHighestResolutionConstraints = async (deviceId = null) => {
  try {
    console.log('🔍 Getting highest resolution constraints for device:', deviceId);
    
    // Get all video input devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    if (videoDevices.length === 0) {
      console.warn('No video devices found, using default constraints');
      return { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
    }
    
    // Use specified device or first available
    const targetDevice = deviceId ? 
      videoDevices.find(device => device.deviceId === deviceId) : 
      videoDevices[0];
    
    if (!targetDevice) {
      console.warn('Target device not found, using first available');
      return { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
    }
    
    console.log('🎯 Using device:', targetDevice.label || targetDevice.deviceId);
    
    // Try to get capabilities for the target device
    const constraints = { 
      video: { 
        deviceId: { exact: targetDevice.deviceId },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      } 
    };
    
    // Test the constraints to see what's actually supported
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const videoTrack = stream.getVideoTracks()[0];
    
    if (!videoTrack) {
      stream.getTracks().forEach(track => track.stop());
      console.warn('No video track found, using fallback constraints');
      return { video: { deviceId: { exact: targetDevice.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } };
    }
    
    // Get the actual settings being used
    const settings = videoTrack.getSettings();
    console.log('📊 Actual video settings:', settings);
    
    // Get capabilities if available
    let capabilities = null;
    if (videoTrack.getCapabilities) {
      capabilities = videoTrack.getCapabilities();
      console.log('📊 Video capabilities:', capabilities);
    }
    
    // Stop the test stream
    stream.getTracks().forEach(track => track.stop());
    
    // Determine the best resolution
    let bestWidth = 1280; // Default minimum
    let bestHeight = 720;
    
    if (capabilities && capabilities.width && capabilities.height) {
      // Use the maximum available resolution
      bestWidth = Math.max(...capabilities.width.values);
      bestHeight = Math.max(...capabilities.height.values);
      console.log('🎯 Maximum supported resolution:', bestWidth, 'x', bestHeight);
    } else if (settings.width && settings.height) {
      // Use the settings from the test stream
      bestWidth = settings.width;
      bestHeight = settings.height;
      console.log('🎯 Test stream resolution:', bestWidth, 'x', bestHeight);
    }
    
    // Ensure minimum resolution of 640x480
    bestWidth = Math.max(bestWidth, 640);
    bestHeight = Math.max(bestHeight, 480);
    
    console.log('✅ Final resolution constraints:', bestWidth, 'x', bestHeight);
    
    return {
      video: {
        deviceId: { exact: targetDevice.deviceId },
        width: { ideal: bestWidth },
        height: { ideal: bestHeight },
        frameRate: { ideal: 30 }
      }
    };
    
  } catch (error) {
    console.warn('Error getting camera constraints, using fallback:', error);
    return { 
      video: { 
        deviceId: deviceId ? { exact: deviceId } : true,
        width: { ideal: 1280 }, 
        height: { ideal: 720 } 
      } 
    };
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
    
    // File patterns for saving - will be updated with actual numbers by backend
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

    // 1.2 Webcam images - Support for dual camera capture with main/submain tags
    let webcamImagePreview = null;
    let subWebcamImage = null;
    let subWebcamImagePreview = null;
    let webcamWidth1 = 0;
    let webcamHeight1 = 0;
    
    // Get video elements for both cameras
    const videoElement = window.videoElement || document.querySelector('video');
    
    // For sub camera, we need to find the second video element
    // Try multiple methods to find the sub camera video element
    let subVideoElement = window.subVideoElement || document.querySelector('video[data-camera-index="1"]');
    
    // If subVideoElement not found, try to find all video elements and get the second one
    if (!subVideoElement) {
      const allVideoElements = document.querySelectorAll('video');
      console.log('🔍 All video elements found:', allVideoElements.length);
      console.log('🔍 Video elements details:', Array.from(allVideoElements).map((video, index) => ({
        index,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        srcObject: !!video.srcObject,
        cameraIndex: video.getAttribute('data-camera-index'),
        cameraTag: video.getAttribute('data-camera-tag'),
        isMainVideo: video === videoElement
      })));
      
      if (allVideoElements.length > 1) {
        // Find the video element that's not the main one
        for (let i = 0; i < allVideoElements.length; i++) {
          const video = allVideoElements[i];
          if (video !== videoElement && video.srcObject) {
            subVideoElement = video;
            console.log('✅ Found sub video element at index:', i);
            console.log('✅ Sub video element details:', {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState,
              srcObject: !!video.srcObject,
              cameraIndex: video.getAttribute('data-camera-index'),
              cameraTag: video.getAttribute('data-camera-tag')
            });
            break;
          }
        }
      }
    }
    
    console.log('📹 Video elements for capture:', {
      mainVideo: {
      found: !!videoElement,
      videoWidth: videoElement?.videoWidth,
      videoHeight: videoElement?.videoHeight,
      readyState: videoElement?.readyState,
        srcObject: !!videoElement?.srcObject,
        cameraIndex: videoElement?.getAttribute('data-camera-index'),
        cameraTag: videoElement?.getAttribute('data-camera-tag')
      },
      subVideo: {
        found: !!subVideoElement,
        videoWidth: subVideoElement?.videoWidth,
        videoHeight: subVideoElement?.videoHeight,
        readyState: subVideoElement?.readyState,
        srcObject: !!subVideoElement?.srcObject,
        cameraIndex: subVideoElement?.getAttribute('data-camera-index'),
        cameraTag: subVideoElement?.getAttribute('data-camera-tag')
      },
      allVideoElements: document.querySelectorAll('video').length,
      selectedCameras: selectedCameras,
      windowVideoElement: !!window.videoElement,
      windowSubVideoElement: !!window.subVideoElement
    });
    
    // Debug: Check if we should have a sub camera
    if (selectedCameras.length > 1 && !subVideoElement) {
      console.warn('⚠️ WARNING: 2 cameras selected but no sub video element found!');
      console.warn('⚠️ This means sub camera capture will be skipped');
      console.warn('⚠️ Selected cameras:', selectedCameras);
      console.warn('⚠️ All video elements on page:', document.querySelectorAll('video').length);
      console.warn('⚠️ Window video elements:', {
        main: !!window.videoElement,
        sub: !!window.subVideoElement
      });
    }
    
    // Capture main camera (tag: main)
    if (videoElement) {
      try {
        // Get the highest resolution constraints for main camera
        const selectedCameras = loadSelectedCamerasFromStorage();
        const mainCameraId = selectedCameras.length > 0 ? selectedCameras[0] : null;
        const mainConstraints = await getHighestResolutionConstraints(mainCameraId);
        
        console.log('📷 Main camera constraints:', mainConstraints);
        
        // Create a temporary canvas to capture main webcam
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Use the highest resolution from constraints or video element dimensions
        const idealWidth = mainConstraints.video.width?.ideal || videoElement.videoWidth || 1920;
        const idealHeight = mainConstraints.video.height?.ideal || videoElement.videoHeight || 1080;
        
        // Set canvas size to the higher of ideal resolution or current video dimensions
        tempCanvas.width = Math.max(idealWidth, videoElement.videoWidth || 1280);
        tempCanvas.height = Math.max(idealHeight, videoElement.videoHeight || 720);
        
        // Ensure minimum resolution of 640x480
        tempCanvas.width = Math.max(tempCanvas.width, 640);
        tempCanvas.height = Math.max(tempCanvas.height, 480);
        
        console.log('📷 Main camera capture resolution:', tempCanvas.width, 'x', tempCanvas.height);
        
        // Store main webcam resolution
        webcamWidth = tempCanvas.width;
        webcamHeight = tempCanvas.height;
        
        console.log('📷 Main camera capture resolution:', webcamWidth, 'x', webcamHeight);
        
        // Draw video frame to canvas - remove horizontal mirroring for capture
        tempCtx.save();
        tempCtx.scale(-1, 1); // Mirror horizontally to counteract the display mirroring
        tempCtx.translate(-tempCanvas.width, 0); // Move to correct position after scaling
        tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.restore();
        
        // Get high-resolution image
        webcamImage = tempCanvas.toDataURL('image/jpeg', 0.95);
        console.log('📷 Main webcam image captured successfully:', {
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
        
        console.log('🖼️ Main preview image created:', {
          width: previewCanvas.width,
          height: previewCanvas.height,
          imageLength: webcamImagePreview.length
        });
        
        // Clean up temporary canvas
        tempCanvas.remove();
        previewCanvas.remove();
      } catch (webcamError) {
        console.error("❌ Error capturing main webcam:", webcamError);
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
          console.error("❌ All main webcam capture methods failed:", fallbackErr);
          // Use minimum resolution as fallback
          webcamWidth = 640;
          webcamHeight = 480;
        }
      }
    } else {
      console.warn('⚠️ No main video element found for webcam capture');
    }
    
    // Capture sub camera (tag: submain) if available
    if (subVideoElement) {
      try {
        console.log('📷 Sub video element found, attempting capture...');
        console.log('📷 Sub video element details:', {
          videoWidth: subVideoElement.videoWidth,
          videoHeight: subVideoElement.videoHeight,
          readyState: subVideoElement.readyState,
          srcObject: !!subVideoElement.srcObject,
          cameraIndex: subVideoElement.getAttribute('data-camera-index'),
          cameraTag: subVideoElement.getAttribute('data-camera-tag')
        });
        
        // Get the highest resolution constraints for sub camera
        const selectedCameras = loadSelectedCamerasFromStorage();
        const subCameraId = selectedCameras.length > 1 ? selectedCameras[1] : null;
        const subConstraints = await getHighestResolutionConstraints(subCameraId);
        
        console.log('📷 Sub camera constraints:', subConstraints);
        
        // Create a temporary canvas to capture sub webcam
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Use the highest resolution from constraints or video element dimensions
        const idealWidth = subConstraints.video.width?.ideal || subVideoElement.videoWidth || 1920;
        const idealHeight = subConstraints.video.height?.ideal || subVideoElement.videoHeight || 1080;
        
        // Set canvas size to the higher of ideal resolution or current video dimensions
        tempCanvas.width = Math.max(idealWidth, subVideoElement.videoWidth || 1280);
        tempCanvas.height = Math.max(idealHeight, subVideoElement.videoHeight || 720);
        
        // Ensure minimum resolution of 640x480
        tempCanvas.width = Math.max(tempCanvas.width, 640);
        tempCanvas.height = Math.max(tempCanvas.height, 480);
        
        console.log('📷 Sub camera capture resolution:', tempCanvas.width, 'x', tempCanvas.height);
        
        // Store sub webcam resolution
        webcamWidth1 = tempCanvas.width;
        webcamHeight1 = tempCanvas.height;
        
        console.log('📷 Sub camera capture resolution:', webcamWidth1, 'x', webcamHeight1);
        
        // Draw video frame to canvas - remove horizontal mirroring for capture
        tempCtx.save();
        tempCtx.scale(-1, 1); // Mirror horizontally to counteract the display mirroring
        tempCtx.translate(-tempCanvas.width, 0); // Move to correct position after scaling
        tempCtx.drawImage(subVideoElement, 0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.restore();
        
        // Get high-resolution image
        subWebcamImage = tempCanvas.toDataURL('image/jpeg', 0.95);
        console.log('📷 Sub webcam image captured successfully:', {
          width: tempCanvas.width,
          height: tempCanvas.height,
          imageLength: subWebcamImage.length
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
        previewCtx.drawImage(subVideoElement, 0, 0, previewCanvas.width, previewCanvas.height);
        previewCtx.restore();
        subWebcamImagePreview = previewCanvas.toDataURL('image/jpeg', 0.8);
        
        console.log('🖼️ Sub preview image created:', {
          width: previewCanvas.width,
          height: previewCanvas.height,
          imageLength: subWebcamImagePreview.length
        });
        
        // Clean up temporary canvas
        tempCanvas.remove();
        previewCanvas.remove();
      } catch (webcamError) {
        console.error("❌ Error capturing sub webcam:", webcamError);
        // Fallback: try to get webcam from video element directly
        try {
          const tempVideo = document.createElement('video');
          tempVideo.srcObject = subVideoElement.srcObject;
          await tempVideo.play();
          
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          tempCanvas.width = subVideoElement.videoWidth || 640;
          tempCanvas.height = subVideoElement.videoHeight || 480;
          
          webcamWidth1 = tempCanvas.width;
          webcamHeight1 = tempCanvas.height;
          
          // Also fix the fallback capture orientation
          tempCtx.save();
          tempCtx.scale(-1, 1);
          tempCtx.translate(-tempCanvas.width, 0);
          tempCtx.drawImage(tempVideo, 0, 0, tempCanvas.width, tempCanvas.height);
          tempCtx.restore();
          subWebcamImage = tempCanvas.toDataURL('image/jpeg', 0.95);
          
          tempVideo.pause();
          tempVideo.remove();
          tempCanvas.remove();
        } catch (fallbackErr) {
          console.error("❌ All sub webcam capture methods failed:", fallbackErr);
          // Use minimum resolution as fallback
          webcamWidth1 = 640;
          webcamHeight1 = 480;
        }
      }
    } else {
      console.log('ℹ️ No sub video element found - single camera mode');
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
    
    // Build CSV data based on camera count
    const csvDataArray = [
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
    ];
    
    // Only add sub camera resolution fields if 2 cameras are selected
    if (selectedCameras.length > 1) {
      csvDataArray.splice(10, 0, `webcam_resolution_width_1,${webcamWidth1}`);
      csvDataArray.splice(11, 0, `webcam_resolution_height_1,${webcamHeight1}`);
    }
    
    const csvData = csvDataArray.join('\n');
    
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
    
    // 2.3 Save main webcam image if available (tag: main)
    let webcamResult = null;
    if (webcamImage) {
      console.log('📷 Saving main webcam image...');
      webcamResult = await saveImageToUserServer(webcamImage, webcamFilename, 'webcam', captureGroupId);
      if (webcamResult && webcamResult.success) {
        console.log('✅ Main webcam image saved successfully');
      } else {
        console.error('❌ Failed to save main webcam image');
      }
    } else {
      console.warn('⚠️ No main webcam image to save');
    }
    
    // 2.4 Save sub webcam image if available (tag: submain)
    let subWebcamResult = null;
    if (subWebcamImage) {
      console.log('📷 Saving sub webcam image...');
      console.log('📷 Sub webcam image details:', {
        hasImage: !!subWebcamImage,
        imageLength: subWebcamImage?.length || 0,
        filename: subWebcamFilename,
        type: 'webcam_sub',
        captureGroupId
      });
      subWebcamResult = await saveImageToUserServer(subWebcamImage, subWebcamFilename, 'webcam_sub', captureGroupId);
      if (subWebcamResult && subWebcamResult.success) {
        console.log('✅ Sub webcam image saved successfully');
      } else {
        console.error('❌ Failed to save sub webcam image');
      }
    } else {
      console.log('ℹ️ No sub webcam image to save (single camera mode)');
      console.log('ℹ️ Sub webcam image check:', {
        hasSubWebcamImage: !!subWebcamImage,
        subWebcamImageLength: subWebcamImage?.length || 0,
        selectedCameras: selectedCameras,
        hasSubVideoElement: !!subVideoElement
      });
    }
    
    // 3. Show preview if needed - use the lower resolution version for preview
    if (showCapturePreview && typeof showCapturePreview === 'function') {
      console.log('🖼️ Showing capture preview...');
      showCapturePreview(screenImage, webcamImagePreview || webcamImage, subWebcamImagePreview || subWebcamImage, point);
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
      subWebcamImage: subWebcamImage,
      userId: userId,
      results: {
        parameter: paramResult,
        screen: screenResult,
        webcam: webcamResult,
        subWebcam: subWebcamResult
      }
    };
    
    console.log('🎉 Capture completed successfully:', {
      captureId: captureGroupId,
      captureNumber: captureNumber,
      hasScreenImage: !!screenImage,
      hasWebcamImage: !!webcamImage,
      hasSubWebcamImage: !!subWebcamImage,
      userId: userId,
      saveResults: {
        parameter: paramResult?.success,
        screen: screenResult?.success,
        webcam: webcamResult?.success,
        subWebcam: subWebcamResult?.success
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
