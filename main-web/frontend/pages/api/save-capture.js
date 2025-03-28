// pages/api/save-capture.js
import fs from 'fs';
import path from 'path';

// Store default folder name - use a fixed name instead of timestamp-based folder
const DEFAULT_FOLDER = 'eye_tracking_captures';

// Track the current capture number
let currentCaptureNumber = 1;

// Function to get the next available number for naming files
const getNextCaptureNumber = (capturesDir) => {
  try {
    // If the captures directory doesn't exist yet, start from 1
    if (!fs.existsSync(capturesDir)) {
      return 1;
    }
    
    // Look for existing screen capture files to determine the next number
    const files = fs.readdirSync(capturesDir);
    const screenFiles = files.filter(file => file.startsWith('screen_') && file.endsWith('.jpg'));
    
    if (screenFiles.length === 0) {
      return 1;
    }
    
    // Extract numbers from filenames and find the highest
    const numbers = screenFiles.map(file => {
      const match = file.match(/screen_(\d+)\.jpg/);
      return match ? parseInt(match[1], 10) : 0;
    });
    
    const maxNumber = Math.max(...numbers);
    return maxNumber + 1;
  } catch (error) {
    console.error('Error determining next capture number:', error);
    return 1; // Fallback to 1 if there's an error
  }
};

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
    
    // Use the provided folder, or use the default folder
    const captureFolder = folder || DEFAULT_FOLDER;
    
    // Ensure the base captures directory exists
    const capturesDir = path.join(process.cwd(), 'public', 'captures');
    if (!fs.existsSync(capturesDir)) {
      fs.mkdirSync(capturesDir, { recursive: true });
    }
    
    // Ensure the capture folder exists
    const sessionDir = path.join(capturesDir, captureFolder);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
      
      // Initialize the capture number if this is a new folder
      currentCaptureNumber = 1;
    } else if (currentCaptureNumber === 1) {
      // If the folder exists and we haven't determined the next number yet
      currentCaptureNumber = getNextCaptureNumber(sessionDir);
    }
    
    // Check if we need to use continuous numbering
    let finalFilename = filename;
    
    // If the filename includes a counter pattern (like screen_001.jpg), replace it with the continuous number
    if (filename.match(/_(0+\d+)\./)) {
      const paddedNumber = String(currentCaptureNumber).padStart(3, '0');
      const prefix = filename.split('_')[0]; // Get 'screen', 'webcam', etc.
      finalFilename = `${prefix}_${paddedNumber}.jpg`;
      
      // Only increment the counter after a screen image (to avoid incrementing multiple times for one capture)
      if (type === 'screen') {
        currentCaptureNumber++;
      }
    }
    
    let buffer;
    
    // Handle different file types
    if (type === 'parameters' && filename.endsWith('.csv')) {
      // Handle CSV data
      if (!imageData.startsWith('data:')) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid CSV data format. Expected data URL.' 
        });
      }
      
      // Extract the base64 part
      const base64Data = imageData.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      // Handle image data (screen or webcam captures)
      if (!imageData.startsWith('data:image/')) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid image data format. Expected base64 data URL.' 
        });
      }
      
      // Extract the base64 part
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    }
    
    // Save the file
    const filePath = path.join(sessionDir, finalFilename);
    fs.writeFileSync(filePath, buffer);
    
    // Log success and return response
    console.log(`Successfully saved ${type} file: ${finalFilename} in folder ${captureFolder}`);
    res.status(200).json({ 
      success: true, 
      message: `Successfully saved ${type} file: ${finalFilename}`,
      path: `/captures/${captureFolder}/${finalFilename}`,
      folder: captureFolder,
      captureNumber: currentCaptureNumber - 1 // Return the number that was just used
    });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}