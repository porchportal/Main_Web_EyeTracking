// videoProcessor.js
import { useState, useRef, useCallback } from 'react';

const useVideoProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResults, setProcessingResults] = useState(null);
  const [processingError, setProcessingError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const processingIntervalRef = useRef(null);

  /**
   * Start video processing with backend
   */
  const startVideoProcessing = useCallback(async (options = {}) => {
    if (isProcessing) return;
    
    setProcessingError(null);
    
    try {
      // Request camera access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      
      // Store stream for later cleanup
      streamRef.current = mediaStream;
      
      // If we have a video element reference, attach the stream
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      
      setIsProcessing(true);
      
      // Start the frame processing interval
      processingIntervalRef.current = setInterval(() => {
        processCurrentFrame(options);
      }, 200); // Process a frame every 200ms (5fps) to reduce server load
      
    } catch (error) {
      console.error('Error starting video processing:', error);
      setProcessingError(`Failed to access camera: ${error.message}`);
    }
  }, [isProcessing]);

  /**
   * Stop video processing
   */
  const stopVideoProcessing = useCallback(() => {
    // Clear the processing interval
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }
    
    // Stop all tracks in the media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsProcessing(false);
    setProcessingResults(null);
  }, []);

  /**
   * Toggle video processing
   */
  const toggleVideoProcessing = useCallback((options = {}) => {
    if (isProcessing) {
      stopVideoProcessing();
    } else {
      startVideoProcessing(options);
    }
  }, [isProcessing, startVideoProcessing, stopVideoProcessing]);

  /**
   * Process the current video frame
   */
  const processCurrentFrame = async (options = {}) => {
    if (!videoRef.current || !streamRef.current) return;
    
    try {
      // Create a canvas to capture the current frame
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      // Set canvas size to match video dimensions
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      
      // Draw the current video frame to the canvas
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to blob (JPEG format with 0.8 quality)
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.8);
      });
      
      if (!blob) {
        console.error('Failed to capture frame');
        return;
      }
      
      // Create form data for the API request
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');
      
      // Add processing options
      formData.append('showHeadPose', options.showHeadPose || false);
      formData.append('showBoundingBox', options.showBoundingBox || false);
      formData.append('showMask', options.showMask || false);
      formData.append('showParameters', options.showParameters || false);
      
      // Send to backend API
      const response = await fetch('/api/process-frame', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setProcessingResults(result);
        
        // If we have a processed image, display it
        if (result.image && options.showProcessedImage) {
          displayProcessedImage(result.image);
        }
        
        return result;
      } else {
        console.error('Processing failed:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error processing frame:', error);
      setProcessingError(`Processing error: ${error.message}`);
      return null;
    }
  };

  /**
   * Display the processed image in a canvas element
   */
  const displayProcessedImage = (base64Image) => {
    // Implementation depends on your UI structure
    // This would typically update a canvas element with the processed image
  };

  /**
   * Process a video file (not a live stream)
   */
  const processVideoFile = async (file, options = {}) => {
    try {
      setIsProcessing(true);
      setProcessingError(null);
      
      const formData = new FormData();
      formData.append('file', file);
      
      // Add processing options
      formData.append('showHeadPose', options.showHeadPose || false);
      formData.append('showBoundingBox', options.showBoundingBox || false);
      formData.append('showMask', options.showMask || false);
      formData.append('showParameters', options.showParameters || false);
      
      // Send to backend API
      const response = await fetch('/api/process-video', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setProcessingResults(result);
        return result;
      } else {
        console.error('Video processing failed:', result.error);
        setProcessingError(`Video processing failed: ${result.error}`);
        return null;
      }
    } catch (error) {
      console.error('Error processing video:', error);
      setProcessingError(`Error processing video: ${error.message}`);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    processingResults,
    processingError,
    videoRef,
    startVideoProcessing,
    stopVideoProcessing,
    toggleVideoProcessing,
    processVideoFile,
    processCurrentFrame
  };
};

export default useVideoProcessor;