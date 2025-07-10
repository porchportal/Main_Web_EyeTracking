// pages/api/save-capture.js
import fs from 'fs';
import path from 'path';

const DEFAULT_FOLDER = 'eye_tracking_captures';

/**
 * Find the highest existing capture number
 * @param {string} capturesDir - Directory to check for capture files
 * @returns {number} - Highest existing capture number
 */
const getHighestExistingNumber = (capturesDir) => {
  try {
    if (!fs.existsSync(capturesDir)) return 0;

    const files = fs.readdirSync(capturesDir);
    const captureFiles = files.filter(file =>
      (file.startsWith('screen_') ||
        file.startsWith('webcam_') ||
        file.startsWith('parameter_')) &&
      file.match(/\_\d{3}\.(jpg|png|csv)$/)
    );

    if (captureFiles.length === 0) return 0;

    const numbers = captureFiles.map(file => {
      const match = file.match(/\_(\d{3})\.(jpg|png|csv)$/);
      return match ? parseInt(match[1], 10) : 0;
    });

    return Math.max(...numbers);
  } catch (error) {
    console.error('Error finding highest capture number:', error);
    return 0;
  }
};

// Globals to track capture groups
let currentCaptureGroup = null;
let currentCaptureNumber = null;
let captureGroupTimeout = null;
const CAPTURE_GROUP_TIMEOUT = 5000; // 5 seconds

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { imageData, filename, type, folder, captureGroup } = req.body;

    if (!imageData || !filename || !type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: imageData, filename, or type'
      });
    }

    const captureFolder = folder || DEFAULT_FOLDER;

    const capturesDir = path.join(process.cwd(), 'public', 'captures');
    if (!fs.existsSync(capturesDir)) {
      fs.mkdirSync(capturesDir, { recursive: true });
    }

    const sessionDir = path.join(capturesDir, captureFolder);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Handle capture grouping
    let nextNumber;
    
    // If a captureGroup is provided and it matches the current one, use the same number
    if (captureGroup && captureGroup === currentCaptureGroup && currentCaptureNumber) {
      nextNumber = currentCaptureNumber;
      
      // Reset the timeout to keep this group alive
      clearTimeout(captureGroupTimeout);
      captureGroupTimeout = setTimeout(() => {
        currentCaptureGroup = null;
        currentCaptureNumber = null;
      }, CAPTURE_GROUP_TIMEOUT);
      
      console.log(`Using existing capture group ${captureGroup} with number ${nextNumber}`);
    } 
    // If this is a new capture or the first file in a new group
    else {
      // Get next number from highest existing
      nextNumber = getHighestExistingNumber(sessionDir) + 1;
      
      // If a group is specified, remember this number for this group
      if (captureGroup) {
        currentCaptureGroup = captureGroup;
        currentCaptureNumber = nextNumber;
        
        // Set timeout to clear this group after some time
        clearTimeout(captureGroupTimeout);
        captureGroupTimeout = setTimeout(() => {
          currentCaptureGroup = null;
          currentCaptureNumber = null;
        }, CAPTURE_GROUP_TIMEOUT);
        
        console.log(`Started new capture group ${captureGroup} with number ${nextNumber}`);
      }
    }
    
    const padded = String(nextNumber).padStart(3, '0');

    // Determine prefix from incoming filename
    const prefix = filename.split('_')[0];
    const extension = filename.split('.').pop();
    const finalFilename = `${prefix}_${padded}.${extension}`;

    let buffer;

    if (type === 'parameters' && filename.endsWith('.csv')) {
      if (!imageData.startsWith('data:')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid CSV data format. Expected data URL.'
        });
      }

      const base64Data = imageData.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      if (!imageData.startsWith('data:image/')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid image data format. Expected base64 data URL.'
        });
      }

      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    }

    const filePath = path.join(sessionDir, finalFilename);
    fs.writeFileSync(filePath, buffer);

    console.log(`✅ Saved ${type} file as ${finalFilename}`);

    res.status(200).json({
      success: true,
      message: `Saved ${type} as ${finalFilename}`,
      filename: finalFilename,
      number: nextNumber,
      path: `/captures/${captureFolder}/${finalFilename}`,
      folder: captureFolder,
      group: captureGroup
    });
  } catch (error) {
    console.error('❌ Error saving file:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}