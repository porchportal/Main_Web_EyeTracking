// pages/api/for-process-folder/process-status/[userId].js - User-specific process status API
import fs from 'fs';
import path from 'path';


// Main handler for API requests
export default async function handler(req, res) {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  // Handle GET request to check processing status
  if (req.method === 'GET') {
    try {
      // Use the same path structure that the backend uses for progress files
      const capturesPath = path.join(process.cwd(), '..', 'backend', 'auth_service', 'resource_security', 'public', 'captures', userId);
      const enhancePath = path.join(process.cwd(), '..', 'backend', 'auth_service', 'resource_security', 'public', 'enhance', userId);
      const completePath = path.join(process.cwd(), '..', 'backend', 'auth_service', 'resource_security', 'public', 'complete', userId);
      
      // Check if there's a processing.lock file (indicating processing is in progress)
      const lockFilePath = path.join(capturesPath, 'processing.lock');
      const isProcessing = fs.existsSync(lockFilePath);
      
      // Check for progress information file created by the backend
      const progressFilePath = path.join(capturesPath, 'processing_progress.json');
      let progressInfo = { 
        currentSet: 0,
        totalSets: 0,
        processedSets: [],
        startTime: null,
        lastUpdateTime: null,
        status: 'idle',
        message: '',
        currentFile: '',
        progress: 0
      };
      
      if (fs.existsSync(progressFilePath)) {
        try {
          const progressData = fs.readFileSync(progressFilePath, 'utf8');
          progressInfo = JSON.parse(progressData);
          console.log('Progress file found and parsed:', progressInfo);
        } catch (err) {
          console.error("Error reading progress file:", err);
        }
      } else {
        console.log('Progress file not found at:', progressFilePath);
      }
      
      // Count files in each directory
      const captureFiles = fs.existsSync(capturesPath) 
        ? fs.readdirSync(capturesPath).filter(file => 
            file.startsWith('webcam_') && file.endsWith('.jpg') && !file.includes('_enhance_')).length
        : 0;
        
      // Count enhance files (webcam_enhance_XXX.jpg format)
      const enhanceFiles = fs.existsSync(enhancePath)
        ? fs.readdirSync(enhancePath).filter(file => 
            file.startsWith('webcam_enhance_') && file.endsWith('.jpg')).length
        : 0;
        
      // Count complete files (webcam_XXX.jpg format, excluding enhance files)
      const completeFiles = fs.existsSync(completePath)
        ? fs.readdirSync(completePath).filter(file => 
            file.startsWith('webcam_') && file.endsWith('.jpg') && !file.includes('_enhance_')).length
        : 0;
      
      return res.status(200).json({
        success: true,
        isProcessing,
        captureCount: captureFiles,
        enhanceCount: enhanceFiles,
        completeCount: completeFiles,
        totalProcessedCount: enhanceFiles + completeFiles,
        needsProcessing: captureFiles > (enhanceFiles + completeFiles),
        progress: progressInfo,
        userId: userId
      });
    } catch (error) {
      console.error('Error checking process status:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  else {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }
}