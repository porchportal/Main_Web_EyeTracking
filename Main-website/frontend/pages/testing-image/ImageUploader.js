import { useState, useRef, useEffect } from 'react';

export default function ImageUploader({ enhanceFace, onEnhanceFaceChange, onFileSelect, onResult }) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Cleanup preview URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (file) => {
    if (file && file.type.startsWith('image/')) {
      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        setError('File size too large. Please select an image smaller than 10MB.');
        return;
      }
      
      setSelectedFile(file);
      setError(null);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      // Notify parent component about file selection
      if (onFileSelect) {
        onFileSelect(file);
      }
      
      // Auto-run processing after file selection
      setTimeout(() => {
        handleSubmit(new Event('submit'));
      }, 100);
    } else {
      setError('Please select a valid image file (PNG, JPG, JPEG, GIF)');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set drag over to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // Validate file type
      if (file.type.startsWith('image/')) {
        handleFileSelect(file);
      } else {
        setError('Please drop a valid image file (PNG, JPG, JPEG, GIF)');
      }
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    
    console.log('ImageUploader handleSubmit - enhanceFace:', enhanceFace);
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    
    // Add processing options
    formData.append('show_head_pose', 'true');
    formData.append('show_bounding_box', 'true');
    formData.append('show_mask', 'false');
    formData.append('show_parameters', 'true');
    formData.append('enhance_face', enhanceFace.toString());

    try {
      // This requests our Next.js API route, which then forwards to FastAPI
      const response = await fetch('/api/testAI_image', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status}`);
      }
      
      const data = await response.json();
      setResult(data);
      
      // Call the onResult callback to trigger preview
      if (onResult) {
        onResult(data);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveImage = () => {
    // Clean up preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <h2 className="text-base font-semibold mb-3 text-gray-800">Upload Image</h2>
      
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          <div className="flex-1 flex flex-col">
            <label className="block mb-1.5 font-medium text-gray-700 text-xs">
              Upload an image file:
            </label>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
            
            {/* Drag & Drop Area */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all duration-300 flex-1 flex flex-col justify-center ${
                isDragOver 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleClick}
            >
            
            {!selectedFile ? (
              <div className="space-y-2">
                {/* Upload Icon */}
                <div className="mx-auto w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                
                <div className="text-gray-600 text-xs">
                  <span className="font-medium text-gray-700">Drag and drop</span> your image here or{' '}
                  <span className="font-medium text-blue-600 underline">click to browse</span>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, JPEG, GIF up to 10MB</p>
                
                {/* Visual indicators */}
                <div className="flex justify-center space-x-1 text-xs text-gray-400">
                  <span className="px-1 py-0.5 bg-gray-100 rounded text-xs">PNG</span>
                  <span className="px-1 py-0.5 bg-gray-100 rounded text-xs">JPG</span>
                  <span className="px-1 py-0.5 bg-gray-100 rounded text-xs">GIF</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative inline-block">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-lg shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage();
                    }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
                <div className="text-xs text-gray-600">
                  <span className="font-medium text-gray-700 truncate block">{selectedFile.name}</span>
                </div>
                <div className="flex justify-center space-x-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClick();
                    }}
                    className="px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage();
                    }}
                    className="px-1.5 py-0.5 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Processing Status */}
        {isLoading && (
          <div className="w-full px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 
                        text-white rounded-md font-semibold text-xs shadow-lg text-center mt-1">
            <div className="flex items-center justify-center space-x-1.5">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
              <span>Processing with AI...</span>
            </div>
          </div>
        )}
      </form>
      
      {error && (
        <div className="p-2 mb-3 bg-red-50 text-red-700 rounded-md border border-red-200 shadow-sm text-xs">
          <div className="flex items-center">
            <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}
      
      {result && result.success && (
        <div className="p-3 bg-white rounded-md shadow-lg border border-gray-100 text-xs">
          <h3 className="text-sm font-semibold mb-2 text-gray-800">AI Face Analysis Results</h3>
          
          {/* Face Detection Status */}
          <div className="mb-3 p-2 bg-blue-50 rounded-md border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${result.face_detected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="font-semibold text-gray-700 text-xs">
                  {result.face_detected ? 'Face Detected' : 'No Face Detected'}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Enhanced: {enhanceFace ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
          
          {/* Head Pose Angles */}
          {result.metrics.head_pose && (
            <div className="mb-3">
              <h4 className="font-semibold mb-1.5 text-gray-700 text-xs">Head Pose Angles:</h4>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="text-center p-1.5 bg-gray-50 rounded-md border border-gray-100">
                  <div className="text-sm font-bold text-gray-700">{result.metrics.head_pose.pitch}°</div>
                  <div className="text-xs text-gray-600">Pitch</div>
                </div>
                <div className="text-center p-1.5 bg-gray-50 rounded-md border border-gray-100">
                  <div className="text-sm font-bold text-gray-700">{result.metrics.head_pose.yaw}°</div>
                  <div className="text-xs text-gray-600">Yaw</div>
                </div>
                <div className="text-center p-1.5 bg-gray-50 rounded-md border border-gray-100">
                  <div className="text-sm font-bold text-gray-700">{result.metrics.head_pose.roll}°</div>
                  <div className="text-xs text-gray-600">Roll</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Posture and Gaze Direction */}
          {(result.metrics.posture || result.metrics.gaze_direction) && (
            <div className="mb-3">
              <h4 className="font-semibold mb-1.5 text-gray-700 text-xs">Analysis:</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {result.metrics.posture && (
                  <div className="p-1.5 bg-green-50 rounded-md border border-green-200">
                    <div className="text-xs text-green-600 font-medium">Posture</div>
                    <div className="text-xs font-semibold text-green-800">{result.metrics.posture}</div>
                  </div>
                )}
                {result.metrics.gaze_direction && (
                  <div className="p-1.5 bg-blue-50 rounded-md border border-blue-200">
                    <div className="text-xs text-blue-600 font-medium">Gaze Direction</div>
                    <div className="text-xs font-semibold text-blue-800">{result.metrics.gaze_direction}</div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Eye States */}
          {(result.metrics.left_eye_state || result.metrics.right_eye_state) && (
            <div className="mb-3">
              <h4 className="font-semibold mb-1.5 text-gray-700 text-xs">Eye States:</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {result.metrics.left_eye_state && (
                  <div className="p-1.5 bg-purple-50 rounded-md border border-purple-200">
                    <div className="text-xs text-purple-600 font-medium">Left Eye</div>
                    <div className="text-xs font-semibold text-purple-800">{result.metrics.left_eye_state}</div>
                    {result.metrics.left_eye_ear && (
                      <div className="text-xs text-purple-600">EAR: {result.metrics.left_eye_ear}</div>
                    )}
                  </div>
                )}
                {result.metrics.right_eye_state && (
                  <div className="p-1.5 bg-purple-50 rounded-md border border-purple-200">
                    <div className="text-xs text-purple-600 font-medium">Right Eye</div>
                    <div className="text-xs font-semibold text-purple-800">{result.metrics.right_eye_state}</div>
                    {result.metrics.right_eye_ear && (
                      <div className="text-xs text-purple-600">EAR: {result.metrics.right_eye_ear}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Processed Image */}
          {result.image && result.image.data && (
            <div>
              <h4 className="font-semibold mb-1.5 text-gray-700 text-xs">Processed Image:</h4>
              <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm">
                <img 
                  src={`data:image/jpeg;base64,${result.image.data}`} 
                  alt="Processed face image" 
                  className="w-full h-auto max-h-32 object-cover"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
