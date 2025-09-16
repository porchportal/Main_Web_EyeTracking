import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Declare variables in outer scope for cleanup
  let lockFilePath = null;
  
  try {
    const { setNumbers, enhanceFace } = req.body;
    const { userId } = req.query;

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
    const capturesDir = path.join(process.cwd(), '..', 'backend', 'auth_service', 'resource_security', 'public', 'captures', userId);
    const progressFilePath = path.join(capturesDir, 'processing_progress.json');
    lockFilePath = path.join(capturesDir, 'processing.lock');
    
    // Ensure directory exists
    if (!fs.existsSync(capturesDir)) {
      fs.mkdirSync(capturesDir, { recursive: true });
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
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for image processing
    
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
    console.error('Error in process-files API:', error);
    
    // Update progress file with error status
    try {
      const errorProgressInfo = {
        currentSet: 0,
        totalSets: setNumbers?.length || 0,
        processedSets: [],
        startTime: new Date().toISOString(),
        lastUpdateTime: new Date().toISOString(),
        userId: userId,
        enhanceFace: enhanceFace,
        status: 'error',
        message: `Processing failed: ${error.message}`,
        currentFile: '',
        progress: 0
      };
      
      if (progressFilePath) {
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
    
    if (error.name === 'AbortError') {
      res.status(408).json({ error: 'Request timeout - image processing took too long' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}
