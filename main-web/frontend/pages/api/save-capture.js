// pages/api/save-capture.js
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { imageData, filename, type, folder } = req.body;
    
    if (!imageData || !filename || !type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: imageData, filename, or type' 
      });
    }
    
    // Use a default folder name if none provided
    const captureFolder = folder || `session_${new Date().toISOString().replace(/[:\.]/g, '-')}`;
    
    // Ensure the base captures directory exists
    const capturesDir = path.join(process.cwd(), 'public', 'captures');
    if (!fs.existsSync(capturesDir)) {
      fs.mkdirSync(capturesDir, { recursive: true });
    }
    
    // Ensure the session folder exists
    const sessionDir = path.join(capturesDir, captureFolder);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // Convert base64 data to image file
    // First check if the data is in the expected format
    if (!imageData.startsWith('data:image/')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid image data format. Expected base64 data URL.' 
      });
    }
    
    // Extract the base64 part
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Save the file
    const filePath = path.join(sessionDir, filename);
    fs.writeFileSync(filePath, buffer);
    
    // Log success and return response
    console.log(`Successfully saved ${type} image: ${filename} in folder ${captureFolder}`);
    res.status(200).json({ 
      success: true, 
      message: `Successfully saved ${type} image: ${filename}`,
      path: `/captures/${captureFolder}/${filename}`,
      folder: captureFolder
    });
  } catch (error) {
    console.error('Error saving image:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}