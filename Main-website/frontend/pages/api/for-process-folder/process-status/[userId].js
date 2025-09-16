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
      // The backend writes to /app/resource_security/public/captures/{userId}/processing_progress.json
      // which maps to the auth_service directory structure
      const progressFilePath = path.join(capturesPath, 'processing_progress.json');
      
      // Also check for progress file in the parent directory (in case of path issues)
      const alternativeProgressPath = path.join(process.cwd(), '..', 'backend', 'auth_service', 'resource_security', 'public', 'captures', userId, 'processing_progress.json');
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
      
      // Try to read progress file from primary location first
      if (fs.existsSync(progressFilePath)) {
        try {
          const progressData = fs.readFileSync(progressFilePath, 'utf8');
          progressInfo = JSON.parse(progressData);
          console.log('Progress file found and parsed from primary location:', {
            currentSet: progressInfo.currentSet,
            totalSets: progressInfo.totalSets,
            progress: progressInfo.progress,
            status: progressInfo.status,
            message: progressInfo.message
          });
        } catch (err) {
          console.error("Error reading progress file from primary location:", err);
          // Try alternative location
          if (fs.existsSync(alternativeProgressPath)) {
            try {
              const progressData = fs.readFileSync(alternativeProgressPath, 'utf8');
              progressInfo = JSON.parse(progressData);
              console.log('Progress file found and parsed from alternative location:', {
                currentSet: progressInfo.currentSet,
                totalSets: progressInfo.totalSets,
                progress: progressInfo.progress,
                status: progressInfo.status,
                message: progressInfo.message
              });
            } catch (altErr) {
              console.error("Error reading progress file from alternative location:", altErr);
            }
          }
        }
      } else if (fs.existsSync(alternativeProgressPath)) {
        // Try alternative location if primary doesn't exist
        try {
          const progressData = fs.readFileSync(alternativeProgressPath, 'utf8');
          progressInfo = JSON.parse(progressData);
          console.log('Progress file found and parsed from alternative location:', {
            currentSet: progressInfo.currentSet,
            totalSets: progressInfo.totalSets,
            progress: progressInfo.progress,
            status: progressInfo.status,
            message: progressInfo.message
          });
        } catch (err) {
          console.error("Error reading progress file from alternative location:", err);
        }
      } else {
        console.log('Progress file not found at either location:', {
          primary: progressFilePath,
          alternative: alternativeProgressPath
        });
        // Check if the directory exists
        if (fs.existsSync(capturesPath)) {
          const files = fs.readdirSync(capturesPath);
          console.log('Available files in captures directory:', files);
        } else {
          console.log('Captures directory does not exist:', capturesPath);
        }
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