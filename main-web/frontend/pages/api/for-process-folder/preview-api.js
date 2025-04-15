// pages/api/preview-api.js - File preview API
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { filename } = req.query;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required'
      });
    }
    
    // Determine which folder to look in based on filename
    let folderPath;
    if (filename.includes('_enhance_')) {
      folderPath = path.join(process.cwd(), 'public', 'captures', 'enhance');
    } else {
      folderPath = path.join(process.cwd(), 'public', 'captures', 'eye_tracking_captures');
    }
    
    const filePath = path.join(folderPath, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Read file data
    const fileData = fs.readFileSync(filePath);
    
    // Handle different file types
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.png')) {
      // For images, return base64 encoded data
      const base64Data = fileData.toString('base64');
      return res.status(200).json({
        success: true,
        data: base64Data,
        type: 'image'
      });
    } else if (filename.endsWith('.csv')) {
      // For CSV files, return as text
      const textData = fileData.toString('utf-8');
      return res.status(200).json({
        success: true,
        data: textData,
        type: 'csv'
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported file type'
      });
    }
  } catch (error) {
    console.error('Error previewing file:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}