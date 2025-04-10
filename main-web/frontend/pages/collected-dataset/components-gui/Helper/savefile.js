// Helper/savefile.js - Fixed to keep the same number for all files in one capture

/**
 * Save an image or data to the server with group ID to ensure consistent numbering
 * @param {string} imageData - Base64 encoded image data
 * @param {string} filename - Filename pattern to save as
 * @param {string} type - Type of file (screen, webcam, parameters)
 * @param {string} folder - Folder to save in
 * @param {string} captureGroup - Unique ID for grouping files from the same capture
 * @returns {Promise<Object>} - Server response
 */
export const saveImageToServer = async (imageData, filename, type, folder = 'eye_tracking_captures', captureGroup = null) => {
    try {
      const response = await fetch('/api/save-capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          imageData, 
          filename, 
          type, 
          folder,
          captureGroup // Include the capture group ID
        })
      });
      const result = await response.json();
      return result;
    } catch (error) {
      console.error(`Error saving ${type}:`, error);
      return null;
    }
  };
  
  /**
   * Save CSV data to the server
   * @param {string} csvData - CSV data
   * @param {string} filename - Filename pattern to save as
   * @param {string} folder - Folder to save in
   * @param {string} captureGroup - Unique ID for grouping files from the same capture
   * @returns {Promise<Object>} - Server response
   */
  export const saveCSVToServer = async (csvData, filename, folder = 'eye_tracking_captures', captureGroup = null) => {
    try {
      const csvBlob = new Blob([csvData], { type: 'text/csv' });
      const reader = new FileReader();
      const csvDataUrl = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(csvBlob);
      });
  
      const result = await saveImageToServer(csvDataUrl, filename, 'parameters', folder, captureGroup);
      return result;
    } catch (error) {
      console.error('Error saving CSV:', error);
      return null;
    }
  };
  
  /**
   * Capture and save images at a specific point with consistent numbering
   * @param {Object} options - Capture options
   * @returns {Promise<Object>} - Capture results
   */
  export const captureImagesAtPoint = async ({ point, captureCount = 1, canvasRef, setCaptureCount, showCapturePreview }) => {
    try {
      const folder = 'eye_tracking_captures';
      
      // Create a unique ID for this capture group
      const captureGroupId = `capture-${Date.now()}`;
      console.log(`Generated capture group ID: ${captureGroupId}`);
      
      // File patterns for saving
      const screenFilename = 'screen_001.jpg';  // Pattern only - server will assign number
      const webcamFilename = 'webcam_001.jpg';  // Pattern only - server will assign number
      const parameterFilename = 'parameter_001.csv';  // Pattern only - server will assign number
      
      // For logging
      console.log("Starting capture with group ID:", captureGroupId);
      
      const canvas = canvasRef.current;
      let screenImage = null;
      let webcamImage = null;
      let captureNumber = null;
      
      // 1. Prepare all data first
      
      // 1.1 Canvas/screen image
      if (canvas) {
        screenImage = canvas.toDataURL('image/png');
      }
  
      // 1.2 Webcam image
      const videoElement = window.videoElement || document.querySelector('video');
      if (videoElement) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = videoElement.videoWidth || 640;
        tempCanvas.height = videoElement.videoHeight || 480;
        tempCanvas.getContext('2d').drawImage(videoElement, 0, 0);
        webcamImage = tempCanvas.toDataURL('image/png');
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          const tempVideo = document.createElement('video');
          tempVideo.srcObject = stream;
          tempVideo.muted = true;
          tempVideo.playsInline = true;
          document.body.appendChild(tempVideo);
          await tempVideo.play();
          await new Promise(res => setTimeout(res, 300));
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = tempVideo.videoWidth;
          tempCanvas.height = tempVideo.videoHeight;
          tempCanvas.getContext('2d').drawImage(tempVideo, 0, 0);
          webcamImage = tempCanvas.toDataURL('image/png');
          stream.getTracks().forEach(t => t.stop());
          tempVideo.remove();
        } catch (err) {
          console.warn("Fallback webcam capture failed:", err);
        }
      }
  
      // 1.3 Parameter data
      const csvData = [
        "name,value",
        `dot_x,${point.x}`,
        `dot_y,${point.y}`,
        `canvas_width,${canvas?.width || 0}`,
        `canvas_height,${canvas?.height || 0}`,
        `window_width,${window.innerWidth}`,
        `window_height,${window.innerHeight}`,
        `timestamp,${new Date().toISOString()}`,
        `group_id,${captureGroupId}`
      ].join('\n');
      
      // 2. Save all files with the same group ID so they get the same number
      
      // 2.1 Save parameter file
      const paramResult = await saveCSVToServer(csvData, parameterFilename, folder, captureGroupId);
      
      if (paramResult && paramResult.success) {
        captureNumber = paramResult.number;
        console.log(`Server assigned capture number: ${captureNumber} for group: ${captureGroupId}`);
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
      
      // 3. Show preview if needed
      if (showCapturePreview && typeof showCapturePreview === 'function') {
        showCapturePreview(screenImage, webcamImage, point);
      }
      
      // 4. Increment counter for next capture
      if (setCaptureCount && typeof setCaptureCount === 'function') {
        setCaptureCount(prevCount => prevCount + 1);
      }
      
      // 5. Return results
      return {
        screenImage,
        webcamImage,
        success: true,
        point,
        captureNumber,
        groupId: captureGroupId
      };
    } catch (err) {
      console.error("captureImagesAtPoint failed:", err);
      return { 
        success: false, 
        error: err.message,
        screenImage: null,
        webcamImage: null
      };
    }
  };