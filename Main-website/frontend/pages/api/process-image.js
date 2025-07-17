// Import formidable with correct ESM syntax for Next.js
import { formidable } from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // Disables body parsing, required for formidable
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log("Processing image upload request...");
    
    // Parse the multipart form data with updated formidable API
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
    
    console.log("Form parsed successfully");
    
    // Get the uploaded file - in newer formidable versions, files is an object with arrays
    const fileArr = files.file;
    if (!fileArr || fileArr.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const file = fileArr[0]; // Get the first file from the array
    console.log("File received:", file.originalFilename);
    
    try {
      // Check if the file path exists
      const filePath = file.filepath;
      console.log("File path:", filePath);
      
      if (!fs.existsSync(filePath)) {
        return res.status(400).json({ error: 'File path does not exist' });
      }
      
      // Read the file
      const fileBuffer = fs.readFileSync(filePath);
      
      // Create a FormData object to send to the backend
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: file.mimetype || 'application/octet-stream' });
      formData.append('file', blob, file.originalFilename || 'image.jpg');
      
      // In the backend request section
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8010';
      const apiKey = process.env.API_KEY || '';

      // Send the request to the FastAPI backend with API key
      const response = await fetch(`${backendUrl}/process-image`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
        },
        body: formData,
      });
      
      console.log("Backend response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend error response:", errorText);
        return res.status(response.status).json({ 
          error: `Backend returned error: ${response.status}`, 
          details: errorText 
        });
      }
      
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
    console.error('Unhandled error in API route:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

