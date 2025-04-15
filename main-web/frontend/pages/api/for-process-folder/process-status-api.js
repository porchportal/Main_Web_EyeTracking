// pages/api/process-status-api.js - API to handle process status checks and triggers
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import fetch from 'node-fetch';

// Convert exec to Promise-based
const execPromise = util.promisify(exec);

// Function to process files via the FastAPI backend
async function processFilesViaBackend(setNumbers) {
  try {
    // Get the backend URL from environment variable or use default
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const apiKey = process.env.API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';
    
    // Call the FastAPI backend to process the files
    const response = await fetch(`${backendUrl}/process-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ 
        set_numbers: setNumbers,
        show_head_pose: true,
        show_bounding_box: true,
        show_mask: false,
        show_parameters: false
      })
    });
    
    // Check if the request was successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend processing error:', errorText);
      return { success: false, error: `Backend error: ${response.status} ${response.statusText}` };
    }
    
    // Parse the response
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling backend for processing:', error);
    return { success: false, error: error.message };
  }
}

// Function to process files directly in Node.js
async function processFilesDirectly(setNumbers, captureDir, enhancePath, progressFilePath) {
  try {
    // Get current progress or initialize
    let progress = {
      currentSet: 0,
      totalSets: setNumbers.length,
      processedSets: [],
      startTime: new Date().toISOString(),
      lastUpdateTime: new Date().toISOString()
    };
    
    // Process each set
    for (const setNumber of setNumbers) {
      try {
        progress.currentSet = setNumber;
        fs.writeFileSync(progressFilePath, JSON.stringify(progress, null, 2));
        
        // Process webcam image
        const webcamSrcPath = path.join(captureDir, `webcam_${setNumber}.jpg`);
        const webcamDestPath = path.join(enhancePath, `webcam_enhance_${setNumber}.jpg`);
        
        if (fs.existsSync(webcamSrcPath)) {
          // Simple copy for the enhancement demonstration
          fs.copyFileSync(webcamSrcPath, webcamDestPath);
        }
        
        // Process screen image if it exists
        const screenSrcPath = path.join(captureDir, `screen_${setNumber}.jpg`);
        const screenDestPath = path.join(enhancePath, `screen_enhance_${setNumber}.jpg`);
        
        if (fs.existsSync(screenSrcPath)) {
          fs.copyFileSync(screenSrcPath, screenDestPath);
        }
        
        // Process parameters file if it exists (try both parameter and parameters naming)
        const paramFileNames = [
          `parameters_${setNumber}.csv`,
          `parameter_${setNumber}.csv`
        ];
        
        for (const paramFileName of paramFileNames) {
          const paramSrcPath = path.join(captureDir, paramFileName);
          if (fs.existsSync(paramSrcPath)) {
            const paramDestPath = path.join(enhancePath, paramFileName.replace('parameter', 'parameter_enhance'));
            fs.copyFileSync(paramSrcPath, paramDestPath);
            break; // Found and copied one parameter file, no need to check the other
          }
        }
        
        // Update progress
        progress.processedSets.push(setNumber);
        progress.lastUpdateTime = new Date().toISOString();
        fs.writeFileSync(progressFilePath, JSON.stringify(progress, null, 2));
        
        // Add a small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`Error processing set ${setNumber}:`, err);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in direct processing:', error);
    return { success: false, error: error.message };
  }
}

export default async function handler(req, res) {
  // Handle GET request to check processing status
  if (req.method === 'GET') {
    try {
      const capturesPath = path.join(process.cwd(), 'public', 'captures', 'eye_tracking_captures');
      const enhancePath = path.join(process.cwd(), 'public', 'captures', 'enhance');
      
      // Create captures directory if it doesn't exist
      if (!fs.existsSync(path.join(process.cwd(), 'public', 'captures'))) {
        fs.mkdirSync(path.join(process.cwd(), 'public', 'captures'), { recursive: true });
      }
      
      // Create capture directory if it doesn't exist
      if (!fs.existsSync(capturesPath)) {
        fs.mkdirSync(capturesPath, { recursive: true });
      }
      
      // Create enhance directory if it doesn't exist
      if (!fs.existsSync(enhancePath)) {
        fs.mkdirSync(enhancePath, { recursive: true });
      }
      
      // Check if there's a processing.lock file (indicating processing is in progress)
      const lockFilePath = path.join(process.cwd(), 'public', 'captures', 'processing.lock');
      const isProcessing = fs.existsSync(lockFilePath);
      
      // Check for progress information file
      const progressFilePath = path.join(process.cwd(), 'public', 'captures', 'processing_progress.json');
      let progressInfo = { 
        currentSet: 0,
        totalSets: 0,
        processedSets: [],
        startTime: null,
        lastUpdateTime: null
      };
      
      if (fs.existsSync(progressFilePath)) {
        try {
          const progressData = fs.readFileSync(progressFilePath, 'utf8');
          progressInfo = JSON.parse(progressData);
        } catch (err) {
          console.error("Error reading progress file:", err);
        }
      }
      
      // Count files in each directory
      const captureFiles = fs.existsSync(capturesPath) 
        ? fs.readdirSync(capturesPath).filter(file => 
            file.startsWith('webcam_') && file.endsWith('.jpg')).length
        : 0;
        
      const enhanceFiles = fs.existsSync(enhancePath)
        ? fs.readdirSync(enhancePath).filter(file => 
            file.startsWith('webcam_enhance_') && file.endsWith('.jpg')).length
        : 0;
      
      return res.status(200).json({
        success: true,
        isProcessing,
        captureCount: captureFiles,
        enhanceCount: enhanceFiles,
        needsProcessing: captureFiles > enhanceFiles,
        progress: progressInfo
      });
    } catch (error) {
      console.error('Error checking process status:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  // Handle POST request to trigger processing
  else if (req.method === 'POST') {
    try {
      // Get list of files to process from request body
      const { setNumbers } = req.body;
      
      if (!setNumbers || !Array.isArray(setNumbers) || setNumbers.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No set numbers provided for processing'
        });
      }
      
      // Make sure the directory exists before creating the lock file
      const capturesDir = path.join(process.cwd(), 'public', 'captures');
      if (!fs.existsSync(capturesDir)) {
        fs.mkdirSync(capturesDir, { recursive: true });
      }
      
      // Create enhance directory if it doesn't exist
      const enhancePath = path.join(process.cwd(), 'public', 'captures', 'enhance');
      if (!fs.existsSync(enhancePath)) {
        fs.mkdirSync(enhancePath, { recursive: true });
      }
      
      // Create lock file to indicate processing is in progress
      const lockFilePath = path.join(capturesDir, 'processing.lock');
      
      try {
        fs.writeFileSync(lockFilePath, new Date().toISOString());
        console.log(`Created lock file at ${lockFilePath}`);
      } catch (err) {
        console.error(`Error creating lock file: ${err.message}`);
        return res.status(500).json({
          success: false,
          error: `Failed to create lock file: ${err.message}`
        });
      }
      
      // Create initial progress file
      const progressFilePath = path.join(capturesDir, 'processing_progress.json');
      const progressInfo = {
        currentSet: 0,
        totalSets: setNumbers.length,
        processedSets: [],
        startTime: new Date().toISOString(),
        lastUpdateTime: new Date().toISOString()
      };
      
      try {
        fs.writeFileSync(progressFilePath, JSON.stringify(progressInfo, null, 2));
      } catch (err) {
        console.error(`Error creating progress file: ${err.message}`);
      }
      
      // Define paths for processing
      const captureDir = path.join(process.cwd(), 'public', 'captures', 'eye_tracking_captures');
      
      // Determine which processing method to use
      const useBackend = process.env.USE_PYTHON_BACKEND === 'true';
      
      if (useBackend) {
        console.log(`Starting backend processing of ${setNumbers.length} sets...`);
        
        // Start processing with the Python backend
        processFilesViaBackend(setNumbers)
          .then(result => {
            console.log('Backend processing completed with result:', result);
            // Clean up the lock file when done
            if (fs.existsSync(lockFilePath)) {
              fs.unlinkSync(lockFilePath);
            }
          })
          .catch(err => {
            console.error('Backend processing failed:', err);
            // Clean up the lock file on error
            if (fs.existsSync(lockFilePath)) {
              fs.unlinkSync(lockFilePath);
            }
          });
        
        return res.status(200).json({
          success: true,
          message: 'Processing started',
          setsToProcess: setNumbers.length,
          processingMethod: 'python-backend'
        });
      } else {
        console.log(`Starting direct processing of ${setNumbers.length} sets...`);
        
        // Start processing in the background using direct Node.js processing
        processFilesDirectly(setNumbers, captureDir, enhancePath, progressFilePath)
          .then(result => {
            console.log('Processing completed with result:', result);
            // Clean up the lock file when done
            if (fs.existsSync(lockFilePath)) {
              fs.unlinkSync(lockFilePath);
            }
          })
          .catch(err => {
            console.error('Processing failed:', err);
            // Clean up the lock file on error
            if (fs.existsSync(lockFilePath)) {
              fs.unlinkSync(lockFilePath);
            }
          });
        
        return res.status(200).json({
          success: true,
          message: 'Processing started',
          setsToProcess: setNumbers.length,
          processingMethod: 'direct'
        });
      }
    } catch (error) {
      console.error('Error triggering processing:', error);
      
      // If there's an error, make sure to delete the lock file
      const lockFilePath = path.join(process.cwd(), 'public', 'captures', 'processing.lock');
      if (fs.existsSync(lockFilePath)) {
        try {
          fs.unlinkSync(lockFilePath);
        } catch (e) {
          console.error('Error removing lock file:', e);
        }
      }
      
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