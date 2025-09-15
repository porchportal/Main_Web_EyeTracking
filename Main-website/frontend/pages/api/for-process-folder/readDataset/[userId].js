// pages/api/for-process-folder/readDataset/[userId].js - Dynamic user-specific file preview API with folder support
// This API now acts as a proxy to the backend preview.py API
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { userId, filename, folder = 'captures', operation = 'preview', enhanceFace } = req.query;
    
    console.log(`Frontend API received: userId=${userId}, folder=${folder}, operation=${operation}, filename=${filename}, enhanceFace=${enhanceFace}`);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Get backend URL and API key from environment variables
    const backendUrl = process.env.AUTH_SERVICE_URL;
    const apiKey = process.env.BACKEND_API_KEY;

    // Handle different operations
    if (operation === 'list') {
      return await handleListOperation(userId, folder, res, backendUrl, apiKey);
    } else if (operation === 'check-completeness') {
      return await handleCompletenessCheck(userId, res, backendUrl, apiKey);
    } else if (operation === 'compare') {
      return await handleCompareOperation(userId, enhanceFace, res, backendUrl, apiKey);
    } else if (operation === 'preview') {
      if (!filename) {
        return res.status(400).json({
          success: false,
          error: 'Filename is required for preview operation'
        });
      }
      return await handlePreviewOperation(userId, filename, folder, res, backendUrl, apiKey);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid operation. Supported operations: list, check-completeness, compare, preview'
      });
    }
  } catch (error) {
    console.error('Error in readDataset API:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Handle list operation by calling backend API
async function handleListOperation(userId, folder, res, backendUrl, apiKey) {
  try {
    console.log(`Frontend API: Calling backend with userId: ${userId}, folder: ${folder}`);
    console.log(`Frontend API: Backend URL: ${backendUrl}`);
    console.log(`Frontend API: Full URL: ${backendUrl}/api/list-files?userId=${encodeURIComponent(userId)}&folder=${encodeURIComponent(folder)}`);
    // Call the backend list-files API
    const response = await fetch(`${backendUrl}/api/list-files?userId=${encodeURIComponent(userId)}&folder=${encodeURIComponent(folder)}`, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend API error (${response.status}):`, errorText);
      return res.status(response.status).json({
        success: false,
        error: `Backend API error: ${response.status} - ${errorText}`,
        files: []
      });
    }

    const data = await response.json();
    
    if (!data.success) {
      return res.status(400).json({
        success: false,
        error: data.error || 'Failed to get files list from backend',
        files: []
      });
    }

    // Return the data from backend
    return res.status(200).json({
      success: true,
      files: data.files || [],
      message: data.message || `Found files in ${folder} folder`
    });

  } catch (error) {
    console.error('Error calling backend list API:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      files: []
    });
  }
}

// Simple file listing implementation using backend API
async function handleFileListing(userId, folder, res, backendUrl, apiKey) {
  try {
    // For now, we'll return a simple response indicating no files
    // In production, this should call a proper backend API endpoint for file listing
    
    // Return empty files list for now - the backend should implement a proper file listing API
    return res.status(200).json({
      success: true,
      files: [],
      message: `File listing not yet implemented for ${folder} folder. Please implement a backend API endpoint for file listing.`
    });
  } catch (error) {
    console.error('Error listing files:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Handle completeness check operation
async function handleCompletenessCheck(userId, res, backendUrl, apiKey) {
  try {
    // Get capture files to check if there are any files at all
    const captureUrl = `${backendUrl}/api/list-files?userId=${encodeURIComponent(userId)}&folder=captures`;
    
    const captureResponse = await fetch(captureUrl, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    let captureFiles = [];
    if (captureResponse.ok) {
      const captureData = await captureResponse.json();
      captureFiles = captureData.files || [];
    }
    
    // If no capture files exist, return appropriate response
    if (captureFiles.length === 0) {
      return res.status(200).json({
        success: true,
        isComplete: false,
        incompleteSets: [],
        missingFiles: 0,
        totalSets: 0,
        message: 'No capture files found'
      });
    }
    
    // Extract set numbers from capture files (webcam_XXX.jpg format)
    const captureSets = new Set();
    captureFiles.forEach(file => {
      const filename = file.filename || file; // Handle both object and string formats
      const match = filename.match(/webcam_(\d+)\.jpg/);
      if (match) {
        captureSets.add(parseInt(match[1]));
      }
    });
    
    // Get enhance files
    const enhanceUrl = `${backendUrl}/api/list-files?userId=${encodeURIComponent(userId)}&folder=enhance`;
    const enhanceResponse = await fetch(enhanceUrl, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    let enhanceFiles = [];
    if (enhanceResponse.ok) {
      const enhanceData = await enhanceResponse.json();
      enhanceFiles = enhanceData.files || [];
    }
    
    // Get complete files
    const completeUrl = `${backendUrl}/api/list-files?userId=${encodeURIComponent(userId)}&folder=complete`;
    const completeResponse = await fetch(completeUrl, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    let completeFiles = [];
    if (completeResponse.ok) {
      const completeData = await completeResponse.json();
      completeFiles = completeData.files || [];
    }
    
    // Extract set numbers from enhance files (webcam_enhance_XXX.jpg format)
    const enhanceSets = new Set();
    enhanceFiles.forEach(file => {
      const filename = file.filename || file; // Handle both object and string formats
      const match = filename.match(/webcam_enhance_(\d+)\.jpg/);
      if (match) {
        enhanceSets.add(parseInt(match[1]));
      }
    });
    
    // Extract set numbers from complete files (webcam_XXX.jpg format - same as capture)
    const completeSets = new Set();
    completeFiles.forEach(file => {
      const filename = file.filename || file; // Handle both object and string formats
      const match = filename.match(/webcam_(\d+)\.jpg/);
      if (match) {
        completeSets.add(parseInt(match[1]));
      }
    });
    
    // Find incomplete sets (in capture but not in enhance OR complete)
    const processedSets = new Set([...enhanceSets, ...completeSets]);
    const incompleteSets = Array.from(captureSets).filter(setNum => !processedSets.has(setNum));
    
    const totalSets = captureSets.size;
    const isComplete = incompleteSets.length === 0;
    const missingFiles = incompleteSets.length;
    
    return res.status(200).json({
      success: true,
      isComplete,
      incompleteSets,
      missingFiles,
      totalSets,
      message: isComplete ? 
        'All file sets are complete' : 
        `${missingFiles} sets are incomplete`
    });
  } catch (error) {
    console.error('Error checking completeness:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Handle compare operation
async function handleCompareOperation(userId, enhanceFace, res, backendUrl, apiKey) {
  try {
    console.log(`🔍 handleCompareOperation called with enhanceFace=${enhanceFace} (type: ${typeof enhanceFace})`);
    
    // Convert enhanceFace string to boolean if needed
    const isEnhanceMode = enhanceFace === 'true' || enhanceFace === true;
    console.log(`🔍 isEnhanceMode: ${isEnhanceMode}`);
    // Get capture files
    const captureUrl = `${backendUrl}/api/list-files?userId=${encodeURIComponent(userId)}&folder=captures`;
    
    const captureResponse = await fetch(captureUrl, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    // Get enhance files
    const enhanceUrl = `${backendUrl}/api/list-files?userId=${encodeURIComponent(userId)}&folder=enhance`;
    
    const enhanceResponse = await fetch(enhanceUrl, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    // Get complete files
    const completeUrl = `${backendUrl}/api/list-files?userId=${encodeURIComponent(userId)}&folder=complete`;
    
    const completeResponse = await fetch(completeUrl, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    let captureFiles = [];
    let enhanceFiles = [];
    let completeFiles = [];
    
    if (captureResponse.ok) {
      const captureData = await captureResponse.json();
      captureFiles = captureData.files || [];
    } else {
      console.error(`Capture response error: ${captureResponse.status}`, await captureResponse.text());
    }
    
    if (enhanceResponse.ok) {
      const enhanceData = await enhanceResponse.json();
      enhanceFiles = enhanceData.files || [];
    } else {
      console.error(`Enhance response error: ${enhanceResponse.status}`, await enhanceResponse.text());
    }
    
    if (completeResponse.ok) {
      const completeData = await completeResponse.json();
      completeFiles = completeData.files || [];
    } else {
      console.error(`Complete response error: ${completeResponse.status}`, await completeResponse.text());
    }
    
    // Extract set numbers from capture files (webcam_XXX.jpg format)
    const captureSets = new Set();
    captureFiles.forEach(file => {
      const filename = file.filename || file; // Handle both object and string formats
      const match = filename.match(/webcam_(\d+)\.jpg/);
      if (match) {
        captureSets.add(parseInt(match[1]));
      }
    });
    
    // Extract set numbers from enhance files (webcam_enhance_XXX.jpg format)
    const enhanceSets = new Set();
    enhanceFiles.forEach(file => {
      const filename = file.filename || file; // Handle both object and string formats
      const match = filename.match(/webcam_enhance_(\d+)\.jpg/);
      if (match) {
        enhanceSets.add(parseInt(match[1]));
      }
    });
    
    // Extract set numbers from complete files (webcam_XXX.jpg format - same as capture)
    const completeSets = new Set();
    completeFiles.forEach(file => {
      const filename = file.filename || file; // Handle both object and string formats
      const match = filename.match(/webcam_(\d+)\.jpg/);
      if (match) {
        completeSets.add(parseInt(match[1]));
      }
    });
    
    // ✅ FIXED: Declare all variables first
    const captureCount = captureSets.size;
    const enhanceCount = enhanceSets.size;
    const completeCount = completeSets.size;
    
    // ✅ FIXED: Only consider the relevant folder based on enhanceFace setting
    let processedSets, totalProcessedCount, needsProcessing;
    
    if (isEnhanceMode) {
      // In enhance mode: only consider enhance files, ignore complete files
      processedSets = enhanceSets;
      totalProcessedCount = enhanceCount;
      console.log(`🔍 Enhance mode: only considering enhance files (${enhanceCount} files)`);
    } else {
      // In complete mode: only consider complete files, ignore enhance files
      processedSets = completeSets;
      totalProcessedCount = completeCount;
      console.log(`🔍 Complete mode: only considering complete files (${completeCount} files)`);
    }
    
    const setsNeedingProcessing = Array.from(captureSets).filter(setNum => !processedSets.has(setNum));
    needsProcessing = setsNeedingProcessing.length > 0;
    
    console.log(`🔍 handleCompareOperation results:`, {
      captureCount,
      enhanceCount,
      completeCount,
      totalProcessedCount,
      needsProcessing,
      setsNeedingProcessing,
      captureSets: Array.from(captureSets),
      enhanceSets: Array.from(enhanceSets),
      completeSets: Array.from(completeSets)
    });
    
    return res.status(200).json({
      success: true,
      captureCount,
      enhanceCount,
      completeCount,
      totalProcessedCount,
      needsProcessing,
      setsNeedingProcessing,
      setsNeedingProcessingCount: setsNeedingProcessing.length,
      message: needsProcessing ? 
        `${setsNeedingProcessing.length} sets need processing` : 
        'No files need processing'
    });
  } catch (error) {
    console.error('Error comparing files:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Handle preview operation by calling backend API
async function handlePreviewOperation(userId, filename, folder, res, backendUrl, apiKey) {
  try {
    // Call the backend preview API
    const response = await fetch(`${backendUrl}/api/preview-api?filename=${encodeURIComponent(filename)}&userId=${encodeURIComponent(userId)}&folder=${encodeURIComponent(folder)}`, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend API error (${response.status}):`, errorText);
      return res.status(response.status).json({
        success: false,
        error: `Backend API error: ${response.status} - ${errorText}`,
        filename: filename,
        folder: folder
      });
    }

    const data = await response.json();
    
    if (!data.success) {
      return res.status(400).json({
        success: false,
        error: data.error || 'Failed to get preview from backend',
        filename: filename,
        folder: folder
      });
    }

    // Return the data from backend
    return res.status(200).json({
      success: true,
      data: data.data,
      type: data.type,
      imageType: data.imageType,
      userId: userId,
      filename: filename,
      folder: folder,
      size: data.size,
      mtime: data.mtime
    });

  } catch (error) {
    console.error('Error calling backend preview API:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      filename: filename,
      folder: folder
    });
  }
}