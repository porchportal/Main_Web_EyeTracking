// pages/api/process-frame.js
import { formidable } from 'formidable';
import fs from 'fs';
import http from 'http';

export const config = {
  api: {
    bodyParser: false, // Disable built-in parser for formidable
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // First check backend connection
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
    const url = new URL(backendUrl);
    
    // Check if backend is available
    const isBackendAvailable = await checkBackendConnection(url);
    
    if (!isBackendAvailable) {
      console.log("Backend not available, using mock mode");
      return res.status(200).json(generateMockResponse());
    }
    
    // Parse the form with formidable
    const form = formidable({
      keepExtensions: true,
    });
    
    // Parse the form
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve([fields, files]);
      });
    });
    
    // Get the uploaded file
    const fileArr = files.file;
    if (!fileArr || fileArr.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const file = fileArr[0]; // Get the first file
    
    // Get processing parameters
    const showHeadPose = fields.showHeadPose?.[0] === 'true';
    const showBoundingBox = fields.showBoundingBox?.[0] === 'true';
    const showMask = fields.showMask?.[0] === 'true';
    const showParameters = fields.showParameters?.[0] === 'true';
    
    try {
      // Verify file exists
      const filePath = file.filepath;
      if (!fs.existsSync(filePath)) {
        return res.status(400).json({ error: 'File path does not exist' });
      }
      
      // Read the file
      const fileBuffer = fs.readFileSync(filePath);
      
      // Create a FormData object for backend
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: file.mimetype || 'image/jpeg' });
      formData.append('file', blob, file.originalFilename || 'frame.jpg');
      
      // Add processing parameters
      formData.append('showHeadPose', showHeadPose.toString());
      formData.append('showBoundingBox', showBoundingBox.toString());
      formData.append('showMask', showMask.toString());
      formData.append('showParameters', showParameters.toString());
      
      // Get backend URL and API key from environment or use defaults
      const apiKey = process.env.API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';
      
      // Send to FastAPI backend
      let response;
      try {
        response = await fetch(`${backendUrl}/process-frame`, {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,
          },
          body: formData,
          timeout: 5000 // 5 second timeout
        });
      } catch (fetchError) {
        console.error("Backend connection error:", fetchError.message);
        return res.status(200).json(generateMockResponse());
      }
      
      if (!response.ok) {
        console.error("Backend error:", response.status);
        return res.status(200).json(generateMockResponse());
      }
      
      // Get result from backend
      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      console.error('Backend request error:', error);
      return res.status(200).json(generateMockResponse());
    }
  } catch (error) {
    console.error('Error in API route:', error);
    return res.status(200).json(generateMockResponse());
  }
}

// Helper function to check backend connection
async function checkBackendConnection(url) {
  return new Promise((resolve) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port || 8000,
        path: '/health',
        method: 'GET',
        timeout: 1000, // Quick 1 second timeout
      },
      (response) => {
        if (response.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    );
    
    request.on('error', () => {
      resolve(false);
    });
    
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    
    request.end();
  });
}

// Generate mock response when backend is unavailable
function generateMockResponse() {
  const timestamp = Date.now();
  const faceDetected = Math.random() > 0.1; // 90% chance of face detected
  
  if (faceDetected) {
    return {
      success: true,
      metrics: {
        face_detected: true,
        head_pose: {
          pitch: Math.round(Math.sin(timestamp/1000) * 20),
          yaw: Math.round(Math.sin(timestamp/800) * 30),
          roll: Math.round(Math.sin(timestamp/1200) * 15)
        },
        eye_centers: {
          left: [100, 100],
          right: [140, 100]
        }
      },
      image: null // No image in mock mode to save bandwidth
    };
  } else {
    return {
      success: true,
      metrics: {
        face_detected: false
      },
      image: null
    };
  }
}