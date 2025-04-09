// savefile.js
// Centralized saving logic for screen, webcam, and parameter files

export const saveImageToServer = async (imageData, filename, type, folder = 'eye_tracking_captures') => {
    try {
      const response = await fetch('/api/save-capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageData, filename, type, folder })
      });
      const result = await response.json();
      console.log(`${type} save result:`, result);
      return result;
    } catch (error) {
      console.error(`Error saving ${type} image:`, error);
      return null;
    }
  };
  
  export const saveCSVToServer = async (csvData, filename, folder = 'eye_tracking_captures') => {
    try {
      const csvBlob = new Blob([csvData], { type: 'text/csv' });
      const reader = new FileReader();
      const csvDataUrl = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(csvBlob);
      });
  
      const response = await fetch('/api/save-capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageData: csvDataUrl, filename, type: 'parameters', folder })
      });
  
      const result = await response.json();
      console.log('CSV save result:', result);
      return result;
    } catch (error) {
      console.error('Error saving CSV:', error);
      return null;
    }
  };
  
  export const captureImagesAtPoint = async ({ point, captureCount, canvasRef, setCaptureCount, showCapturePreview }) => {
    try {
      const counter = String(captureCount).padStart(3, '0');
      const screenFilename = `screen_${counter}.jpg`;
      const webcamFilename = `webcam_${counter}.jpg`;
      const parameterFilename = `parameter_${counter}.csv`;
      const folder = 'eye_tracking_captures';
  
      const canvas = canvasRef.current;
      let screenImage = null;
      let webcamImage = null;
  
      if (canvas) {
        screenImage = canvas.toDataURL('image/png');
        await saveImageToServer(screenImage, screenFilename, 'screen', folder);
      }
  
      const videoElement = window.videoElement || document.querySelector('video');
      if (videoElement) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = videoElement.videoWidth || 640;
        tempCanvas.height = videoElement.videoHeight || 480;
        tempCanvas.getContext('2d').drawImage(videoElement, 0, 0);
        webcamImage = tempCanvas.toDataURL('image/png');
        await saveImageToServer(webcamImage, webcamFilename, 'webcam', folder);
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
          await saveImageToServer(webcamImage, webcamFilename, 'webcam', folder);
          stream.getTracks().forEach(t => t.stop());
          tempVideo.remove();
        } catch (err) {
          console.warn("Fallback webcam capture failed:", err);
        }
      }
  
      const csvData = [
        "name,value",
        `dot_x,${point.x}`,
        `dot_y,${point.y}`,
        `canvas_width,${canvas?.width || 0}`,
        `canvas_height,${canvas?.height || 0}`,
        `window_width,${window.innerWidth}`,
        `window_height,${window.innerHeight}`,
        // `calibration_point_label,${point.label || ''}`,
        `timestamp,${new Date().toISOString()}`
      ].join('\n');
      await saveCSVToServer(csvData, parameterFilename, folder);
  
      // Only increment the counter AFTER all files have been successfully saved
      if (setCaptureCount) {
        setCaptureCount(prev => prev + 1);
      }
      
      // Show the preview AFTER saving everything
      if (showCapturePreview && typeof showCapturePreview === 'function') {
        showCapturePreview(screenImage, webcamImage, point);
      }
      
      return {
        screenImage: screenImage || canvas?.toDataURL('image/png'),
        webcamImage: webcamImage || null,
        success: true,
        point
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