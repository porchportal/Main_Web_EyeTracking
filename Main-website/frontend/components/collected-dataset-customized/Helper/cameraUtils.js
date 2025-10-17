// cameraUtils.js - Shared camera utility functions
// This file contains common camera-related functions used across the application

/**
 * Load selected cameras from localStorage
 * @returns {Array} - Array of selected camera IDs
 */
export const loadSelectedCamerasFromStorage = () => {
  if (typeof window !== 'undefined') {
    try {
      const storedCameras = localStorage.getItem('selectedCameras');
      const storedCameraData = localStorage.getItem('selectedCamerasData');

      if (storedCameras) {
        const parsedCameras = JSON.parse(storedCameras);
        if (Array.isArray(parsedCameras) && parsedCameras.length > 0) {
          // Load camera data with tags if available
          if (storedCameraData) {
            try {
              const parsedCameraData = JSON.parse(storedCameraData);
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
 * @param {string} deviceId - Camera device ID (optional)
 * @returns {Promise<Object>} - Camera constraints with highest resolution
 */
export const getHighestResolutionConstraints = async (deviceId = null) => {
  try {

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

    // Get capabilities if available
    let capabilities = null;
    if (videoTrack.getCapabilities) {
      capabilities = videoTrack.getCapabilities();
    }

    // Stop the test stream
    stream.getTracks().forEach(track => track.stop());

    // Determine the best resolution
    let bestWidth = 1920; // Default to Full HD
    let bestHeight = 1080;

    if (capabilities) {
      // Try to get max resolution from capabilities
      if (capabilities.width && capabilities.height) {
        // Check if capabilities has max property
        if (capabilities.width.max && capabilities.height.max) {
          bestWidth = capabilities.width.max;
          bestHeight = capabilities.height.max;
        }
        // Check if capabilities has values array (some browsers)
        else if (Array.isArray(capabilities.width.values) && Array.isArray(capabilities.height.values)) {
          bestWidth = Math.max(...capabilities.width.values);
          bestHeight = Math.max(...capabilities.height.values);
        }
        // Fallback: use min/max range if available
        else if (typeof capabilities.width === 'object' && typeof capabilities.height === 'object') {
          bestWidth = capabilities.width.max || capabilities.width.ideal || 1920;
          bestHeight = capabilities.height.max || capabilities.height.ideal || 1080;
        }
      }
    }

    // If capabilities detection failed, try a high-resolution test
    if (bestWidth <= 1920 && bestHeight <= 1080) {
      try {
        // Test if 4K is supported
        const test4K = {
          video: {
            deviceId: { exact: targetDevice.deviceId },
            width: { ideal: 3840 },
            height: { ideal: 2160 }
          }
        };
        const testStream = await navigator.mediaDevices.getUserMedia(test4K);
        const testTrack = testStream.getVideoTracks()[0];
        const testSettings = testTrack.getSettings();

        if (testSettings.width && testSettings.height) {
          bestWidth = testSettings.width;
          bestHeight = testSettings.height;
        }

        testStream.getTracks().forEach(track => track.stop());
      } catch (test4KError) {
        // 4K not supported, stick with detected resolution
        console.log('4K test failed, using detected resolution:', bestWidth, 'x', bestHeight);
      }
    }

    // Ensure minimum resolution of 640x480
    bestWidth = Math.max(bestWidth, 640);
    bestHeight = Math.max(bestHeight, 480);


    return {
      video: {
        deviceId: { exact: targetDevice.deviceId },
        width: { ideal: bestWidth, max: bestWidth },
        height: { ideal: bestHeight, max: bestHeight },
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
