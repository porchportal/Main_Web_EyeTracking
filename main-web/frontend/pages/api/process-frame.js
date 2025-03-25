// pages/api/process-frame.js
import { formidable } from 'formidable';
import fs from 'fs';

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
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
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
        return res.status(503).json({
          error: "Backend connection failed",
          details: fetchError.message,
          success: false
        });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend error:", errorText);
        return res.status(response.status).json({ 
          error: `Backend error: ${response.status}`, 
          details: errorText 
        });
      }
      
      // Get result from backend
      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      console.error('Backend request error:', error);
      return res.status(500).json({ 
        error: 'Error communicating with backend service', 
        message: error.message 
      });
    }
  } catch (error) {
    console.error('Error in API route:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// pages/api/process-video.js
// Similar implementation to process-frame.js but for video files
// Removed duplicate config export to prevent redeclaration error.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
      const blob = new Blob([fileBuffer], { type: file.mimetype || 'video/mp4' });
      formData.append('file', blob, file.originalFilename || 'video.mp4');
      
      // Add processing parameters
      formData.append('showHeadPose', showHeadPose.toString());
      formData.append('showBoundingBox', showBoundingBox.toString());
      formData.append('showMask', showMask.toString());
      formData.append('showParameters', showParameters.toString());
      
      // Get backend URL and API key from environment or use defaults
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
      const apiKey = process.env.API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';
      
      // Send to FastAPI backend
      let response;
      try {
        response = await fetch(`${backendUrl}/process-video`, {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,
          },
          body: formData,
          timeout: 15000 // 15 second timeout for video processing
        });
      } catch (fetchError) {
        console.error("Backend connection error:", fetchError.message);
        return res.status(503).json({
          error: "Backend connection failed",
          details: fetchError.message,
          success: false
        });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend error:", errorText);
        return res.status(response.status).json({ 
          error: `Backend error: ${response.status}`, 
          details: errorText 
        });
      }
      
      // Get result from backend
      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      console.error('Backend request error:', error);
      return res.status(500).json({ 
        error: 'Error communicating with backend service', 
        message: error.message 
      });
    }
  } catch (error) {
    console.error('Error in API route:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// pages/api/check-backend-connection.js
export default async function handler(req, res) {
  try {
    // Get backend URL from environment or use default
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    
    // Try to connect to the backend health check endpoint
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      timeout: 3000 // 3 second timeout
    });
    
    if (response.ok) {
      return res.status(200).json({ connected: true });
    } else {
      return res.status(200).json({ connected: false });
    }
  } catch (error) {
    console.error('Backend connection check failed:', error);
    return res.status(200).json({ connected: false });
  }
}