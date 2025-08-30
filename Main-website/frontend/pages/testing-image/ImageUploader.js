import { useState } from 'react';

export default function ImageUploader() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = (file) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setError(null);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setError('Please select a valid image file');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // This requests our Next.js API route, which then forwards to FastAPI
      const response = await fetch('/api/process-image', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error uploading image:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-6 text-gray-800">Upload Image</h2>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-6">
          <label className="block mb-3 font-medium text-gray-700">
            Upload an image file:
          </label>
          
          {/* Drag & Drop Area */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
              isDragOver 
                ? 'border-gray-400 bg-gray-50' 
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            
            {!selectedFile ? (
              <div className="space-y-4">
                <div className="text-gray-600">
                  <span className="font-medium text-gray-700">Drag and drop</span> your image here
                </div>
                <p className="text-sm text-gray-500">PNG, JPG, GIF up to 10MB</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-lg shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage();
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">{selectedFile.name}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Analyze Button - Only show when image is selected */}
        {selectedFile && (
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 
                      text-white rounded-xl hover:from-gray-700 hover:to-gray-800 
                      transition-all duration-300 disabled:from-gray-300 disabled:to-gray-400
                      disabled:cursor-not-allowed font-semibold text-lg shadow-lg
                      hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0"
          >
            {isLoading ? 'Processing...' : 'Analyze Face'}
          </button>
        )}
      </form>
      
      {error && (
        <div className="p-4 mb-6 bg-red-50 text-red-700 rounded-xl border border-red-200 shadow-sm">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}
      
      {result && result.success && (
        <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-100">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">Analysis Results</h3>
          
          <div className="mb-6">
            <h4 className="font-semibold mb-3 text-gray-700">Head Pose Angles:</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-2xl font-bold text-gray-700">{result.metrics.head_pose.pitch}°</div>
                <div className="text-sm text-gray-600">Pitch</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-2xl font-bold text-gray-700">{result.metrics.head_pose.yaw}°</div>
                <div className="text-sm text-gray-600">Yaw</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-2xl font-bold text-gray-700">{result.metrics.head_pose.roll}°</div>
                <div className="text-sm text-gray-600">Roll</div>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3 text-gray-700">Processed Image:</h4>
            <div className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <img 
                src={`data:image/jpeg;base64,${result.image}`} 
                alt="Processed face image" 
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
