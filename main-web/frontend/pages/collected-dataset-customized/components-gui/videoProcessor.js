// videoProcessor.js
import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';

const useVideoProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResults, setProcessingResults] = useState(null);
  const [processingError, setProcessingError] = useState(null);
  const [backendAvailable, setBackendAvailable] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const processingIntervalRef = useRef(null);
  const canvasRef = useRef(null);
  const [options, setOptions] = useState({
    showHeadPose: false,
    showBoundingBox: false,
    showMask: false,
    showParameters: false,
    showProcessedImage: false
  });
  
  // Check backend connection on mount
  useEffect(() => {
    const checkBackendConnection = async () => {
      try {
        const response = await fetch('/api/check-backend-connection');
        const data = await response.json();
        setBackendAvailable(data.connected);
        console.log(`Backend connection: ${data.connected ? 'OK' : 'Failed'}`);
      } catch (error) {
        console.error('Error checking backend connection:', error);
        setBackendAvailable(false);
      }
    };

    checkBackendConnection();
  }, []);

  /**
   * Start video processing with backend
   */
  const startVideoProcessing = useCallback(async (newOptions = {}) => {
    if (isProcessing) {
      // If already processing, just update options
      updateOptions(newOptions);
      return;
    }
    
    setProcessingError(null);
    
    // Update options
    updateOptions(newOptions);
    
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
        
        try {
          await videoRef.current.play();
          console.log('Video playing successfully');
        } catch (playError) {
          console.error('Error playing video:', playError);
          setProcessingError(`Failed to play video: ${playError.message}`);
          stopVideoProcessing();
          return;
        }
      }
      
      setIsProcessing(true);
      
      // Start the frame processing interval
      processingIntervalRef.current = setInterval(() => {
        processCurrentFrame();
      }, 200); // Process a frame every 200ms (5fps) to reduce server load
      
    } catch (error) {
      console.error('Error starting video processing:', error);
      setProcessingError(`Failed to access camera: ${error.message}`);
      stopVideoProcessing();
    }
  }, [isProcessing]);

  /**
   * Update processing options
   */
  const updateOptions = useCallback((newOptions = {}) => {
    setOptions(prevOptions => {
      const updatedOptions = {
        ...prevOptions,
        ...newOptions
      };
      
      // If we're already processing, update the backend with new options on next frame
      if (isProcessing) {
        // We don't need to call processCurrentFrame explicitly here
        // since it's handled by the interval
        console.log('Options updated, will be applied on next frame:', updatedOptions);
      }
      
      return updatedOptions;
    });
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
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
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
  const toggleVideoProcessing = useCallback((newOptions = {}) => {
    if (isProcessing) {
      stopVideoProcessing();
    } else {
      startVideoProcessing(newOptions);
    }
  }, [isProcessing, startVideoProcessing, stopVideoProcessing]);

  /**
   * Process the current video frame
   */
  const processCurrentFrame = async () => {
    if (!videoRef.current || !streamRef.current || !isProcessing) return;
    
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
      
      // Add processing options - explicitly convert booleans to strings
      // This is important for proper transmission to the backend
      formData.append('showHeadPose', options.showHeadPose.toString());
      formData.append('showBoundingBox', options.showBoundingBox.toString());
      formData.append('showMask', options.showMask.toString());
      formData.append('showParameters', options.showParameters.toString());
      
      // Log what's being sent to the backend for debugging
      console.log('Sending options to backend:', {
        showHeadPose: options.showHeadPose,
        showBoundingBox: options.showBoundingBox,
        showMask: options.showMask,
        showParameters: options.showParameters
      });
      
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
        if (result.image && options.showProcessedImage && canvasRef.current) {
          displayProcessedImage(result.image, canvasRef.current);
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
  const displayProcessedImage = (base64Image, canvas) => {
    if (!canvas || !base64Image) return;
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    
    img.src = `data:image/jpeg;base64,${base64Image}`;
  };

  return {
    isProcessing,
    processingResults,
    processingError,
    backendAvailable,
    videoRef,
    canvasRef,
    options,
    startVideoProcessing,
    stopVideoProcessing,
    toggleVideoProcessing,
    updateOptions,
    processCurrentFrame
  };
};

// Create the VideoProcessor component
const VideoProcessorComponent = () => {
  const {
    isProcessing,
    processingResults,
    processingError,
    backendAvailable,
    videoRef,
    canvasRef,
    options,
    startVideoProcessing,
    stopVideoProcessing,
    toggleVideoProcessing,
    updateOptions,
    processCurrentFrame
  } = useVideoProcessor();

  return (
    <div className="video-processor-container">
      <div className="video-container">
        <video
          ref={videoRef}
          style={{
            width: '100%',
            maxWidth: '640px',
            height: 'auto',
            display: isProcessing ? 'block' : 'none'
          }}
          playsInline
        />
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            maxWidth: '640px',
            height: 'auto',
            display: isProcessing ? 'block' : 'none'
          }}
        />
      </div>
      
      {processingError && (
        <div className="error-message">
          Error: {processingError}
        </div>
      )}
      
      {backendAvailable === false && (
        <div className="error-message">
          Backend connection not available
        </div>
      )}
    </div>
  );
};

// Create a client-side only version of the component
const VideoProcessor = dynamic(() => Promise.resolve(VideoProcessorComponent), {
  ssr: false
});

// Create the actual page component
export default function VideoProcessorPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Video Processor</h1>
        <VideoProcessor />
      </div>
    </div>
  );
}