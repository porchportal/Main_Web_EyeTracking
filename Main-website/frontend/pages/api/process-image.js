// Import formidable with correct ESM syntax for Next.js
import { formidable } from 'formidable';
import fs from 'fs';
import path from 'path';

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
    
    // Check if this is a batch processing request (has set_numbers)
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('application/json')) {
      // Handle batch processing (set_numbers)
      return await handleBatchProcessing(req, res);
    } else {
      // Handle single image upload
      return await handleSingleImageUpload(req, res);
    }
    
  } catch (error) {
    console.error('Unhandled error in API route:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleBatchProcessing(req, res) {
  try {
    // Read the JSON body manually since bodyParser is disabled
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString();
    const { set_numbers } = JSON.parse(body);
    
    if (!set_numbers || !Array.isArray(set_numbers)) {
      return res.status(400).json({ error: 'Invalid set numbers' });
    }

    // Define paths
    const capturePath = path.join(process.cwd(), 'public', 'captures', 'eye_tracking_captures');
    const enhancePath = path.join(process.cwd(), 'public', 'captures', 'enhance');

    // Ensure enhance directory exists
    if (!fs.existsSync(enhancePath)) {
      fs.mkdirSync(enhancePath, { recursive: true });
    }

    const results = [];
    let processedCount = 0;

    // Process each set
    for (const setNumber of set_numbers) {
      try {
        // Process the files for this set
        await processSet(setNumber, capturePath, enhancePath);
        processedCount++;
        
        results.push({
          status: 'success',
          setNumber,
          message: `Processed set ${setNumber}`
        });
      } catch (error) {
        console.error(`Error processing set ${setNumber}:`, error);
        results.push({
          status: 'error',
          setNumber,
          message: `Error processing set ${setNumber}: ${error.message}`
        });
      }
    }

    // Return the results
    return res.status(200).json({
      success: true,
      processedCount,
      totalSets: set_numbers.length,
      results
    });

  } catch (error) {
    console.error('Error in batch processing:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}

async function handleSingleImageUpload(req, res) {
  try {
    
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
    
    
    // Get the uploaded file - in newer formidable versions, files is an object with arrays
    const fileArr = files.file;
    if (!fileArr || fileArr.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const file = fileArr[0]; // Get the first file from the array
    
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
      
      // In the backend request section
      const backendUrl = process.env.BACKEND_URL;
      const apiKey = process.env.API_KEY;

      // Send the request to the FastAPI backend with API key
      const response = await fetch(`${backendUrl}/process-image`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
        },
        body: formData,
      });
      
      
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
    console.error('Error in single image upload:', error);
    return res.status(500).json({ 
      error: 'Error processing image upload', 
      message: error.message 
    });
  }
}

async function processSet(setNumber, capturePath, enhancePath) {
  // Process each file type for the set
  const fileTypes = ['webcam', 'screen', 'parameter'];
  
  for (const fileType of fileTypes) {
    const sourceFile = path.join(capturePath, `${fileType}_${setNumber}.${fileType === 'parameter' ? 'csv' : 'jpg'}`);
    const targetFile = path.join(enhancePath, `${fileType}_enhance_${setNumber}.${fileType === 'parameter' ? 'csv' : 'jpg'}`);

    if (fs.existsSync(sourceFile)) {
      // For now, just copy the file to the enhance directory
      // In a real implementation, you would process the image here
      fs.copyFileSync(sourceFile, targetFile);
    }
  }
}

