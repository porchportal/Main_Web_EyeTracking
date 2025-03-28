// index.js
import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import TopBar from './components-gui/topBar';
import DisplayResponse from './components-gui/displayResponse';
import { ActionButtonGroup } from './components-gui/actionButton';

// Dynamically load the video processor component (not the hook directly)
const VideoProcessorComponent = dynamic(
  () => import('./components-gui/VideoProcessorComponent'),
  { ssr: false }
);
// Dynamically import the camera component with SSR disabled
const DynamicCameraAccess = dynamic(
  () => import('./components-gui/cameraAccess'),
  { 
    ssr: false,
    loading: () => (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '480px',
        height: '360px',
        backgroundColor: '#f0f8ff',
        border: '2px solid #0066cc',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        zIndex: 999
      }}>
        <div style={{ fontSize: '48px', marginBottom: '15px' }}>📷</div>
        <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#0066cc' }}>
          Loading camera...
        </p>
      </div>
    )
  }
);

export default function CollectedDatasetPage() {
  // State for hydration detection
  const [isHydrated, setIsHydrated] = useState(false);
  
  // State for camera management
  const [showCamera, setShowCamera] = useState(false);
  const [showPermissionPopup, setShowPermissionPopup] = useState(false);
  const [showTopBar, setShowTopBar] = useState(true);
  const [showMetrics, setShowMetrics] = useState(true);
  const [outputText, setOutputText] = useState('');
  const [metrics, setMetrics] = useState({
    width: '---',
    height: '---',
    distance: '---'
  });
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
    percentage: 100
  });
  
  // References and other state
  const previewAreaRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  
  // State for capture tracking
  const [captureCounter, setCaptureCounter] = useState(1);
  const [captureFolder, setCaptureFolder] = useState('');
  
  // State for camera processing options
  const [showHeadPose, setShowHeadPose] = useState(false);
  const [showBoundingBox, setShowBoundingBox] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [showParameters, setShowParameters] = useState(false);
  
  // State to track if camera square should be shown
  const [showCameraPlaceholder, setShowCameraPlaceholder] = useState(false);
  
  // To store the camera permission state
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  
  // State for warning message
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  
  // Backend connection status
  const [backendStatus, setBackendStatus] = useState('checking');
  
  // Check if we're on the client or server
  const isClient = typeof window !== 'undefined';
  // Create a capture folder on component mount
  useEffect(() => {
    if (!captureFolder && isClient && isHydrated) {
      const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
      setCaptureFolder(`session_${timestamp}`);
      console.log(`Created capture folder: session_${timestamp}`);
    }
  }, [captureFolder, isClient, isHydrated]);

  // Dynamically import WhiteScreenMain with SSR disabled
  const DynamicWhiteScreenMain = dynamic(
    () => import('./components-gui/WhiteScreenMain'),
    { ssr: false }
  );
  
  // Set hydrated state after mount to prevent hydration mismatch
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Check backend connection on mount
  useEffect(() => {
    if (!isClient || !isHydrated) return; // Skip on server or before hydration
    
    const checkBackendConnection = async () => {
      try {
        const response = await fetch('/api/check-backend-connection');
        const data = await response.json();
        setBackendStatus(data.connected ? 'connected' : 'disconnected');
        console.log(`Backend connection: ${data.connected ? 'OK' : 'Failed'}`);
        
        // Show status in output text
        setOutputText(`Backend ${data.connected ? 'connected' : 'disconnected - using mock mode'}`);
      } catch (error) {
        console.error('Error checking backend connection:', error);
        setBackendStatus('disconnected');
        setOutputText('Backend disconnected - using mock mode');
      }
    };

    checkBackendConnection();
    
    // Welcome message after backend check
    setTimeout(() => {
      setOutputText('Camera system ready. Click "Show Preview" to start camera.');
    }, 2000);
  }, [isHydrated]);

  // Update metrics and window size when component mounts and on window resize
  useEffect(() => {
    if (!isClient || !isHydrated) return; // Skip on server or before hydration
    
    const updateDimensions = () => {
      if (previewAreaRef.current) {
        const width = previewAreaRef.current.offsetWidth;
        const height = previewAreaRef.current.offsetHeight;
        
        // Calculate what percentage of the screen we're using
        const screenPercentage = (window.innerWidth / window.screen.width) * 100;
        
        setMetrics(prev => ({
          ...prev,
          width,
          height
        }));
        
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
          percentage: Math.round(screenPercentage)
        });

        // Update canvas dimensions
        adjustCanvasDimensions();
      }
    };

    // Initial calculation
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, [isHydrated]);

  // Adjust canvas dimensions to fill the container properly
  const adjustCanvasDimensions = () => {
    if (!isClient || !isHydrated || !canvasRef.current || !previewAreaRef.current) return;
    
    const canvas = canvasRef.current;
    const container = previewAreaRef.current;
    
    // Get the size of the preview area
    const rect = container.getBoundingClientRect();
    
    // Set canvas dimensions to match container size
    canvas.width = rect.width;
    canvas.height = rect.height - (showTopBar ? 0 : 0); // Adjust if needed
    
    // Clear the canvas
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Add effect to update canvas when dimensions change
  useEffect(() => {
    if (isClient && isHydrated) {
      adjustCanvasDimensions();
    }
  }, [windowSize, showTopBar, isHydrated]);
  
  // Add styles to document head for button highlighting
  useEffect(() => {
    if (!isClient || !isHydrated) return;
    
    // Create a style element
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(0, 102, 204, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(0, 102, 204, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 102, 204, 0); }
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .btn-highlight {
        animation: pulse 1.5s infinite;
        background-color: #0099ff !important;
        color: white !important;
        transform: scale(1.05);
        transition: all 0.3s ease;
      }
      
      .warning-banner {
        animation: fadeIn 0.3s ease-in-out;
      }
    `;
    document.head.appendChild(style);
    
    // Clean up
    return () => {
      document.head.removeChild(style);
    };
  }, [isHydrated]);
  
  // Make toggleTopBar function available globally
  useEffect(() => {
    if (!isClient || !isHydrated) return;
    
    // Make toggleTopBar available to other components
    window.toggleTopBar = (show) => {
      setShowTopBar(show);
      
      // Also hide metrics when hiding the top bar
      if (!show) {
        setShowMetrics(false);
      }
      
      // Adjust canvas dimensions after toggling
      setTimeout(adjustCanvasDimensions, 100);
    };
    
    return () => {
      // Clean up
      delete window.toggleTopBar;
    };
  }, [isHydrated]);
  
  // Function to highlight the Show Preview button
  const highlightPreviewButton = () => {
    if (!isClient || !isHydrated) return;
    
    // Find all buttons in the document
    const buttons = document.querySelectorAll('button');
    
    // Look for the Show Preview button text
    let foundButton = false;
    buttons.forEach(button => {
      if (button.textContent && button.textContent.includes('Show Preview')) {
        // Add highlight class
        button.classList.add('btn-highlight');
        foundButton = true;
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
          button.classList.remove('btn-highlight');
        }, 3000);
      }
    });
    
    // If button wasn't found, try again with delay
    if (!foundButton) {
      setTimeout(highlightPreviewButton, 100);
    }
  };

  // Toggle camera function
  const toggleCamera = (shouldEnable) => {
    if (!isClient || !isHydrated) return;
    
    const processor = window.videoProcessor;
    if (!processor) {
      console.error('Video processor not available');
      return;
    }
    
    if (shouldEnable) {
      setShowCamera(true);
      setShowCameraPlaceholder(false);
      
      // Start video processing
      processor.startVideoProcessing({
        showHeadPose,
        showBoundingBox,
        showMask,
        showParameters,
        showProcessedImage: true
      });
      
      setOutputText('Camera preview started');
    } else {
      setShowCamera(false);
      
      // Stop video processing
      processor.stopVideoProcessing();
      
      // Show camera placeholder if any visualization options are enabled
      if (showHeadPose || showBoundingBox || showMask || showParameters) {
        setShowCameraPlaceholder(true);
      } else {
        setShowCameraPlaceholder(false);
      }
      
      setOutputText('Camera preview stopped');
    }
  };

  // Handler for action button clicks
  const handleActionButtonClick = (actionType, value) => {
    if (!isClient || !isHydrated) return;
    
    // Special case for toggling the top bar
    if (actionType === 'toggleTopBar') {
      const newTopBarState = value !== undefined ? !!value : !showTopBar;
      setShowTopBar(newTopBarState);
      
      // Also hide metrics when hiding the top bar
      if (!newTopBarState) {
        setShowMetrics(false);
      }
      
      setOutputText(`TopBar ${newTopBarState ? 'shown' : 'hidden'}${!newTopBarState ? ', Metrics hidden' : ''}`);
      
      // Adjust canvas dimensions after toggling
      setTimeout(adjustCanvasDimensions, 100);
      return;
    }
    
    // Check if camera is active or not required for this action
    const requiresCamera = ['headPose', 'boundingBox', 'mask', 'parameters'].includes(actionType);
    
    // Show warning if trying to use features requiring camera without camera being active
    if (requiresCamera && !showCamera) {
      setShowWarning(true);
      setWarningMessage('Please activate the camera by clicking "Show Preview" first');
      
      // Highlight the Show Preview button
      highlightPreviewButton();
      
      // Auto-hide warning after 3 seconds
      setTimeout(() => {
        setShowWarning(false);
      }, 3000);
      
      // Update output text
      setOutputText('Camera preview needed for this feature');
      
      return;
    }
    
    // Clear any existing warnings
    setShowWarning(false);
    
    // Special case for Random Dot - connect to WhiteScreenMain
    // Replace the randomDot case in handleActionButtonClick with this implementation:

    // Special case for Random Dot - connect to WhiteScreenMain
    if (actionType === 'randomDot') {
      // Hide topBar before displaying the dot
      setShowTopBar(false);
      
      if (window.whiteScreenActions && window.whiteScreenActions.randomDot) {
        window.whiteScreenActions.randomDot();
      } else {
        // Fallback behavior
        setOutputText('Random dot action triggered - using fallback');
        
        // Ensure canvas is visible
        adjustCanvasDimensions();
        
        // Draw random dot directly
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const x = Math.floor(Math.random() * (canvas.width - 40)) + 20;
          const y = Math.floor(Math.random() * (canvas.height - 40)) + 20;
          
          // Clear canvas and fill with white
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw the dot
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fillStyle = 'red';
          ctx.fill();
          
          // Add glow effect
          ctx.beginPath();
          ctx.arc(x, y, 11, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Start a countdown for capture
          let count = 3;
          const countdownInterval = setInterval(() => {
            count--;
            if (count <= 0) {
              clearInterval(countdownInterval);
              
              // SILENTLY capture without showing preview
              captureImagesWithoutPreview(x, y);
            }
          }, 1000);
        }
      }
      return;
    }

    // Add this new helper function for silent capturing:
    // Modified captureImagesWithoutPreview function for improved file saving with continuous numbering
    const captureImagesWithoutPreview = async (x, y) => {
      try {
        // Define a fixed folder name for all captures
        const captureFolder = 'eye_tracking_captures';
        
        // Format counter for filenames - the server will handle the actual numbering
        const counter = String(captureCounter).padStart(3, '0');
        const screenFilename = `screen_${counter}.jpg`;
        const webcamFilename = `webcam_${counter}.jpg`;
        const parameterFilename = `parameter_${counter}.csv`;
        
        console.log(`Starting capture process with counter ${counter}`);
        console.log(`Dot position: x=${x}, y=${y}`);
        
        // Store these variables to use later for preview
        let screenImageData = null;
        let webcamImageData = null;
        let screenImagePath = null;
        let webcamImagePath = null;
        let usedCaptureNumber = captureCounter;
        
        // 1. Capture screen image from canvas
        const canvas = canvasRef.current;
        if (canvas) {
          try {
            console.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`);
            screenImageData = canvas.toDataURL('image/png');
            console.log(`Screen image captured successfully, size: ${screenImageData.length} chars`);
            
            // Save screen image via API
            const screenResponse = await fetch('/api/save-capture', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                imageData: screenImageData,
                filename: screenFilename,
                type: 'screen',
                folder: captureFolder
              })
            });
            
            if (screenResponse.ok) {
              const screenResult = await screenResponse.json();
              console.log(`Screen image saved: ${screenResult.path}`);
              screenImagePath = screenResult.path;
              
              // If the server provides a capture number, use it for the next files
              if (screenResult.captureNumber) {
                usedCaptureNumber = screenResult.captureNumber;
                console.log(`Server assigned capture number: ${usedCaptureNumber}`);
              }
            } else {
              console.error(`Failed to save screen image: ${screenResponse.status} ${screenResponse.statusText}`);
            }
          } catch (screenError) {
            console.error("Error capturing or saving screen image:", screenError);
          }
        } else {
          console.error("Canvas reference is null, cannot capture screen");
        }
        
        // Update filenames with server-assigned capture number
        const updatedWebcamFilename = `webcam_${String(usedCaptureNumber).padStart(3, '0')}.jpg`;
        const updatedParameterFilename = `parameter_${String(usedCaptureNumber).padStart(3, '0')}.csv`;
        
        // 2. Silently capture webcam image without showing preview
        try {
          console.log("Attempting to capture webcam silently");
          
          // Create a temporary stream for just this capture
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: false 
          });
          
          console.log("Webcam stream obtained successfully");
          
          // Create a hidden video element to receive the stream
          const tempVideo = document.createElement('video');
          tempVideo.autoplay = true;
          tempVideo.playsInline = true;
          tempVideo.muted = true;
          tempVideo.style.position = 'absolute';
          tempVideo.style.left = '-9999px'; // Position off-screen
          tempVideo.style.opacity = '0';
          document.body.appendChild(tempVideo);
          
          // Set the stream to the video element
          tempVideo.srcObject = stream;
          
          // Wait for video to initialize
          await new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
              console.warn("Video loading timed out, continuing anyway");
              resolve();
            }, 1000);
            
            tempVideo.onloadeddata = () => {
              clearTimeout(timeoutId);
              console.log(`Video element ready: ${tempVideo.videoWidth}x${tempVideo.videoHeight}`);
              resolve();
            };
          });
          
          // Small delay to ensure a clear frame
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Check if video dimensions are valid
          if (tempVideo.videoWidth === 0 || tempVideo.videoHeight === 0) {
            console.warn("Video dimensions are invalid, using default dimensions");
          }
          
          // Capture the frame to a canvas
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = tempVideo.videoWidth || 640;
          tempCanvas.height = tempVideo.videoHeight || 480;
          const ctx = tempCanvas.getContext('2d');
          
          try {
            ctx.drawImage(tempVideo, 0, 0, tempCanvas.width, tempCanvas.height);
            console.log(`Frame drawn to temp canvas: ${tempCanvas.width}x${tempCanvas.height}`);
            
            // Get image data
            webcamImageData = tempCanvas.toDataURL('image/png');
            console.log(`Webcam image captured successfully, size: ${webcamImageData.length} chars`);
            
            // Save webcam image via API - using the updated filename
            const webcamResponse = await fetch('/api/save-capture', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                imageData: webcamImageData,
                filename: updatedWebcamFilename,
                type: 'webcam',
                folder: captureFolder
              })
            });
            
            if (webcamResponse.ok) {
              const webcamResult = await webcamResponse.json();
              console.log(`Webcam image saved: ${webcamResult.path}`);
              webcamImagePath = webcamResult.path;
            } else {
              console.error(`Failed to save webcam image: ${webcamResponse.status} ${webcamResponse.statusText}`);
            }
          } catch (drawError) {
            console.error("Error drawing video to canvas:", drawError);
          }
          
          // IMPORTANT: Clean up - stop stream and remove video element
          console.log("Cleaning up webcam resources");
          stream.getTracks().forEach(track => {
            track.stop();
            console.log(`Stopped track: ${track.kind}, readyState: ${track.readyState}`);
          });
          
          tempVideo.srcObject = null;
          if (tempVideo.parentNode) {
            tempVideo.parentNode.removeChild(tempVideo);
            console.log("Removed temporary video element");
          }
          
        } catch (webcamError) {
          console.error("Error capturing webcam silently:", webcamError);
        }
        
        // 3. Create and save a CSV with parameters - using the updated filename
        try {
          console.log("Creating parameter CSV");
          // Create CSV content with two columns: name and value
          const csvData = [
            "name,value",
            `dot_x,${x}`,
            `dot_y,${y}`,
            `canvas_width,${canvas ? canvas.width : 0}`,
            `canvas_height,${canvas ? canvas.height : 0}`,
            `window_width,${window.innerWidth}`,
            `window_height,${window.innerHeight}`,
            `timestamp,${new Date().toISOString()}`
          ].join('\n');
          
          console.log("CSV data created:", csvData);
          
          // Convert CSV to data URL
          const csvBlob = new Blob([csvData], { type: 'text/csv' });
          const csvReader = new FileReader();
          
          const csvDataUrl = await new Promise((resolve) => {
            csvReader.onloadend = () => resolve(csvReader.result);
            csvReader.readAsDataURL(csvBlob);
          });
          
          console.log("CSV converted to data URL");
          
          // Save CSV using the API
          const csvResponse = await fetch('/api/save-capture', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              imageData: csvDataUrl,
              filename: updatedParameterFilename,
              type: 'parameters',
              folder: captureFolder
            })
          });
          
          if (csvResponse.ok) {
            const csvResult = await csvResponse.json();
            console.log(`Parameter CSV saved: ${csvResult.path}`);
          } else {
            console.error(`Failed to save parameter CSV: ${csvResponse.status} ${csvResponse.statusText}`);
          }
          
        } catch (csvError) {
          console.error("Error saving parameter CSV:", csvError);
        }
        
        // 4. Update counter for next capture based on server response or increment
        setCaptureCounter(usedCaptureNumber + 1);
        
        // 5. Show preview with ORIGINAL IMAGE DATA (not paths from server)
        console.log("Capture complete. Showing preview with in-memory image data:");
        console.log("- Screen image size:", screenImageData ? screenImageData.length : 'N/A');
        console.log("- Webcam image size:", webcamImageData ? webcamImageData.length : 'N/A');
        
        // Use the original image data for preview, not the paths
        if (screenImageData || webcamImageData) {
          // This is the key fix - use the actual image data for preview
          showCapturedImagesPreview(screenImageData, webcamImageData, { x, y });
        } else {
          console.error("No images available to preview");
        }
        
        // 6. Show status message
        setOutputText(`Captured: screen_${String(usedCaptureNumber).padStart(3, '0')}.jpg, ${webcamImageData ? `webcam_${String(usedCaptureNumber).padStart(3, '0')}.jpg` : 'no webcam'}, parameter_${String(usedCaptureNumber).padStart(3, '0')}.csv`);
        
        // 7. Show TopBar again after capture
        setTimeout(() => {
          setShowTopBar(true);
        }, 2200); // Wait longer than the preview duration
        
      } catch (error) {
        console.error("Error during silent capture:", error);
        setOutputText("Error capturing images: " + error.message);
        
        // Still restore the top bar in case of error
        setTimeout(() => {
          setShowTopBar(true);
        }, 1500);
      }
    };

    // Add this helper function to show a preview of the captured images
    // Enhanced showCapturedImagesPreview function with debugging
    const showCapturedImagesPreview = (screenImage, webcamImage, dotPosition) => {
      console.log("Starting preview display with:", {
        screenAvailable: !!screenImage,
        webcamAvailable: !!webcamImage,
        dotPosition
      });
      
      // Don't proceed if no images are available
      if (!screenImage && !webcamImage) {
        console.warn("No images available to preview");
        return;
      }

      // Remove any existing preview containers first (in case of overlapping)
      try {
        const existingPreviews = document.querySelectorAll('.capture-preview-container');
        existingPreviews.forEach(preview => {
          if (preview.parentNode) {
            console.log("Removing existing preview container");
            preview.parentNode.removeChild(preview);
          }
        });
      } catch (cleanupError) {
        console.error("Error cleaning up existing previews:", cleanupError);
      }
      
      // Create a new preview container with z-index higher than everything else
      const previewContainer = document.createElement('div');
      previewContainer.className = 'capture-preview-container';
      previewContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        gap: 20px;
        background-color: rgba(0, 0, 0, 0.85);
        padding: 20px;
        border-radius: 12px;
        z-index: 999999;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6);
      `;
      
      console.log("Preview container created");
      
      // Add debug info div
      const debugInfo = document.createElement('div');
      debugInfo.style.cssText = `
        position: absolute;
        top: -30px;
        left: 0;
        width: 100%;
        color: white;
        font-size: 12px;
        text-align: center;
      `;
      debugInfo.textContent = `Screen: ${screenImage ? 'YES' : 'NO'}, Webcam: ${webcamImage ? 'YES' : 'NO'}`;
      previewContainer.appendChild(debugInfo);
      
      // Function to add an image to the preview
      const addImagePreview = (image, label) => {
        try {
          console.log(`Adding ${label} preview, image data length: ${image ? image.length : 'N/A'}`);
          
          const preview = document.createElement('div');
          preview.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
          `;
          
          const img = document.createElement('img');
          img.src = image;
          img.alt = label;
          img.style.cssText = `
            max-width: 320px;
            max-height: 240px;
            border: 3px solid white;
            border-radius: 8px;
            background-color: #333;
          `;
          
          // Event listeners for image loading
          img.onload = () => console.log(`${label} image loaded successfully, size: ${img.naturalWidth}x${img.naturalHeight}`);
          img.onerror = (e) => console.error(`Error loading ${label} image:`, e);
          
          const labelElement = document.createElement('div');
          labelElement.textContent = label;
          labelElement.style.cssText = `
            color: white;
            font-size: 14px;
            margin-top: 10px;
            font-weight: bold;
          `;
          
          preview.appendChild(img);
          preview.appendChild(labelElement);
          previewContainer.appendChild(preview);
          console.log(`${label} preview element added to container`);
          return true;
        } catch (error) {
          console.error(`Error adding ${label} preview:`, error);
          return false;
        }
      };
      
      // Add both images to preview if available
      if (screenImage) {
        addImagePreview(screenImage, 'Screen Capture');
      }
      
      if (webcamImage) {
        addImagePreview(webcamImage, 'Webcam Capture');
      }
      
      // Add dot position info if available
      if (dotPosition) {
        const positionInfo = document.createElement('div');
        positionInfo.textContent = `Dot position: x=${Math.round(dotPosition.x)}, y=${Math.round(dotPosition.y)}`;
        positionInfo.style.cssText = `
          color: #ffcc00;
          font-size: 14px;
          position: absolute;
          top: -50px;
          left: 0;
          width: 100%;
          text-align: center;
        `;
        previewContainer.appendChild(positionInfo);
        console.log("Dot position info added");
      }
      
      // Add countdown timer
      const timerElement = document.createElement('div');
      timerElement.textContent = '2.0s';
      timerElement.style.cssText = `
        position: absolute;
        bottom: -25px;
        right: 20px;
        color: white;
        font-size: 12px;
        background-color: rgba(0, 0, 0, 0.7);
        padding: 3px 8px;
        border-radius: 4px;
      `;
      previewContainer.appendChild(timerElement);
      
      // Add to document body - IMPORTANT: make sure it's actually added to the DOM
      try {
        document.body.appendChild(previewContainer);
        console.log("Preview container added to DOM");
      } catch (appendError) {
        console.error("Error adding preview container to DOM:", appendError);
      }
      
      // Countdown and remove the preview after 2 seconds
      let timeLeft = 2.0;
      const interval = setInterval(() => {
        timeLeft -= 0.1;
        if (timeLeft <= 0) {
          clearInterval(interval);
          // Fade out
          previewContainer.style.transition = 'opacity 0.3s ease';
          previewContainer.style.opacity = '0';
          // Remove after fade
          setTimeout(() => {
            if (previewContainer.parentNode) {
              console.log("Removing preview container from DOM");
              previewContainer.parentNode.removeChild(previewContainer);
            }
          }, 300);
        } else {
          timerElement.textContent = `${timeLeft.toFixed(1)}s`;
        }
      }, 100);
      
      // Safety cleanup after 5 seconds in case anything goes wrong
      setTimeout(() => {
        if (previewContainer.parentNode) {
          console.log("Safety cleanup of preview container");
          previewContainer.parentNode.removeChild(previewContainer);
        }
      }, 5000);
    };
    
    switch (actionType) {
      case 'headPose':
        const newHeadPoseState = !showHeadPose;
        setShowHeadPose(newHeadPoseState);
        setOutputText(`Head pose visualization ${newHeadPoseState ? 'enabled' : 'disabled'}`);
        if (newHeadPoseState && !showCamera) {
          setShowCameraPlaceholder(true);
        } else if (!newHeadPoseState && !showBoundingBox && !showMask && !showParameters) {
          setShowCameraPlaceholder(false);
        }
        
        // Update processor options if camera is active
        if (showCamera && window.videoProcessor) {
          window.videoProcessor.updateOptions({
            ...window.videoProcessor.options,
            showHeadPose: newHeadPoseState
          });
        }
        break;
        
      case 'boundingBox':
        const newBoundingBoxState = !showBoundingBox;
        setShowBoundingBox(newBoundingBoxState);
        setOutputText(`Bounding box ${newBoundingBoxState ? 'shown' : 'hidden'}`);
        if (newBoundingBoxState && !showCamera) {
          setShowCameraPlaceholder(true);
        } else if (!newBoundingBoxState && !showHeadPose && !showMask && !showParameters) {
          setShowCameraPlaceholder(false);
        }
        
        // Update processor options if camera is active
        if (showCamera && window.videoProcessor) {
          window.videoProcessor.updateOptions({
            ...window.videoProcessor.options,
            showBoundingBox: newBoundingBoxState
          });
        }
        break;
        
      case 'preview':
        // Toggle camera state
        if (showCamera) {
          toggleCamera(false);
        } else if (cameraPermissionGranted) {
          toggleCamera(true);
        } else {
          // Otherwise show permission popup
          setShowPermissionPopup(true);
          setOutputText('Opening camera preview');
          setShowCameraPlaceholder(true);
        }
        break;
        
      case 'mask':
        const newMaskState = !showMask;
        setShowMask(newMaskState);
        setOutputText(`Mask ${newMaskState ? 'shown' : 'hidden'}`);
        if (newMaskState && !showCamera) {
          setShowCameraPlaceholder(true);
        } else if (!newMaskState && !showHeadPose && !showBoundingBox && !showParameters) {
          setShowCameraPlaceholder(false);
        }
        
        // Update processor options if camera is active
        if (showCamera && window.videoProcessor) {
          window.videoProcessor.updateOptions({
            ...window.videoProcessor.options,
            showMask: newMaskState
          });
        }
        break;
        
      case 'parameters':
        const newParametersState = !showParameters;
        setShowParameters(newParametersState);
        setOutputText(`Parameters ${newParametersState ? 'shown' : 'hidden'}`);
        if (newParametersState && !showCamera) {
          setShowCameraPlaceholder(true);
        } else if (!newParametersState && !showHeadPose && !showBoundingBox && !showMask) {
          setShowCameraPlaceholder(false);
        }
        
        // Update processor options if camera is active
        if (showCamera && window.videoProcessor) {
          window.videoProcessor.updateOptions({
            ...window.videoProcessor.options,
            showParameters: newParametersState
          });
        }
        break;
        
      default:
        setOutputText(`Action triggered: ${actionType}`);
    }
  };

  // Top Bar button click handler
  const handleTopBarButtonClick = (actionType) => {
    if (!isClient || !isHydrated) return;
    
    // Special case for Random Dot action
    if (actionType === 'randomDot') {
      // Forward to action button handler
      handleActionButtonClick('randomDot');
      return;
    }
    
    // Check if camera is active for camera-dependent features
    const requiresCamera = [
      'Draw Head pose', 
      'Show Bounding Box', 
      '😊 Show Mask',
      'Parameters'
    ].includes(actionType);
    
    // Show warning if trying to use features requiring camera without camera being active
    if (requiresCamera && !showCamera) {
      setShowWarning(true);
      setWarningMessage('Please activate the camera by clicking "Show Preview" first');
      
      // Highlight the Show Preview button
      highlightPreviewButton();
      
      // Auto-hide warning after 3 seconds
      setTimeout(() => {
        setShowWarning(false);
      }, 3000);
      
      // Update output text
      setOutputText('Camera preview needed for this feature');
      
      return;
    }
    
    // Clear any existing warnings
    setShowWarning(false);
    
    // Handle the Show Preview button (toggle camera on/off)
    if (actionType === 'Show Preview' || actionType === 'preview') {
      if (showCamera) {
        toggleCamera(false);
      } else if (cameraPermissionGranted) {
        toggleCamera(true);
      } else {
        // Otherwise show permission popup
        setShowPermissionPopup(true);
        setShowCameraPlaceholder(true);
      }
      return;
    }
    
    // Handle Random Dot action
    if (actionType === 'Random Dot') {
      handleActionButtonClick('randomDot');
      return;
    }
    
    // Check for action buttons
    if (
      actionType === 'Draw Head pose' || 
      actionType === 'Show Bounding Box' || 
      actionType === '😊 Show Mask' ||
      actionType === 'Parameters'
    ) {
      switch (actionType) {
        case 'Draw Head pose':
          const newHeadPoseState = !showHeadPose;
          setShowHeadPose(newHeadPoseState);
          setOutputText(`Head pose visualization ${newHeadPoseState ? 'enabled' : 'disabled'}`);
          if (newHeadPoseState && !showCamera) {
            setShowCameraPlaceholder(true);
          } else if (!newHeadPoseState && !showBoundingBox && !showMask && !showParameters) {
            setShowCameraPlaceholder(false);
          }
          
          // Update processor options if camera is active
          if (showCamera && window.videoProcessor) {
            window.videoProcessor.updateOptions({
              ...window.videoProcessor.options,
              showHeadPose: newHeadPoseState
            });
          }
          break;
          
        case 'Show Bounding Box':
          const newBoundingBoxState = !showBoundingBox;
          setShowBoundingBox(newBoundingBoxState);
          setOutputText(`Bounding box ${newBoundingBoxState ? 'shown' : 'hidden'}`);
          if (newBoundingBoxState && !showCamera) {
            setShowCameraPlaceholder(true);
          } else if (!newBoundingBoxState && !showHeadPose && !showMask && !showParameters) {
            setShowCameraPlaceholder(false);
          }
          
          // Update processor options if camera is active
          if (showCamera && window.videoProcessor) {
            window.videoProcessor.updateOptions({
              ...window.videoProcessor.options,
              showBoundingBox: newBoundingBoxState
            });
          }
          break;
          
        case '😊 Show Mask':
          const newMaskState = !showMask;
          setShowMask(newMaskState);
          setOutputText(`Mask ${newMaskState ? 'shown' : 'hidden'}`);
          if (newMaskState && !showCamera) {
            setShowCameraPlaceholder(true);
          } else if (!newMaskState && !showHeadPose && !showBoundingBox && !showParameters) {
            setShowCameraPlaceholder(false);
          }
          
          // Update processor options if camera is active
          if (showCamera && window.videoProcessor) {
            window.videoProcessor.updateOptions({
              ...window.videoProcessor.options,
              showMask: newMaskState
            });
          }
          break;
          
        case 'Parameters':
          const newParametersState = !showParameters;
          setShowParameters(newParametersState);
          setOutputText(`Parameters ${newParametersState ? 'shown' : 'hidden'}`);
          if (newParametersState && !showCamera) {
            setShowCameraPlaceholder(true);
          } else if (!newParametersState && !showHeadPose && !showBoundingBox && !showMask) {
            setShowCameraPlaceholder(false);
          }
          
          // Update processor options if camera is active
          if (showCamera && window.videoProcessor) {
            window.videoProcessor.updateOptions({
              ...window.videoProcessor.options,
              showParameters: newParametersState
            });
          }
          break;
      }
      return;
    }
    
    // Update output text based on action type
    setOutputText(`Action triggered: ${actionType} at ${new Date().toLocaleTimeString()}`);
  };

  const handlePermissionAccepted = () => {
    if (!isClient || !isHydrated) return;
    
    setShowPermissionPopup(false);
    setCameraPermissionGranted(true);
    toggleCamera(true);
  };

  const handlePermissionDenied = () => {
    if (!isClient || !isHydrated) return;
    
    setShowPermissionPopup(false);
    setShowCameraPlaceholder(false);
    setOutputText('Camera permission denied');
  };

  const handleCameraClose = () => {
    if (!isClient || !isHydrated) return;
    
    toggleCamera(false);
  };

  const handleCameraReady = (dimensions) => {
    if (!isClient || !isHydrated) return;
    
    setMetrics({
      width: dimensions.width,
      height: dimensions.height,
      distance: dimensions.distance || '---'
    });
    setOutputText(`Camera ready: ${dimensions.width}x${dimensions.height}`);
  };

  const toggleTopBar = (show) => {
    const newTopBarState = show !== undefined ? show : !showTopBar;
    setShowTopBar(newTopBarState);
    
    // Also hide metrics when hiding the top bar
    if (!newTopBarState) {
      setShowMetrics(false);
    }
    
    setOutputText(`TopBar ${newTopBarState ? 'shown' : 'hidden'}${!newTopBarState ? ', Metrics hidden' : ''}`);
    
    // Wait for state update and DOM changes, then adjust canvas
    setTimeout(adjustCanvasDimensions, 100);
  };

  const toggleMetrics = () => {
    setShowMetrics(prev => !prev);
    setOutputText(`Metrics ${!showMetrics ? 'shown' : 'hidden'}`);
  };
  // Updated startCountdown function in index.js (ActionButtonGroup)
  // Start countdown timer
  const startCountdown = (count, onComplete) => {
    setCountdownValue(count);
    
    const timer = setTimeout(() => {
      if (count > 1) {
        startCountdown(count - 1, onComplete);
      } else {
        // Final countdown step - immediately hide countdown and execute callback
        setCountdownValue(null);
        
        // Execute completion callback without delay
        if (onComplete) onComplete();
      }
    }, 800);
    
    return () => clearTimeout(timer);
  };

  // WhiteScreenMain component with properly connected actions
  const WhiteScreenMainWithActions = () => {
    // Add a ref to store actions
    const actionsRef = useRef({});
    
    // Handler for status updates from WhiteScreenMain
    const handleStatusUpdate = (status) => {
      if (status && typeof status === 'object') {
        if (status.processStatus) {
          setOutputText(status.processStatus);
        }
        if (status.countdownValue) {
          // Display countdown somewhere if needed
        }
      } else if (typeof status === 'string') {
        setOutputText(status);
      }
    };
    
    // Handler for button clicks from WhiteScreenMain
    const handleButtonClick = (actionType, handlers) => {
      if (actionType === 'registerActions') {
        // Store action handlers for later use
        actionsRef.current = handlers;
        
        // Make them available globally for debugging and external access
        window.whiteScreenActions = handlers;
      } else {
        // Handle specific action
        handleActionButtonClick(actionType);
      }
    };
    
    return (
      <DynamicWhiteScreenMain
        onStatusUpdate={handleStatusUpdate}
        triggerCameraAccess={(forceEnable) => {
          if (forceEnable || cameraPermissionGranted) {
            toggleCamera(true);
          } else {
            setShowPermissionPopup(true);
          }
        }}
        onButtonClick={handleButtonClick}
        canvasRef={canvasRef}
        toggleTopBar={toggleTopBar}
      />
    );
  };

  // Dynamic class to reflect current window size
  const getSizeClass = () => {
    const { percentage } = windowSize;
    if (percentage < 35) return 'window-size-tiny';
    if (percentage < 50) return 'window-size-small';
    if (percentage < 70) return 'window-size-medium';
    return 'window-size-large';
  };

  return (
    <div className={`main-container ${getSizeClass()}`}>
      <Head>
        <title>Camera Dataset Collection</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      {/* Load the video processor component */}
      {isHydrated && isClient && <VideoProcessorComponent />}
      
      {/* Backend connection status banner */}
      {isHydrated && backendStatus === 'disconnected' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          padding: '6px 0',
          backgroundColor: '#ffe0b2',
          color: '#e65100',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          zIndex: 1100
        }}>
          ⚠️ Backend disconnected. Using mock mode for face tracking.
        </div>
      )}
      

      {/* TopBar component with onButtonClick handler - conditionally rendered */}
      {showTopBar && (
        <TopBar 
          onButtonClick={handleTopBarButtonClick} 
          onCameraAccess={() => setShowPermissionPopup(true)}
          outputText={outputText}
          onOutputChange={(text) => setOutputText(text)}
          onToggleTopBar={toggleTopBar}
          onToggleMetrics={toggleMetrics} // Make sure this is connected
          canvasRef={canvasRef}
        />
      )}
      
      {/* Show restore button when TopBar is hidden - positioned at top right */}
      {!showTopBar && (
        <div className="restore-button-container" style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          zIndex: 1000
        }}>
          <button 
            className="restore-btn"
            onClick={() => toggleTopBar(true)}
            title="Show TopBar and Metrics"
            style={{
              padding: '5px 10px',
              background: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            ≡
          </button>
        </div>
      )}
      
      {/* Warning message banner */}
      {isHydrated && showWarning && (
        <div className="warning-banner" style={{
          position: 'fixed',
          top: showTopBar ? (backendStatus === 'disconnected' ? '32px' : '60px') : '0',
          left: '0',
          width: '100%',
          backgroundColor: '#ffeb3b',
          color: '#333',
          padding: '10px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1010,
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          <strong>⚠️ {warningMessage}</strong>
        </div>
      )}
      {/* Main preview area */}
      <div 
        ref={previewAreaRef}
        className="camera-preview-area"
        style={{ 
          height: showTopBar ? 'calc(100vh - 120px)' : '100vh',
          marginTop: backendStatus === 'disconnected' ? '32px' : '0',
          position: 'relative',
          backgroundColor: '#f5f5f5',
          overflow: 'hidden' // Add overflow hidden
        }}
      >
        {!showCamera ? (
          <>
            <div className="camera-preview-message" style={{
              padding: '20px',
              textAlign: 'center',
              position: showTopBar ? 'relative' : 'absolute', // Position based on TopBar state
              width: '100%',
              zIndex: 5 // Lower z-index so the WhiteScreenMain can appear on top
            }}>
              <p>Camera preview will appear here</p>
              <p className="camera-size-indicator">Current window: {windowSize.percentage}% of screen width</p>
              
              {/* Camera placeholder square - small version */}
              {isHydrated && showCameraPlaceholder && (
                <div 
                  className="camera-placeholder-square"
                  style={{
                    width: '180px',  // Increased size for better visibility
                    height: '135px', // Maintained 4:3 aspect ratio
                    margin: '20px auto',
                    border: '2px dashed #666',
                    borderRadius: '4px',
                    backgroundColor: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <div style={{ fontSize: '1.5rem' }}>📷</div>
                </div>
              )}
              
              {/* Action buttons for camera control */}
              <div className="camera-action-buttons-container" style={{ 
                marginTop: '30px', 
                maxWidth: '600px',
                margin: '30px auto'
              }}>
                <ActionButtonGroup
                  triggerCameraAccess={(forceEnable) => {
                    if (forceEnable || cameraPermissionGranted) {
                      toggleCamera(true);
                    } else {
                      setShowPermissionPopup(true);
                    }
                  }}
                  isCompactMode={windowSize.width < 768}
                  onActionClick={handleActionButtonClick}
                  showHeadPose={showHeadPose}
                  showBoundingBox={showBoundingBox}
                  showMask={showMask}
                  showParameters={showParameters}
                />
              </div>
            </div>
            
            {/* Canvas for eye tracking dots - Making it truly fullscreen */}
            <div 
              className="canvas-container" 
              style={{ 
                position: 'absolute', 
                top: 0,
                left: 0,
                width: '100%', 
                height: '100%',
                backgroundColor: 'white',
                overflow: 'hidden',
                border: 'none', // Remove border to eliminate line
                zIndex: 10 // Higher than the message but lower than WhiteScreenMain
              }}
            >
              <canvas 
                ref={canvasRef}
                className="tracking-canvas"
                style={{ 
                  width: '100%', 
                  height: '100%',
                  display: 'block' // Removes the inline-block spacing issues
                }}
              />
            </div>
            
            {/* White Screen component for handling dot display and captures */}
            {isHydrated && isClient && (
              <DynamicWhiteScreenMain
                onStatusUpdate={(status) => {
                  if (typeof status === 'string') {
                    setOutputText(status);
                  } else if (status && typeof status === 'object' && status.processStatus) {
                    setOutputText(status.processStatus);
                  }
                }}
                triggerCameraAccess={(forceEnable) => {
                  if (forceEnable || cameraPermissionGranted) {
                    toggleCamera(true);
                  } else {
                    setShowPermissionPopup(true);
                  }
                }}
                onButtonClick={(actionType, handlers) => {
                  if (actionType === 'registerActions') {
                    // Store action handlers globally
                    window.whiteScreenActions = handlers;
                  } else {
                    // Handle specific action
                    handleActionButtonClick(actionType);
                  }
                }}
                canvasRef={canvasRef}
                toggleTopBar={toggleTopBar}
              />
            )}
          </>
        ) : null}
              
        {/* Metrics info - conditionally rendered */}
        {isHydrated && showMetrics && (
          <DisplayResponse 
            width={metrics.width} 
            height={metrics.height} 
            distance={metrics.distance}
            isVisible={showMetrics}
          />
        )}
        
        {/* Canvas for eye tracking dots - Making it truly fullscreen */}
        <div 
          className="canvas-container" 
          style={{ 
            position: 'absolute', 
            top: 0,
            left: 0,
            width: '100%', 
            height: '100%',
            backgroundColor: 'white',
            display: showCamera ? 'none' : 'block', // Hide canvas when camera is showing
            overflow: 'hidden',
            border: 'none' // Remove border to eliminate line
          }}
        >
          <canvas 
            ref={canvasRef}
            className="tracking-canvas"
            style={{ 
              width: '100%', 
              height: '100%',
              display: 'block' // Removes the inline-block spacing issues
            }}
          />
        </div>
        
        {/* White Screen component for handling dot display and captures */}
        {isHydrated && isClient && !showCamera && (
          <WhiteScreenMainWithActions />
        )}
      </div>
      
      {/* Camera permission popup - Simplified client-side only version */}
      {isHydrated && isClient && showPermissionPopup && (
        <div className="camera-permission-popup" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div className="camera-permission-dialog" style={{
            width: '400px',
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 className="camera-permission-title" style={{
              margin: '0 0 15px',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>Camera Access Required</h3>
            <p className="camera-permission-message" style={{
              margin: '0 0 20px',
              fontSize: '14px',
              lineHeight: '1.4'
            }}>
              This application needs access to your camera to function properly. 
              When prompted by your browser, please click "Allow" to grant camera access.
            </p>
            <div className="camera-permission-buttons" style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button 
                onClick={handlePermissionDenied}
                className="camera-btn"
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f0f0f0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handlePermissionAccepted}
                className="camera-btn"
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#0066cc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Camera component - using client-only version */}
      {isHydrated && isClient && showCamera && (
        <DynamicCameraAccess
          isShowing={showCamera} 
          onClose={handleCameraClose}
          onCameraReady={handleCameraReady}
          showHeadPose={showHeadPose}
          showBoundingBox={showBoundingBox}
          showMask={showMask}
          showParameters={showParameters}
          videoRef={videoRef}
        />
      )}
    </div>
  );
}