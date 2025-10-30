import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Declare variables in outer scope for cleanup and error handling
  let lockFilePath = null;
  let progressFilePath = null;
  let setNumbers = null;
  let enhanceFace = null;
  let userId = null;

  try {
    setNumbers = req.body?.setNumbers;
    enhanceFace = req.body?.enhanceFace;
    userId = req.query?.userId;

    console.log(`🔧 aprocess-file API received:`, {
      setNumbers: setNumbers,
      enhanceFace: enhanceFace,
      enhanceFaceType: typeof enhanceFace,
      userId: userId,
      body: req.body
    });

    if (!setNumbers || !Array.isArray(setNumbers)) {
      console.log('❌ Invalid set numbers:', setNumbers);
      return res.status(400).json({ error: 'Invalid set numbers' });
    }

    if (!userId) {
      console.log('❌ No user ID provided');
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (typeof enhanceFace !== 'boolean') {
      console.log('❌ enhanceFace is not boolean:', { enhanceFace, type: typeof enhanceFace });
      return res.status(400).json({ error: 'enhanceFace parameter must be a boolean value' });
    }

    console.log(`✅ All parameters valid - proceeding with processing`);

    // Create initial progress file for polling mechanism
    // IMPORTANT: This path is mapped via Docker volume to backend/auth_service/resource_security/public/captures
    // See docker-compose.yml volume mount for confirmation
    const baseDir = '/app/resource_security/public/captures';
    const capturesDir = path.join(baseDir, userId);
    progressFilePath = path.join(capturesDir, 'processing_progress.json');
    lockFilePath = path.join(capturesDir, 'processing.lock');

    console.log(`📁 Using captures directory (mounted from backend): ${capturesDir}`);

    // Verify base directory exists (should be mounted from backend)
    if (!fs.existsSync(baseDir)) {
      console.error(`❌ Base directory not found: ${baseDir}`);
      throw new Error('Backend resource_security folder not mounted correctly. Please check Docker volumes.');
    }

    // Create user-specific subdirectory only (not the entire path)
    if (!fs.existsSync(capturesDir)) {
      fs.mkdirSync(capturesDir, { recursive: false });
      console.log(`✅ Created user directory: ${capturesDir}`);
    }
    
    // Create lock file
    try {
      fs.writeFileSync(lockFilePath, new Date().toISOString());
      console.log(`Created lock file at ${lockFilePath}`);
    } catch (err) {
      console.error(`Error creating lock file: ${err.message}`);
    }
    
    // Create initial progress file
    const progressInfo = {
      currentSet: 0,
      totalSets: setNumbers.length,
      processedSets: [],
      startTime: new Date().toISOString(),
      lastUpdateTime: new Date().toISOString(),
      userId: userId,
      enhanceFace: enhanceFace,
      status: 'starting',
      message: 'Initializing processing...',
      currentFile: '',
      progress: 0
    };
    
    try {
      fs.writeFileSync(progressFilePath, JSON.stringify(progressInfo, null, 2));
      console.log(`Created initial progress file at ${progressFilePath}`);
    } catch (err) {
      console.error(`Error creating progress file: ${err.message}`);
    }

    // Get auth service URL from environment (which includes image processing)
    const authServiceUrl = process.env.AUTH_SERVICE_URL;
    const apiKey = process.env.BACKEND_API_KEY ;

    // Set headers for streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Call the auth service backend which handles image processing
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800000); // 30 minute timeout for image processing (Real-ESRGAN can be slow)
    
    const backendRequestBody = {
      user_id: userId,
      set_numbers: setNumbers,
      enhanceFace: enhanceFace
    };
    
    console.log(`📤 Sending to backend auth service:`, {
      url: `${authServiceUrl}/api/queue-processing`,
      body: backendRequestBody
    });
    
    const response = await fetch(`${authServiceUrl}/api/queue-processing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(backendRequestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Auth service returned ${response.status}: ${errorText}`);
      return res.status(response.status).json({ 
        success: false, 
        error: `Backend service error: ${response.status} ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();
    
    // Update progress file to indicate completion
    try {
      const finalProgressInfo = {
        currentSet: setNumbers.length,
        totalSets: setNumbers.length,
        processedSets: setNumbers,
        startTime: new Date().toISOString(),
        lastUpdateTime: new Date().toISOString(),
        userId: userId,
        enhanceFace: enhanceFace,
        status: 'completed',
        message: 'Processing completed successfully',
        currentFile: '',
        progress: 100
      };
      
      fs.writeFileSync(progressFilePath, JSON.stringify(finalProgressInfo, null, 2));
      console.log(`Updated progress file with completion status`);
    } catch (err) {
      console.error(`Error updating final progress file: ${err.message}`);
    }
    
    // Clean up lock file when processing is complete
    try {
      if (lockFilePath && fs.existsSync(lockFilePath)) {
        fs.unlinkSync(lockFilePath);
        console.log(`Removed lock file at ${lockFilePath}`);
      }
    } catch (err) {
      console.error(`Error removing lock file: ${err.message}`);
    }
    
    // Return the response directly instead of streaming
    return res.status(200).json({
      success: true,
      data: data,
      results: data.results || [data]
    });
  } catch (error) {
    console.error('Error in process-files API:', {
      error: error.message,
      stack: error.stack,
      userId: userId,
      setNumbers: setNumbers,
      enhanceFace: enhanceFace
    });

    // Update progress file with error status
    try {
      if (progressFilePath && userId) {
        const errorProgressInfo = {
          currentSet: 0,
          totalSets: setNumbers?.length || 0,
          processedSets: [],
          startTime: new Date().toISOString(),
          lastUpdateTime: new Date().toISOString(),
          userId: userId,
          enhanceFace: enhanceFace || false,
          status: 'error',
          message: `Processing failed: ${error.message}`,
          currentFile: '',
          progress: 0
        };

        fs.writeFileSync(progressFilePath, JSON.stringify(errorProgressInfo, null, 2));
        console.log(`Updated progress file with error status`);
      }
    } catch (err) {
      console.error(`Error updating progress file with error status: ${err.message}`);
    }

    // Clean up lock file on error
    try {
      if (lockFilePath && fs.existsSync(lockFilePath)) {
        fs.unlinkSync(lockFilePath);
        console.log(`Removed lock file on error at ${lockFilePath}`);
      }
    } catch (err) {
      console.error(`Error removing lock file on error: ${err.message}`);
    }

    // Return appropriate error response
    if (error.name === 'AbortError') {
      return res.status(408).json({
        success: false,
        error: 'Request timeout - image processing took too long',
        message: 'The processing operation timed out after 30 minutes. Please try processing fewer files at once.'
      });
    } else if (error.message?.includes('ECONNREFUSED')) {
      return res.status(503).json({
        success: false,
        error: 'Backend service unavailable',
        message: 'Could not connect to the image processing service. Please ensure the backend is running.'
      });
    } else if (error.message?.includes('AUTH_SERVICE_URL')) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'AUTH_SERVICE_URL is not configured properly'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
        message: 'An error occurred while processing the files. Please try again.'
      });
    }
  }
}
