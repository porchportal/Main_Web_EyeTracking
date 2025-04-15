// pages/api/file-api.js - Consolidated file operations API
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Get file lists (GET)
  if (req.method === 'GET') {
    try {
      const { operation } = req.query;
      
      // Define paths to the capture and enhance folders
      const capturePath = path.join(process.cwd(), 'public', 'captures', 'eye_tracking_captures');
      const enhancePath = path.join(process.cwd(), 'public', 'captures', 'enhance');
      
      // Create folders if they don't exist
      if (!fs.existsSync(path.join(process.cwd(), 'public', 'captures'))) {
        fs.mkdirSync(path.join(process.cwd(), 'public', 'captures'), { recursive: true });
      }
      
      if (!fs.existsSync(capturePath)) {
        fs.mkdirSync(capturePath, { recursive: true });
      }
      
      // Create enhance directory if it doesn't exist
      if (!fs.existsSync(enhancePath)) {
        fs.mkdirSync(enhancePath, { recursive: true });
      }
      
      // Different operations based on the query parameter
      if (operation === 'list') {
        // Get list of files from both folders
        const captureFiles = fs.existsSync(capturePath) 
          ? fs.readdirSync(capturePath)
              .filter(file => file.endsWith('.jpg') || file.endsWith('.csv'))
          : [];
          
        const enhanceFiles = fs.existsSync(enhancePath)
          ? fs.readdirSync(enhancePath)
              .filter(file => file.includes('_enhance_') && (file.endsWith('.jpg') || file.endsWith('.csv')))
          : [];
        
        return res.status(200).json({
          success: true,
          files: {
            capture: captureFiles,
            enhance: enhanceFiles
          }
        });
      } 
      else if (operation === 'compare') {
        // Get all capture file sets (webcam files only to avoid duplicates)
        const captureFiles = fs.existsSync(capturePath) 
          ? fs.readdirSync(capturePath).filter(file => 
              file.startsWith('webcam_') && file.endsWith('.jpg'))
          : [];
        
        // Get all enhance file sets
        const enhanceFiles = fs.existsSync(enhancePath)
          ? fs.readdirSync(enhancePath).filter(file => 
              file.startsWith('webcam_enhance_') && file.endsWith('.jpg'))
          : [];
        
        // Count unique sets by extracting numbers from filenames
        const captureSetNumbers = new Set(
          captureFiles.map(file => {
            const match = file.match(/webcam_(\d+)\.jpg/);
            return match ? match[1] : null;
          }).filter(Boolean)
        );
        
        const enhanceSetNumbers = new Set(
          enhanceFiles.map(file => {
            const match = file.match(/webcam_enhance_(\d+)\.jpg/);
            return match ? match[1] : null;
          }).filter(Boolean)
        );
        
        const captureCount = captureSetNumbers.size;
        const enhanceCount = enhanceSetNumbers.size;
        
        // Find sets that need processing (in capture but not in enhance)
        const setsNeedingProcessing = [...captureSetNumbers].filter(
          setNum => !enhanceSetNumbers.has(setNum)
        );
        
        return res.status(200).json({
          success: true,
          captureCount,
          enhanceCount,
          needsProcessing: captureCount > enhanceCount,
          setsNeedingProcessing,
          setsNeedingProcessingCount: setsNeedingProcessing.length
        });
      }
      else if (operation === 'check-completeness') {
        // Check if each set has all required files
        if (!fs.existsSync(capturePath)) {
          return res.status(200).json({
            success: false,
            error: 'Capture folder does not exist'
          });
        }
        
        // Read all files in the directory
        const allFiles = fs.readdirSync(capturePath);
        
        // Group files by their set number (e.g., 001, 002)
        const fileSets = {};
        const filePattern = /^(webcam|screen|parameters?)_(\d+)\.(jpg|csv)$/i;
        
        allFiles.forEach(file => {
          const match = file.match(filePattern);
          if (match) {
            const fileType = match[1].toLowerCase(); // webcam, screen, or parameters
            const setNumber = match[2]; // 001, 002, etc.
            
            if (!fileSets[setNumber]) {
              fileSets[setNumber] = new Set();
            }
            fileSets[setNumber].add(fileType);
          }
        });
        
        // Check if each set has all required files (webcam, screen, parameters)
        const incompleteSets = [];
        const requiredTypes = ['webcam', 'screen'];
        const parameterTypes = ['parameter', 'parameters']; // Accept both parameter and parameters
        
        Object.entries(fileSets).forEach(([setNumber, fileTypes]) => {
          const hasAllRequired = requiredTypes.every(type => fileTypes.has(type));
          const hasParameters = parameterTypes.some(type => fileTypes.has(type));
          
          if (!hasAllRequired || !hasParameters) {
            incompleteSets.push(setNumber);
          }
        });
        
        return res.status(200).json({
          success: true,
          isComplete: incompleteSets.length === 0,
          incompleteSets,
          missingFiles: incompleteSets.length,
          totalSets: Object.keys(fileSets).length
        });
      }
      else {
        return res.status(400).json({
          success: false,
          error: 'Invalid operation specified'
        });
      }
    } catch (error) {
      console.error('Error in file-api:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  else {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}