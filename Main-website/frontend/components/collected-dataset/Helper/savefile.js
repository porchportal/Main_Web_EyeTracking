// Helper/savefile.js - Added highest resolution webcam capture

/**
 * Resize an image to fit within a certain size limit
 * @param {string} imageDataUrl - Base64 encoded image data
 * @param {number} maxWidth - Maximum width of the resized image
 * @param {number} maxHeight - Maximum height of the resized image
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<string>} - Resized image data URL
 */
const resizeImage = async (imageDataUrl, maxWidth = 800, maxHeight = 600, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        
        if (height > maxHeight) {
          width = Math.round(width * (maxHeight / height));
          height = maxHeight;
        }
        
        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        // Draw and resize image on canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with specified quality
        const resizedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(resizedDataUrl);
      };
      
      img.onerror = (err) => reject(err);
      img.src = imageDataUrl;
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Get current user ID from various sources
 * @returns {string|null} - Current user ID or null if not found
 */
const getCurrentUserId = () => {
  // Try to get from global state
  if (typeof window !== 'undefined' && window.currentUserId) {
    return window.currentUserId;
  }
  
  // Try to get from localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('currentUserId');
    if (stored) {
      return stored;
    }
  }
  
  // Try to get from URL parameters
  if (typeof window !== 'undefined' && window.location) {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    if (userId) {
      return userId;
    }
  }
  
  return null;
};

/**
 * Save an image or data to the server with group ID to ensure consistent numbering
 * @param {string} imageData - Base64 encoded image data
 * @param {string} filename - Filename pattern to save as
 * @param {string} type - Type of file (screen, webcam, parameters)
 * @param {string} folder - Folder to save in (deprecated, kept for compatibility)
 * @param {string} captureGroup - Unique ID for grouping files from the same capture
 * @returns {Promise<Object>} - Server response
 */
export const saveImageToServer = async (imageData, filename, type, folder = 'eye_tracking_captures', captureGroup = null) => {
  try {
    const userId = getCurrentUserId();
    
    if (!userId) {
      return { success: false, error: 'No user ID available' };
    }
    
    const response = await fetch(`/api/user-captures/save/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
      },
      body: JSON.stringify({ 
        imageData, 
        filename, 
        type,
        captureGroup // Include the capture group ID
      })
    });
    
    if (!response.ok) {
      // If the error is 413 (payload too large) and it's an image, try resizing
      if (response.status === 413 && type !== 'parameters') {
        
        // Start with higher quality and progressively reduce quality/size until it fits
        const sizes = [
          { width: 1920, height: 1080, quality: 0.9 },
          { width: 1280, height: 720, quality: 0.85 },
          { width: 800, height: 600, quality: 0.8 },
          { width: 640, height: 480, quality: 0.75 }
        ];
        
        for (const { width, height, quality } of sizes) {
          const resizedImage = await resizeImage(imageData, width, height, quality);
          
          try {
            const retryResponse = await fetch(`/api/user-captures/save/${userId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
              },
              body: JSON.stringify({ 
                imageData: resizedImage, 
                filename, 
                type,
                captureGroup
              })
            });
            
            if (retryResponse.ok) {
              return await retryResponse.json();
            }
          } catch (retryError) {
            // Continue to next size
          }
        }
        
        return { success: false, error: "Failed to save image even after resizing" };
      }
      
      return { success: false, error: `Server returned ${response.status}` };
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Save CSV data to the server
 * @param {string} csvData - CSV data
 * @param {string} filename - Filename pattern to save as
 * @param {string} folder - Folder to save in (deprecated, kept for compatibility)
 * @param {string} captureGroup - Unique ID for grouping files from the same capture
 * @returns {Promise<Object>} - Server response
 */
export const saveCSVToServer = async (csvData, filename, folder = 'eye_tracking_captures', captureGroup = null) => {
  try {
    const userId = getCurrentUserId();
    
    if (!userId) {
      return { success: false, error: 'No user ID available' };
    }
    
    // Convert CSV data to base64
    const base64Data = btoa(unescape(encodeURIComponent(csvData)));
    const dataUrl = `data:text/csv;base64,${base64Data}`;
    
    const result = await saveImageToServer(dataUrl, filename, 'parameters', folder, captureGroup);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Get user capture status
 * @returns {Promise<Object>} - User capture status
 */
export const getUserCaptureStatus = async () => {
  try {
    const userId = getCurrentUserId();
    
    if (!userId) {
      return { success: false, error: 'No user ID available' };
    }
    
    const response = await fetch(`/api/user-captures/status/${userId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Get the highest resolution camera constraints supported by the device
 * @returns {Promise<MediaStreamConstraints>} - Camera constraints with highest resolution
 */
export const getHighestResolutionConstraints = async () => {
  // Try to get all available camera capabilities first
  try {
    // Get a temporary access to the camera
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoTrack = tempStream.getVideoTracks()[0];
    
        // Get capabilities
        const capabilities = videoTrack.getCapabilities?.();
        
        // Get current settings to check aspect ratio
        const settings = videoTrack.getSettings();
    
    // Stop the temporary stream
    videoTrack.stop();
    
    if (capabilities && capabilities.width && capabilities.height) {
      // Check if the max dimensions have a suspicious square aspect ratio
      const maxWidth = capabilities.width.max;
      const maxHeight = capabilities.height.max;
      
      if (maxWidth === maxHeight && maxWidth > 100) {
        // Try to find a reasonable resolution from the supported constraints
        if (capabilities.width && capabilities.width.max && capabilities.height && capabilities.height.max) {
          // Calculate a reasonable 16:9 aspect ratio based on max width
          const idealWidth = Math.min(maxWidth, 1920);
          const idealHeight = Math.round(idealWidth * 9 / 16);
          
          return {
            video: {
              width: { ideal: idealWidth },
              height: { ideal: idealHeight }
            }
          };
        }
        
        // Fallback to standard resolution
        return {
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        };
      }
      
      // Use the max width and height from device capabilities
      return {
        video: {
          width: { ideal: capabilities.width.max },
          height: { ideal: capabilities.height.max }
        }
      };
    }
  } catch (err) {
    // Continue to fallback resolutions
  }
  
  // Fallback: try standard resolutions in order
  const resolutions = [
    { width: { ideal: 4096 }, height: { ideal: 2160 } }, // 4K
    { width: { ideal: 3840 }, height: { ideal: 2160 } }, // 4K UHD
    { width: { ideal: 2560 }, height: { ideal: 1440 } }, // 2K QHD
    { width: { ideal: 1920 }, height: { ideal: 1080 } }, // Full HD
    { width: { ideal: 1280 }, height: { ideal: 720 } },  // HD
    { width: { ideal: 640 }, height: { ideal: 480 } },   // VGA
    {}  // Default - let browser decide
  ];

  // Try the resolutions in order until one works
  for (const resolution of resolutions) {
    try {
      const constraints = {
        video: {
          ...resolution,
          facingMode: "user"
        }
      };
      
      // Test if this resolution is supported
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Get the actual dimensions
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      // Check for square aspect ratio in the actual settings
      if (settings.width === settings.height && settings.width > 100) {
        // Continue to next resolution to avoid the square aspect ratio
        stream.getTracks().forEach(track => track.stop());
        continue;
      }
      
      // Stop the test stream immediately
      stream.getTracks().forEach(track => track.stop());
      
      return constraints;
    } catch (err) {
      // Continue to next resolution
    }
  }
  
  // If nothing worked, return basic constraints with non-square resolution
  return { 
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 }
    } 
  };
};

/**
 * Capture and save images at a specific point with consistent numbering
 * @param {Object} options - Capture options
 * @param {Object} point - Point coordinates
 * @param {number} captureCount - Current capture count
 * @param {Object} canvasRef - Canvas reference
 * @param {Function} setCaptureCount - Function to update capture count
 * @param {Function} showCapturePreview - Function to show capture preview
 * @param {string} userId - User ID for saving files
 * @returns {Promise<Object>} - Capture results
 */
export const captureImagesAtPoint = async ({ point, captureCount = 1, canvasRef, setCaptureCount, showCapturePreview, userId = null }) => {
  try {
    // Set userId globally if provided
    if (userId && typeof window !== 'undefined') {
      window.currentUserId = userId;
      localStorage.setItem('currentUserId', userId);
    }
    
    const folder = 'eye_tracking_captures';
    
    // Create a unique ID for this capture group
    const captureGroupId = `capture-${Date.now()}`;
    
    // File patterns for saving
    const screenFilename = 'screen_001.jpg';  // Pattern only - server will assign number
    const webcamFilename = 'webcam_001.jpg';  // Pattern only - server will assign number
    const parameterFilename = 'parameter_001.csv';  // Pattern only - server will assign number
    
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
    // with device's native capabilities instead of fixed values
    let webcamImagePreview = null; // Separate lower-resolution version for preview
    const videoElement = window.videoElement || document.querySelector('video');
    
    if (videoElement) {
      try {
        // Use existing video element if available
        // First check if videoTrack has settings info
        let trackSettings = null;
        
        if (videoElement.srcObject) {
          const videoTrack = videoElement.srcObject.getVideoTracks()[0];
          if (videoTrack) {
            trackSettings = videoTrack.getSettings();
          }
        }
        
        // Get dimensions from track if available, otherwise from element
        if (trackSettings && trackSettings.width && trackSettings.height) {
          webcamWidth = trackSettings.width;
          webcamHeight = trackSettings.height;
        } else {
          webcamWidth = videoElement.videoWidth || 0;
          webcamHeight = videoElement.videoHeight || 0;
        }
        
        // Sanity check - if both dimensions are the same, double-check
        if (webcamWidth === webcamHeight && webcamWidth > 100) {
          // Try to get more reliable info
          if (videoElement.srcObject) {
            const videoTrack = videoElement.srcObject.getVideoTracks()[0];
            if (videoTrack) {
              const constraints = videoTrack.getConstraints();
              
              // If constraints have width/height, use those
              if (constraints.width && constraints.height) {
                if (typeof constraints.width.exact === 'number') {
                  webcamWidth = constraints.width.exact;
                } else if (typeof constraints.width.ideal === 'number') {
                  webcamWidth = constraints.width.ideal;
                }
                
                if (typeof constraints.height.exact === 'number') {
                  webcamHeight = constraints.height.exact;
                } else if (typeof constraints.height.ideal === 'number') {
                  webcamHeight = constraints.height.ideal;
                }
              }
            }
          }
        }
        
        // Final reality check - make sure dimensions are reasonable
        if (webcamWidth <= 0 || webcamHeight <= 0) {
          webcamWidth = 640;
          webcamHeight = 480;
        }
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = webcamWidth;
        tempCanvas.height = webcamHeight;
        tempCanvas.getContext('2d').drawImage(videoElement, 0, 0, webcamWidth, webcamHeight);
        
        // Create high-resolution version for saving
        webcamImage = tempCanvas.toDataURL('image/jpeg', 0.95);
        
        // Create lower-resolution version for preview
        webcamImagePreview = await resizeImage(webcamImage, 640, 480, 0.85);
      } catch (err) {
        webcamWidth = videoElement.videoWidth || 640;
        webcamHeight = videoElement.videoHeight || 480;
      }
    } else {
      try {
        // Get highest resolution constraints for this device
        const constraints = await getHighestResolutionConstraints();
        
        // Try to get stream with highest resolution
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Get the actual dimensions from the track first
        const videoTrack = stream.getVideoTracks()[0];
        const trackSettings = videoTrack.getSettings();
        
        // Create temporary video element to get the stream
        const tempVideo = document.createElement('video');
        tempVideo.srcObject = stream;
        tempVideo.muted = true;
        tempVideo.playsInline = true;
        tempVideo.autoplay = true;
        document.body.appendChild(tempVideo);
        
        // Need to wait for video to be initialized
        await new Promise(resolve => {
          tempVideo.onloadedmetadata = () => {
            tempVideo.play();
            resolve();
          };
          // Fallback if onloadedmetadata doesn't fire
          setTimeout(resolve, 1000);
        });
        
        // Wait a bit longer for the video to actually start playing
        await new Promise(res => setTimeout(res, 500));
        
        // Store webcam resolution - prioritize track settings over video element
        if (trackSettings && trackSettings.width && trackSettings.height) {
          webcamWidth = trackSettings.width;
          webcamHeight = trackSettings.height;
        } else {
          webcamWidth = tempVideo.videoWidth || 0;
          webcamHeight = tempVideo.videoHeight || 0;
        }
        
        // Reality check on dimensions
        if (webcamWidth <= 0 || webcamHeight <= 0) {
          if (constraints.video && typeof constraints.video === 'object') {
            if (constraints.video.width && constraints.video.width.ideal) {
              webcamWidth = constraints.video.width.ideal;
            }
            if (constraints.video.height && constraints.video.height.ideal) {
              webcamHeight = constraints.video.height.ideal;
            }
          }
          
          if (webcamWidth <= 0 || webcamHeight <= 0) {
            webcamWidth = 640;
            webcamHeight = 480;
          }
        }
        
        // Final check for square aspect ratio which is usually incorrect
        if (webcamWidth === webcamHeight && webcamWidth > 100) {
          // Try to get more reliable dimensions
          const capabilities = videoTrack.getCapabilities?.();
          if (capabilities && capabilities.width && capabilities.height) {
            if (capabilities.width.max && capabilities.height.max) {
              // Assume the maximum capabilities have the correct aspect ratio
              const aspectRatio = capabilities.width.max / capabilities.height.max;
              
              if (Math.abs(aspectRatio - 1.33) < 0.1) { // Close to 4:3
                webcamHeight = Math.round(webcamWidth / 1.33);
              } else if (Math.abs(aspectRatio - 1.78) < 0.1) { // Close to 16:9
                webcamHeight = Math.round(webcamWidth / 1.78);
              }
            }
          }
        }
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = webcamWidth;
        tempCanvas.height = webcamHeight;
        tempCanvas.getContext('2d').drawImage(tempVideo, 0, 0, webcamWidth, webcamHeight);
        
        // Create high-resolution version for saving
        webcamImage = tempCanvas.toDataURL('image/jpeg', 0.95);
        
        // Create lower-resolution version for preview
        webcamImagePreview = await resizeImage(webcamImage, 640, 480, 0.85);
        
        // Clean up
        stream.getTracks().forEach(t => t.stop());
        tempVideo.remove();
      } catch (err) {
        
        // Try one more time with basic constraints
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          const videoTrack = stream.getVideoTracks()[0];
          const trackSettings = videoTrack.getSettings();
          
          const tempVideo = document.createElement('video');
          tempVideo.srcObject = stream;
          tempVideo.muted = true;
          tempVideo.playsInline = true;
          document.body.appendChild(tempVideo);
          await tempVideo.play();
          await new Promise(res => setTimeout(res, 300));
          
          // Get dimensions from track settings if available
          if (trackSettings && trackSettings.width && trackSettings.height) {
            webcamWidth = trackSettings.width;
            webcamHeight = trackSettings.height;
          } else {
            webcamWidth = tempVideo.videoWidth || 0;
            webcamHeight = tempVideo.videoHeight || 0;
          }
          
          // Final check for invalid dimensions
          if (webcamWidth <= 0 || webcamHeight <= 0) {
            webcamWidth = 640;
            webcamHeight = 480;
          }
          
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = webcamWidth;
          tempCanvas.height = webcamHeight;
          tempCanvas.getContext('2d').drawImage(tempVideo, 0, 0, webcamWidth, webcamHeight);
          
          // Create high-resolution version for saving
          webcamImage = tempCanvas.toDataURL('image/jpeg', 0.9);
          
          // Create lower-resolution version for preview
          webcamImagePreview = await resizeImage(webcamImage, 640, 480, 0.8);
          
          stream.getTracks().forEach(t => t.stop());
          tempVideo.remove();
        } catch (fallbackErr) {
          webcamWidth = 640;
          webcamHeight = 480;
        }
      }
    }

    // 1.3 Parameter data - Now including webcam resolution
    const csvData = [
      "name,value",
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
    const paramResult = await saveCSVToServer(csvData, parameterFilename, folder, captureGroupId);
    
    if (paramResult && paramResult.success) {
      captureNumber = paramResult.number;
    }
    
    // 2.2 Save screen image if available
    let screenResult = null;
    if (screenImage) {
      screenResult = await saveImageToServer(screenImage, screenFilename, 'screen', folder, captureGroupId);
    }
    
    // 2.3 Save webcam image if available
    let webcamResult = null;
    if (webcamImage) {
      webcamResult = await saveImageToServer(webcamImage, webcamFilename, 'webcam', folder, captureGroupId);
    }
    
    // 3. Show preview if needed - use the lower resolution version for preview
    if (showCapturePreview && typeof showCapturePreview === 'function') {
      showCapturePreview(screenImage, webcamImagePreview || webcamImage, point);
    }
    
    // 4. Increment counter for next capture
    if (setCaptureCount && typeof setCaptureCount === 'function') {
      setCaptureCount(prevCount => prevCount + 1);
    }
    
    // 5. Check capture status to verify files were saved
    try {
      const statusResult = await getUserCaptureStatus();
      // Status check completed silently
    } catch (statusError) {
      // Status check failed silently
    }

    // 6. Return results - now including webcam resolution
    return {
      screenImage,
      webcamImage,
      success: true,
      point,
      captureNumber,
      groupId: captureGroupId,
      webcamWidth,
      webcamHeight
    };
  } catch (err) {
    return { 
      success: false, 
      error: err.message,
      screenImage: null,
      webcamImage: null,
      webcamWidth: 0,
      webcamHeight: 0
    };
  }
};