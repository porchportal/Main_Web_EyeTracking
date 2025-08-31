// pages/api/process-status-api.js - API to handle process status checks and triggers
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import fetch from 'node-fetch';
import FormData from 'form-data';

// Convert exec to Promise-based
const execPromise = util.promisify(exec);
async function processImageWithPython(inputPath, outputPath, setNumber, captureDir, enhancePath) {
  try {
    console.log(`Starting to process image: ${inputPath}`);
    
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      console.error(`Input file does not exist: ${inputPath}`);
      return null;
    }
    
    // Get the backend URL
    const backendUrl = process.env.BACKEND_URL;
    const apiKey = process.env.API_KEY;
    
    // Create form data
    const formData = new FormData();
    
    // Open the file as a stream
    const fileStream = fs.createReadStream(inputPath);
    
    // Log the file size
    const stats = fs.statSync(inputPath);
    console.log(`File size: ${stats.size} bytes`);
    
    // Add file to form data
    formData.append('file', fileStream, {
      filename: path.basename(inputPath),
      contentType: 'image/jpeg'
    });
    
    // Add processing parameters - these must match the FastAPI backend expectations
    // By default, don't show visualizations in the output image, but collect all metrics
    formData.append('showHeadPose', 'false');
    formData.append('showBoundingBox', 'false');
    formData.append('showMask', 'false');
    formData.append('showParameters', 'false');
    
    console.log(`Sending ${inputPath} to Python backend at ${backendUrl}/process-image`);
    
    // Log request details for debugging
    console.log('API Key being used:', apiKey);
    console.log('Form data parameters:', 
               'showHeadPose=false', 
               'showBoundingBox=false', 
               'showMask=false', 
               'showParameters=false');
    
    // Call the Python backend
    const response = await fetch(`${backendUrl}/process-image`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey
      },
      body: formData,
      timeout: 30000 // 30 second timeout for processing large images
    });
    
    // Log the response status
    console.log(`Backend response status: ${response.status}`);
    
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Could not read error details';
      }
      
      console.error(`Backend error: ${response.status} ${response.statusText}`);
      console.error(`Response body: ${errorText}`);
      throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
    }
    
    // Parse the response as JSON
    let result;
    try {
      const responseText = await response.text();
      console.log(`Response text (first 200 chars): ${responseText.substring(0, 200)}...`);
      result = JSON.parse(responseText);
    } catch (error) {
      console.error('Error parsing response JSON:', error);
      throw new Error(`Failed to parse backend response: ${error.message}`);
    }
    
    // Log result status
    console.log('Backend processing result:', result.success ? 'Success' : 'Failed');
    
    if (result.success) {
      // Check if a face was detected
      if (result.face_detected === false) {
        console.log('No face detected in the image - saving original image');
        fs.copyFileSync(inputPath, outputPath);
        
        // Still update parameter file with this information
        await updateParameterFile(setNumber, { face_detected: false }, captureDir, enhancePath);
        
        return null;
      }
      
      // Verify we have the processed image data
      if (!result.image || !result.image.data) {
        console.error('Backend response missing image data');
        
        // Fall back to copying the original image
        fs.copyFileSync(inputPath, outputPath);
        console.log(`Copied original image as fallback to: ${outputPath}`);
        
        // Update parameter file with minimal info
        await updateParameterFile(setNumber, { face_detected: false }, captureDir, enhancePath);
        
        return null;
      }
      
      // Save the processed image
      try {
        const imageBuffer = Buffer.from(result.image.data, 'base64');
        fs.writeFileSync(outputPath, imageBuffer);
        console.log(`Saved processed image to ${outputPath}, size: ${imageBuffer.length} bytes`);
      } catch (error) {
        console.error(`Error saving processed image: ${error.message}`);
        
        // Fall back to copying the original image
        fs.copyFileSync(inputPath, outputPath);
        console.log(`Copied original image as fallback to: ${outputPath}`);
      }
      
      // Check for metrics in the response
      if (result.metrics) {
        console.log('Metrics received from backend, saving...');
        console.log('Number of metrics received:', Object.keys(result.metrics).length);
        
        // Log some key metrics if they exist
        if (result.metrics.head_pose) {
          console.log(`Head pose: pitch=${result.metrics.head_pose.pitch}, yaw=${result.metrics.head_pose.yaw}, roll=${result.metrics.head_pose.roll}`);
        }
        
        // Log face positions if they exist
        if (result.metrics.face_min_position_x) {
          console.log(`Face position: (${result.metrics.face_min_position_x},${result.metrics.face_min_position_y}) to (${result.metrics.face_max_position_x},${result.metrics.face_max_position_y})`);
        }
        
        // Log eye positions if they exist
        if (result.metrics.left_eye_position_x) {
          console.log(`Left eye position: (${result.metrics.left_eye_position_x},${result.metrics.left_eye_position_y})`);
        }
        if (result.metrics.right_eye_position_x) {
          console.log(`Right eye position: (${result.metrics.right_eye_position_x},${result.metrics.right_eye_position_y})`);
        }
        
        // Add face_detected flag if not present
        if (result.metrics.face_detected === undefined) {
          result.metrics.face_detected = true;
        }
        
        // Update parameter file with the complete metrics
        await updateParameterFile(setNumber, result.metrics, captureDir, enhancePath);
        
        return result.metrics;
      } else {
        console.log('No metrics received from backend, using face_detected status only');
        
        // Update parameter file with just the face detection status
        await updateParameterFile(setNumber, { face_detected: true }, captureDir, enhancePath);
        
        return { face_detected: true };
      }
    } else {
      console.error(`Backend processing failed: ${result.error || 'Unknown error'}`);
      
      // Fall back to copying the original image
      fs.copyFileSync(inputPath, outputPath);
      console.log(`Copied original image as fallback to: ${outputPath}`);
      
      // Update parameter file with error information
      await updateParameterFile(setNumber, null, captureDir, enhancePath);
      
      return null;
    }
  } catch (error) {
    console.error(`Error processing image with Python backend: ${error.message}`);
    console.error(error.stack);
    
    // Fall back to copying the original image
    try {
      fs.copyFileSync(inputPath, outputPath);
      console.log(`Copied original image as fallback after error: ${outputPath}`);
    } catch (copyError) {
      console.error(`Error copying original image: ${copyError.message}`);
    }
    
    // Update parameter file with error information
    await updateParameterFile(setNumber, null, captureDir, enhancePath);
    
    return null;
  }
}
// Updated function to properly handle parameter file updates with all metrics
async function updateParameterFile(setNumber, metrics, captureDir, enhancePath) {
  console.log(`Updating parameter file for set ${setNumber} with new metrics`);
  
  // Determine parameter file paths
  const originalParamPaths = [
    path.join(captureDir, `parameters_${setNumber}.csv`),
    path.join(captureDir, `parameter_${setNumber}.csv`)
  ];
  
  // Output parameter file path
  const paramDestPath = path.join(enhancePath, `parameter_enhance_${setNumber}.csv`);
  
  // Load original parameter data if available
  let originalParams = new Map();
  let originalParamFound = false;
  let originalFirstLineIsHeader = false;
  
  for (const originalPath of originalParamPaths) {
    if (fs.existsSync(originalPath)) {
      console.log(`Found original parameter file: ${originalPath}`);
      originalParamFound = true;
      
      try {
        const content = fs.readFileSync(originalPath, 'utf8');
        console.log(`Original parameter file content: ${content.substring(0, 100)}...`);
        
        const lines = content.split('\n');
        
        // Check if the first line is a header
        const firstLine = lines[0].trim();
        originalFirstLineIsHeader = firstLine.toLowerCase().includes('parameter') || 
                                   firstLine.toLowerCase().includes('name');
        
        // Skip header line if it exists
        const startLine = originalFirstLineIsHeader ? 1 : 0;
        
        // Parse the original parameters
        for (let i = startLine; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line) {
            const parts = line.split(',');
            if (parts.length >= 2) {
              const paramName = parts[0].trim();
              const paramValue = parts[1].trim();
              originalParams.set(paramName, paramValue);
              console.log(`Loaded parameter: ${paramName}=${paramValue}`);
            }
          }
        }
        
        console.log(`Loaded ${originalParams.size} parameters from original file`);
        break; // Found and loaded one parameter file, no need to check the other
      } catch (err) {
        console.error(`Error reading original parameter file: ${err.message}`);
      }
    }
  }
  
  // Prepare CSV content with header
  let csvContent = 'Parameter,Value\n';
  
  // Define parameters that will be updated with new metrics
  const excludeParams = [
    // Head pose parameters
    'pitch', 'yaw', 'roll', 
    // Face parameters
    'face_width', 'face_height', 'face_min_position_x', 'face_min_position_y', 
    'face_max_position_x', 'face_max_position_y', 'face_center_position_x', 'face_center_position_y',
    // Eye position parameters
    'left_eye_position_x', 'left_eye_position_y', 'right_eye_position_x', 'right_eye_position_y',
    'eye_socket_left_center_x', 'eye_socket_left_center_y', 'eye_socket_right_center_x', 'eye_socket_right_center_y',
    'center_between_eyes_x', 'center_between_eyes_y',
    // Eye box parameters
    'left_eye_box_min_x', 'left_eye_box_min_y', 'left_eye_box_max_x', 'left_eye_box_max_y',
    'right_eye_box_min_x', 'right_eye_box_min_y', 'right_eye_box_max_x', 'right_eye_box_max_y',
    // Iris parameters
    'left_iris_center_x', 'left_iris_center_y', 'right_iris_center_x', 'right_iris_center_y',
    'left_iris_min_x', 'left_iris_min_y', 'left_iris_max_x', 'left_iris_max_y',
    'right_iris_min_x', 'right_iris_min_y', 'right_iris_max_x', 'right_iris_max_y',
    // Face landmark parameters
    'nose_position_x', 'nose_position_y', 'chin_position_x', 'chin_position_y',
    'cheek_left_position_x', 'cheek_left_position_y', 'cheek_right_position_x', 'cheek_right_position_y',
    'mouth_left_position_x', 'mouth_left_position_y', 'mouth_right_position_x', 'mouth_right_position_y',
    // Eye state parameters
    'left_eye_state', 'left_eye_ear', 'right_eye_state', 'right_eye_ear',
    // Depth parameters
    'distance_cm_from_face', 'distance_cm_from_eye', 'chin_depth',
    // Derived parameters
    'posture', 'gaze_direction'
  ];
  
  // Log all original parameters for debugging
  console.log("Original parameters:");
  originalParams.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });
  
  // Add existing parameters (except those we'll update)
  originalParams.forEach((value, key) => {
    if (!excludeParams.includes(key.toLowerCase())) {
      csvContent += `${key},${value}\n`;
    }
  });
  
  // Now add the new metrics
  if (metrics && metrics.face_detected !== false) {
    console.log("Adding new metrics from face detection");
    
    // Helper function to add a metric if it exists
    const addMetric = (key, value, formatter = (v) => v) => {
      if (metrics[key] !== undefined) {
        const formattedValue = formatter(metrics[key]);
        csvContent += `${key},${formattedValue}\n`;
        console.log(`Adding ${key}=${formattedValue}`);
      }
    };
    
    // 1. Add head pose data
    if (metrics.head_pose) {
      console.log(`Adding head pose: pitch=${metrics.head_pose.pitch}, yaw=${metrics.head_pose.yaw}, roll=${metrics.head_pose.roll}`);
      csvContent += `pitch,${metrics.head_pose.pitch}\n`;
      csvContent += `yaw,${metrics.head_pose.yaw}\n`;
      csvContent += `roll,${metrics.head_pose.roll}\n`;
    }
    
    // 2. Add face position metrics
    addMetric('face_min_position_x', metrics.face_min_position_x);
    addMetric('face_min_position_y', metrics.face_min_position_y);
    addMetric('face_max_position_x', metrics.face_max_position_x);
    addMetric('face_max_position_y', metrics.face_max_position_y);
    addMetric('face_center_position_x', metrics.face_center_position_x);
    addMetric('face_center_position_y', metrics.face_center_position_y);
    
    // If we have face box min/max but not individual parameters
    if (metrics.face_box && !metrics.face_min_position_x) {
      if (metrics.face_box.min) {
        csvContent += `face_min_position_x,${metrics.face_box.min[0]}\n`;
        csvContent += `face_min_position_y,${metrics.face_box.min[1]}\n`;
      }
      if (metrics.face_box.max) {
        csvContent += `face_max_position_x,${metrics.face_box.max[0]}\n`;
        csvContent += `face_max_position_y,${metrics.face_box.max[1]}\n`;
        
        // Calculate face width and height from min/max
        if (metrics.face_box.min) {
          const faceWidth = Math.round(metrics.face_box.max[0] - metrics.face_box.min[0]);
          const faceHeight = Math.round(metrics.face_box.max[1] - metrics.face_box.min[1]);
          csvContent += `face_width,${faceWidth}\n`;
          csvContent += `face_height,${faceHeight}\n`;
        }
      }
    }
    
    // 3. Add eye positions
    addMetric('left_eye_position_x', metrics.left_eye_position_x);
    addMetric('left_eye_position_y', metrics.left_eye_position_y);
    addMetric('right_eye_position_x', metrics.right_eye_position_x);
    addMetric('right_eye_position_y', metrics.right_eye_position_y);
    addMetric('center_between_eyes_x', metrics.center_between_eyes_x);
    addMetric('center_between_eyes_y', metrics.center_between_eyes_y);
    addMetric('eye_socket_left_center_x', metrics.eye_socket_left_center_x);
    addMetric('eye_socket_left_center_y', metrics.eye_socket_left_center_y);
    addMetric('eye_socket_right_center_x', metrics.eye_socket_right_center_x);
    addMetric('eye_socket_right_center_y', metrics.eye_socket_right_center_y);
    
    // 4. Add eye box data
    addMetric('left_eye_box_min_x', metrics.left_eye_box_min_x);
    addMetric('left_eye_box_min_y', metrics.left_eye_box_min_y);
    addMetric('left_eye_box_max_x', metrics.left_eye_box_max_x);
    addMetric('left_eye_box_max_y', metrics.left_eye_box_max_y);
    addMetric('right_eye_box_min_x', metrics.right_eye_box_min_x);
    addMetric('right_eye_box_min_y', metrics.right_eye_box_min_y);
    addMetric('right_eye_box_max_x', metrics.right_eye_box_max_x);
    addMetric('right_eye_box_max_y', metrics.right_eye_box_max_y);
    
    // 5. Add iris data if available
    if (metrics.eye_iris_center) {
      if (metrics.eye_iris_center.left) {
        csvContent += `left_iris_center_x,${metrics.eye_iris_center.left[0]}\n`;
        csvContent += `left_iris_center_y,${metrics.eye_iris_center.left[1]}\n`;
      }
      if (metrics.eye_iris_center.right) {
        csvContent += `right_iris_center_x,${metrics.eye_iris_center.right[0]}\n`;
        csvContent += `right_iris_center_y,${metrics.eye_iris_center.right[1]}\n`;
      }
    }
    
    if (metrics.eye_iris_left_box) {
      if (metrics.eye_iris_left_box.min) {
        csvContent += `left_iris_min_x,${metrics.eye_iris_left_box.min[0]}\n`;
        csvContent += `left_iris_min_y,${metrics.eye_iris_left_box.min[1]}\n`;
      }
      if (metrics.eye_iris_left_box.max) {
        csvContent += `left_iris_max_x,${metrics.eye_iris_left_box.max[0]}\n`;
        csvContent += `left_iris_max_y,${metrics.eye_iris_left_box.max[1]}\n`;
      }
    }
    
    if (metrics.eye_iris_right_box) {
      if (metrics.eye_iris_right_box.min) {
        csvContent += `right_iris_min_x,${metrics.eye_iris_right_box.min[0]}\n`;
        csvContent += `right_iris_min_y,${metrics.eye_iris_right_box.min[1]}\n`;
      }
      if (metrics.eye_iris_right_box.max) {
        csvContent += `right_iris_max_x,${metrics.eye_iris_right_box.max[0]}\n`;
        csvContent += `right_iris_max_y,${metrics.eye_iris_right_box.max[1]}\n`;
      }
    }
    
    // 6. Add facial landmark positions from metrics
    addMetric('nose_position_x', metrics.nose_position_x);
    addMetric('nose_position_y', metrics.nose_position_y);
    addMetric('chin_position_x', metrics.chin_position_x);
    addMetric('chin_position_y', metrics.chin_position_y);
    addMetric('cheek_left_position_x', metrics.cheek_left_position_x);
    addMetric('cheek_left_position_y', metrics.cheek_left_position_y);
    addMetric('cheek_right_position_x', metrics.cheek_right_position_x);
    addMetric('cheek_right_position_y', metrics.cheek_right_position_y);
    addMetric('mouth_left_position_x', metrics.mouth_left_position_x);
    addMetric('mouth_left_position_y', metrics.mouth_left_position_y);
    addMetric('mouth_right_position_x', metrics.mouth_right_position_x);
    addMetric('mouth_right_position_y', metrics.mouth_right_position_y);
    
    // 7. Add eye state information
    addMetric('left_eye_state', metrics.left_eye_state);
    addMetric('left_eye_ear', metrics.left_eye_ear);
    addMetric('right_eye_state', metrics.right_eye_state);
    addMetric('right_eye_ear', metrics.right_eye_ear);
    
    // 8. Add depth information
    addMetric('distance_cm_from_face', metrics.distance_cm_from_face);
    addMetric('distance_cm_from_eye', metrics.distance_cm_from_eye);
    addMetric('chin_depth', metrics.chin_depth);
    
    // 9. Add derived metrics (posture and gaze direction)
    addMetric('posture', metrics.posture);
    addMetric('gaze_direction', metrics.gaze_direction);
    
  } else if (originalParamFound) {
    // If no new metrics but we had original data for these fields, preserve them
    console.log("No new metrics, preserving original face tracking data if available");
    
    // Define fields to preserve from original parameters if available
    const fieldsToPreserve = [
      // Head pose parameters
      'pitch', 'yaw', 'roll', 
      // Face parameters
      'face_width', 'face_height', 'face_min_position_x', 'face_min_position_y', 
      'face_max_position_x', 'face_max_position_y', 'face_center_position_x', 'face_center_position_y',
      // Eye position parameters
      'left_eye_position_x', 'left_eye_position_y', 'right_eye_position_x', 'right_eye_position_y',
      'eye_socket_left_center_x', 'eye_socket_left_center_y', 'eye_socket_right_center_x', 'eye_socket_right_center_y',
      'center_between_eyes_x', 'center_between_eyes_y',
      // Eye box parameters
      'left_eye_box_min_x', 'left_eye_box_min_y', 'left_eye_box_max_x', 'left_eye_box_max_y',
      'right_eye_box_min_x', 'right_eye_box_min_y', 'right_eye_box_max_x', 'right_eye_box_max_y',
      // Iris parameters
      'left_iris_center_x', 'left_iris_center_y', 'right_iris_center_x', 'right_iris_center_y',
      'left_iris_min_x', 'left_iris_min_y', 'left_iris_max_x', 'left_iris_max_y',
      'right_iris_min_x', 'right_iris_min_y', 'right_iris_max_x', 'right_iris_max_y',
      // Face landmark parameters
      'nose_position_x', 'nose_position_y', 'chin_position_x', 'chin_position_y',
      'cheek_left_position_x', 'cheek_left_position_y', 'cheek_right_position_x', 'cheek_right_position_y',
      'mouth_left_position_x', 'mouth_left_position_y', 'mouth_right_position_x', 'mouth_right_position_y',
      // Eye state parameters
      'left_eye_state', 'left_eye_ear', 'right_eye_state', 'right_eye_ear',
      // Depth parameters
      'distance_cm_from_face', 'distance_cm_from_eye', 'chin_depth',
      // Derived parameters
      'posture', 'gaze_direction'
    ];
    
    fieldsToPreserve.forEach(field => {
      if (originalParams.has(field)) {
        console.log(`Preserving original ${field}=${originalParams.get(field)}`);
        csvContent += `${field},${originalParams.get(field)}\n`;
      }
    });
    
    // Add a note about processing
    csvContent += 'processing_note,Face detection failed but preserved original values\n';
  } else {
    // No metrics and no original data, add placeholder information
    console.log("No metrics and no original data, adding placeholder");
    csvContent += 'info,No face detected or processing failed\n';
    csvContent += 'face_detected,false\n';
    csvContent += 'processing_time,' + new Date().toISOString() + '\n';
  }
  
  // Log the final CSV content for debugging
  console.log(`Final parameter file content:\n${csvContent}`);
  
  // Write the updated CSV file
  fs.writeFileSync(paramDestPath, csvContent);
  console.log(`Wrote updated parameter file to: ${paramDestPath}`);
  
  // Verify the file was written
  if (fs.existsSync(paramDestPath)) {
    console.log(`Parameter file successfully updated: ${paramDestPath}`);
    return true;
  } else {
    console.error(`Failed to create parameter file: ${paramDestPath}`);
    return false;
  }
}

// Function to process files via the FastAPI backend
async function processFilesViaBackend(setNumbers) {
  try {
    // Get the backend URL from environment variable or use default
    const backendUrl = process.env.BACKEND_URL;
    const apiKey = process.env.API_KEY;
    
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
// Function to process files directly in Node.js
async function processFilesDirectly(setNumbers, captureDir, enhancePath, progressFilePath) {
  try {
    console.log("=== STARTING DIRECT PROCESSING ===");
    console.log(`Processing sets: ${setNumbers.join(', ')}`);
    console.log(`Capture directory: ${captureDir}`);
    console.log(`Enhance directory: ${enhancePath}`);
    
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
        console.log(`\n--- Processing set ${setNumber} ---`);
        progress.currentSet = setNumber;
        fs.writeFileSync(progressFilePath, JSON.stringify(progress, null, 2));
        console.log(`Updated progress file for set ${setNumber}`);
        
        // Process webcam image
        const webcamSrcPath = path.join(captureDir, `webcam_${setNumber}.jpg`);
        const webcamDestPath = path.join(enhancePath, `webcam_enhance_${setNumber}.jpg`);
        
        console.log(`Looking for webcam image at: ${webcamSrcPath}`);
        
        if (fs.existsSync(webcamSrcPath)) {
          console.log(`Found webcam image: ${webcamSrcPath}`);
          
          try {
            // Process the image through the Python backend
            console.log(`Sending webcam image for set ${setNumber} to process_image_handler`);
            
            // We're passing the capture directory and enhance path to help with parameter file handling
            const metrics = await processImageWithPython(webcamSrcPath, webcamDestPath, setNumber, captureDir, enhancePath);
            
            if (metrics) {
              console.log(`✅ Successfully processed webcam image and extracted metrics for set ${setNumber}`);
            } else {
              console.warn(`⚠️ Process completed but no metrics returned for set ${setNumber}`);
              
              // Ensure the image is copied even if no metrics were returned
              if (!fs.existsSync(webcamDestPath)) {
                fs.copyFileSync(webcamSrcPath, webcamDestPath);
                console.log(`Copied original webcam image as fallback for set ${setNumber}`);
              }
            }
          } catch (err) {
            console.error(`❌ Error processing webcam image for set ${setNumber}: ${err.message}`);
            console.error(err.stack);
            
            // Fallback to copying the original file
            console.log(`Copying original webcam image as fallback for set ${setNumber}`);
            fs.copyFileSync(webcamSrcPath, webcamDestPath);
          }
        } else {
          console.warn(`⚠️ Webcam image not found for set ${setNumber}: ${webcamSrcPath}`);
        }
        
        // Process screen image if it exists
        const screenSrcPath = path.join(captureDir, `screen_${setNumber}.jpg`);
        const screenDestPath = path.join(enhancePath, `screen_enhance_${setNumber}.jpg`);
        
        console.log(`Looking for screen image at: ${screenSrcPath}`);
        if (fs.existsSync(screenSrcPath)) {
          console.log(`Screen image found: ${screenSrcPath}`);
          fs.copyFileSync(screenSrcPath, screenDestPath);
          console.log(`Copied screen image to: ${screenDestPath}`);
        } else {
          console.warn(`⚠️ Screen image not found for set ${setNumber}`);
        }
        
        // Verify that we have a parameter file for this set in the enhance directory
        const enhanceParamPath = path.join(enhancePath, `parameter_enhance_${setNumber}.csv`);
        if (!fs.existsSync(enhanceParamPath)) {
          console.log(`Parameter file not created during processing for set ${setNumber}, checking for original...`);
          await updateParameterFile(setNumber, null, captureDir, enhancePath);
        }
        
        // Update progress
        progress.processedSets.push(setNumber);
        progress.lastUpdateTime = new Date().toISOString();
        fs.writeFileSync(progressFilePath, JSON.stringify(progress, null, 2));
        console.log(`Updated progress - set ${setNumber} completed`);
        
        // Add a small delay to prevent overwhelming the system
        console.log(`Waiting 500ms before processing next set...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`❌ Error processing set ${setNumber}:`, err);
      }
    }
    
    console.log("\n=== PROCESSING COMPLETED ===");
    console.log(`Total sets processed: ${progress.processedSets.length}/${progress.totalSets}`);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error in direct processing:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to copy parameter files
async function copyParameterFile(captureDir, enhancePath, setNumber) {
  // Try both parameter and parameters naming
  const paramFileNames = [
    `parameters_${setNumber}.csv`,
    `parameter_${setNumber}.csv`
  ];
  
  let paramFound = false;
  for (const paramFileName of paramFileNames) {
    const paramSrcPath = path.join(captureDir, paramFileName);
    console.log(`Looking for parameter file at: ${paramSrcPath}`);
    
    if (fs.existsSync(paramSrcPath)) {
      console.log(`Parameter file found: ${paramSrcPath}`);
      paramFound = true;
      
      // Determine destination name (change parameter to parameter_enhance)
      const destFileName = 'parameter_enhance_' + setNumber + '.csv';
      const paramDestPath = path.join(enhancePath, destFileName);
      
      console.log(`Copying parameter file to: ${paramDestPath}`);
      fs.copyFileSync(paramSrcPath, paramDestPath);
      
      // Verify parameter file copy
      if (fs.existsSync(paramDestPath)) {
        console.log(`✅ Parameter file copied successfully`);
        
        // Read content to verify
        try {
          const content = fs.readFileSync(paramDestPath, 'utf8');
          const firstLine = content.split('\n')[0];
          console.log(`Parameter file content starts with: ${firstLine}`);
        } catch (readErr) {
          console.error(`Error reading parameter file: ${readErr.message}`);
        }
      } else {
        console.error(`❌ Error: Parameter destination file doesn't exist after copy!`);
      }
      
      break; // Found and copied one parameter file, no need to check the other
    }
  }
  
  if (!paramFound) {
    console.log(`⚠️ No parameter files found for set ${setNumber}`);
    
    // Create an empty parameter file if none exists
    const paramDestPath = path.join(enhancePath, `parameter_enhance_${setNumber}.csv`);
    const emptyContent = 'Parameter,Value\ninfo,No face detected or processing failed\n';
    fs.writeFileSync(paramDestPath, emptyContent);
    console.log(`⚠️ Created empty parameter file: ${paramDestPath}`);
  }
}

// Main handler for API requests
export default async function handler(req, res) {
  res.status(200).json({ message: "API endpoint working!" });
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
      
      // Check if there's already a lock file
      const lockFilePath = path.join(capturesDir, 'processing.lock');
      if (fs.existsSync(lockFilePath)) {
        return res.status(409).json({
          success: false,
          error: 'Processing is already in progress'
        });
      }
      
      // Create lock file to indicate processing is in progress
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