// testAI_image.js - API endpoint for individual image processing with AI
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
    
    // Parse the multipart form data
    const form = formidable({
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
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
    
    const file = fileArr[0];
    
    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/avif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({ 
        error: 'Unsupported file type. Please upload JPG, JPEG, PNG, GIF, BMP, WebP, or AVIF images only.',
        receivedType: file.mimetype
      });
    }
    
    // Get processing options from form fields
    const showHeadPose = fields.show_head_pose === 'true';
    const showBoundingBox = fields.show_bounding_box === 'true';
    const showMask = fields.show_mask === 'true';
    const showParameters = fields.show_parameters === 'true';
    const enhanceFace = fields.enhance_face === 'true'; // Default to false
    
    try {
      // Check if the file path exists
      const filePath = file.filepath;
      
      if (!fs.existsSync(filePath)) {
        return res.status(400).json({ error: 'File path does not exist' });
      }
      
      // Read the file
      const fileBuffer = fs.readFileSync(filePath);
      
      // Create a FormData object to send to the backend
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: file.mimetype || 'application/octet-stream' });
      formData.append('file', blob, file.originalFilename || 'image.jpg');
      
      // Add processing options to the form data
      formData.append('show_head_pose', showHeadPose.toString());
      formData.append('show_bounding_box', showBoundingBox.toString());
      formData.append('show_mask', showMask.toString());
      formData.append('show_parameters', showParameters.toString());
      formData.append('enhance_face', enhanceFace.toString());
      
      // Get backend configuration from environment variables
      // Use internal Docker network URL for backend communication
      const backendUrl = process.env.BACKEND_URL || 'http://backend_image_service:8010';
      const apiKey = process.env.NEXT_PUBLIC_API_KEY;

      
      // Send the request to the FastAPI backend
      const response = await fetch(`${backendUrl}/process-single-image`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ 
          error: `Backend returned error: ${response.status}`, 
          details: errorText 
        });
      }
      
      const data = await response.json();
      
      // Clean up the temporary file
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
      }
      
      return res.status(200).json(data);
      
    } catch (error) {
      return res.status(500).json({ 
        error: 'Error communicating with backend service', 
        message: error.message 
      });
    }
  } catch (error) {
    return res.status(500).json({ 
      error: 'Error processing image upload', 
      message: error.message 
    });
  }
}
