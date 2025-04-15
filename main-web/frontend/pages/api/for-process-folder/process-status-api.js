// pages/api/process-status-api.js - API to handle process status checks and triggers
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

// Convert exec to Promise-based
const execPromise = util.promisify(exec);

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
      
      // Create enhance directory if it doesn't exist
      if (!fs.existsSync(enhancePath)) {
        fs.mkdirSync(enhancePath, { recursive: true });
      }
      
      // Check if there's a processing.lock file (indicating processing is in progress)
      const lockFilePath = path.join(process.cwd(), 'public', 'captures', 'processing.lock');
      const isProcessing = fs.existsSync(lockFilePath);
      
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
        needsProcessing: captureFiles > enhanceFiles
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
      
      // Create a command to run the Python script with absolute paths
      const pythonScript = path.join(process.cwd(), 'backend', 'process_images.py');
      const setsParam = setNumbers.join(',');
      
      // Check if Python script exists and log paths for debugging
      console.log('Checking for Python script at:', pythonScript);
      console.log('Current working directory:', process.cwd());
      console.log('Directory listing for backend folder:');
      
      try {
        const backendDir = path.join(process.cwd(), 'backend');
        if (fs.existsSync(backendDir)) {
          console.log('Files in backend directory:');
          console.log(fs.readdirSync(backendDir));
        } else {
          console.log('Backend directory does not exist at:', backendDir);
        }
      } catch (err) {
        console.error('Error listing backend directory:', err);
      }
      
      if (!fs.existsSync(pythonScript)) {
        console.error(`Python script not found at: ${pythonScript}`);
        // Try alternative locations
        const altLocations = [
          path.join(process.cwd(), 'process_images.py'),
          path.join(process.cwd(), '..', 'backend', 'process_images.py')
        ];
        
        let scriptFound = false;
        for (const loc of altLocations) {
          console.log('Checking alternative location:', loc);
          if (fs.existsSync(loc)) {
            console.log('Found script at alternative location:', loc);
            scriptFound = true;
            break;
          }
        }
        
        if (!scriptFound) {
          // Clean up lock file if script not found
          if (fs.existsSync(lockFilePath)) {
            fs.unlinkSync(lockFilePath);
          }
          return res.status(500).json({
            success: false,
            error: 'Processing script not found. Checked locations: ' + 
                   [pythonScript, ...altLocations].join(', ')
          });
        }
      }
      
      // Determine Python executable (python3 or python)
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      
      // Execute the Python script with full path arguments
      const cmd = `${pythonCmd} "${pythonScript}" --sets ${setsParam} --lock "${lockFilePath}" --root "${process.cwd()}"`;
      console.log(`Executing command: ${cmd}`);
      
      // Execute the Python script asynchronously
      exec(cmd, (error, stdout, stderr) => {
        console.log('Python process started');
        if (error) {
          console.error(`Exec error: ${error}`);
          // If there's an error, delete the lock file
          try {
            if (fs.existsSync(lockFilePath)) {
              fs.unlinkSync(lockFilePath);
            }
          } catch (e) {
            console.error('Error removing lock file:', e);
          }
          return;
        }
        console.log(`Python script output: ${stdout}`);
        if (stderr) {
          console.error(`Python script error: ${stderr}`);
        }
      });
      
      // Return success immediately, since the processing is happening asynchronously
      return res.status(200).json({
        success: true,
        message: 'Processing started',
        setsToProcess: setNumbers.length,
        command: cmd
      });
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