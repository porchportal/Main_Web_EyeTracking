import { useState } from 'react';

export default function ImageUploader() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    const fileInput = document.getElementById('image-file');
    
    if (!fileInput.files[0]) {
      setError('Please select an image file');
      setIsLoading(false);
      return;
    }
    
    formData.append('file', fileInput.files[0]);

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

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4">Face Analysis</h2>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label htmlFor="image-file" className="block mb-2 font-medium">
            Select image:
          </label>
          <input 
            type="file" 
            id="image-file" 
            accept="image/*" 
            disabled={isLoading}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 
                      file:rounded-md file:border-0 file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        
        <button 
          type="submit" 
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                    transition-colors disabled:bg-blue-300"
        >
          {isLoading ? 'Processing...' : 'Analyze Face'}
        </button>
      </form>
      
      {error && (
        <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {result && result.success && (
        <div className="p-4 bg-gray-50 rounded-md shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Results:</h3>
          
          <div className="mb-4">
            <h4 className="font-medium mb-2">Head Pose:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Pitch: {result.metrics.head_pose.pitch}°</li>
              <li>Yaw: {result.metrics.head_pose.yaw}°</li>
              <li>Roll: {result.metrics.head_pose.roll}°</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Processed Image:</h4>
            <div className="border rounded-md overflow-hidden">
              <img 
                src={`data:image/jpeg;base64,${result.image}`} 
                alt="Processed face image" 
                className="max-w-full h-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}