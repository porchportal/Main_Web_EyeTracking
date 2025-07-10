import { useState, useRef, useCallback, useEffect } from 'react';

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

  const startVideoProcessing = useCallback(async (newOptions = {}) => {
    if (isProcessing) {
      updateOptions(newOptions);
      return;
    }
    
    setProcessingError(null);
    updateOptions(newOptions);
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      
      streamRef.current = mediaStream;
      
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
      
      processingIntervalRef.current = setInterval(() => {
        processCurrentFrame();
      }, 200);
      
    } catch (error) {
      console.error('Error starting video processing:', error);
      setProcessingError(`Failed to access camera: ${error.message}`);
      stopVideoProcessing();
    }
  }, [isProcessing]);

  const updateOptions = useCallback((newOptions = {}) => {
    setOptions(prevOptions => ({
      ...prevOptions,
      ...newOptions
    }));
  }, []);

  const stopVideoProcessing = useCallback(() => {
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsProcessing(false);
    setProcessingResults(null);
  }, []);

  const toggleVideoProcessing = useCallback((newOptions = {}) => {
    if (isProcessing) {
      stopVideoProcessing();
    } else {
      startVideoProcessing(newOptions);
    }
  }, [isProcessing, startVideoProcessing, stopVideoProcessing]);

  const processCurrentFrame = async () => {
    if (!videoRef.current || !streamRef.current || !isProcessing) return;
    
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.8);
      });
      
      if (!blob) {
        console.error('Failed to capture frame');
        return;
      }
      
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');
      formData.append('showHeadPose', options.showHeadPose.toString());
      formData.append('showBoundingBox', options.showBoundingBox.toString());
      formData.append('showMask', options.showMask.toString());
      formData.append('showParameters', options.showParameters.toString());
      
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
const VideoProcessor = () => {
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
    updateOptions
  } = useVideoProcessor();

  return (
    <div className="video-processor-container">
      <div className="video-container relative">
        <video
          ref={videoRef}
          className="w-full max-w-2xl mx-auto rounded-lg shadow-lg"
          style={{
            display: isProcessing ? 'block' : 'none',
            aspectRatio: '16/9',
            backgroundColor: '#000'
          }}
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="w-full max-w-2xl mx-auto rounded-lg shadow-lg"
          style={{
            display: isProcessing ? 'block' : 'none',
            aspectRatio: '16/9',
            backgroundColor: '#000'
          }}
        />
        
        <div className="absolute top-4 right-4 space-x-2">
          <button
            onClick={() => toggleVideoProcessing()}
            className={`px-4 py-2 rounded-lg font-medium ${
              isProcessing
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isProcessing ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>
      
      {processingError && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
          Error: {processingError}
        </div>
      )}
      
      {backendAvailable === false && (
        <div className="mt-4 p-4 bg-yellow-100 text-yellow-700 rounded-lg">
          Backend connection not available
        </div>
      )}
      
      <div className="mt-4 space-y-2">
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={options.showHeadPose}
              onChange={(e) => updateOptions({ showHeadPose: e.target.checked })}
              className="form-checkbox"
            />
            <span>Show Head Pose</span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={options.showBoundingBox}
              onChange={(e) => updateOptions({ showBoundingBox: e.target.checked })}
              className="form-checkbox"
            />
            <span>Show Bounding Box</span>
          </label>
        </div>
        
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={options.showMask}
              onChange={(e) => updateOptions({ showMask: e.target.checked })}
              className="form-checkbox"
            />
            <span>Show Mask</span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={options.showParameters}
              onChange={(e) => updateOptions({ showParameters: e.target.checked })}
              className="form-checkbox"
            />
            <span>Show Parameters</span>
          </label>
        </div>
      </div>
      
      {processingResults && options.showParameters && (
        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-medium mb-2">Processing Results:</h3>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(processingResults, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default VideoProcessor; 