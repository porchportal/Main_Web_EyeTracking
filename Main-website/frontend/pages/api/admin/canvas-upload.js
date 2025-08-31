import { formidable } from 'formidable';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      keepExtensions: true,
      multiples: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      uploadDir: '/tmp', // Use temp directory
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Formidable parse error:', err);
          reject(err);
        }
        resolve([fields, files]);
      });
    });

    console.log('Parsed fields:', fields);
    console.log('Parsed files:', files);

    const userId = Array.isArray(fields.userId) ? fields.userId[0] : fields.userId;
    const fileCount = parseInt(Array.isArray(fields.fileCount) ? fields.fileCount[0] : fields.fileCount, 10);

    if (!userId) {
      return res.status(400).json({ error: 'No user ID provided' });
    }

    if (!fileCount || fileCount <= 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Get the backend URL and API key from environment variables
    const backendUrl = process.env.BACKEND_URL || 'http://localhost';
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';

    // Prepare form data for backend using form-data package
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('user_id', userId);

    // Add files to form data
    for (let i = 0; i < fileCount; i++) {
      const fileKey = `image_${i}`;
      const file = files[fileKey];
      
      if (!file) {
        console.log(`No file found for key: ${fileKey}`);
        continue;
      }

      // Handle both single file and array of files
      const fileArray = Array.isArray(file) ? file : [file];
      
      for (const singleFile of fileArray) {
        if (!singleFile || !singleFile.filepath) {
          console.log('Invalid file object:', singleFile);
          continue;
        }

        // Create a proper file stream for the backend
        const fileStream = fs.createReadStream(singleFile.filepath);
        formData.append('files', fileStream, {
          filename: singleFile.originalFilename,
          contentType: singleFile.mimetype || 'image/jpeg'
        });
        
        // Don't delete temp file immediately - let the stream finish
        // fs.unlinkSync(singleFile.filepath);
      }
    }

    console.log('Uploading files to backend canvas service...');
    console.log('FormData created with user_id:', userId);
    console.log('Number of files to upload:', fileCount);

    // Send to backend canvas service using node-fetch
    const fetch = require('node-fetch');
    console.log('Sending request to:', `${backendUrl}/api/canvas-admin/upload-images`);
    console.log('Request headers:', {
      'X-API-Key': apiKey,
      ...formData.getHeaders()
    });
    
    let backendResponse;
    try {
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      backendResponse = await fetch(`${backendUrl}/api/canvas-admin/upload-images`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          ...formData.getHeaders()
        },
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Clean up temp files after successful request
      for (let i = 0; i < fileCount; i++) {
        const fileKey = `image_${i}`;
        const file = files[fileKey];
        
        if (file) {
          const fileArray = Array.isArray(file) ? file : [file];
          for (const singleFile of fileArray) {
            if (singleFile && singleFile.filepath && fs.existsSync(singleFile.filepath)) {
              try {
                fs.unlinkSync(singleFile.filepath);
              } catch (unlinkError) {
                console.log('Error cleaning up temp file:', unlinkError);
              }
            }
          }
        }
      }
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      
      // Clean up temp files even on error
      for (let i = 0; i < fileCount; i++) {
        const fileKey = `image_${i}`;
        const file = files[fileKey];
        
        if (file) {
          const fileArray = Array.isArray(file) ? file : [file];
          for (const singleFile of fileArray) {
            if (singleFile && singleFile.filepath && fs.existsSync(singleFile.filepath)) {
              try {
                fs.unlinkSync(singleFile.filepath);
              } catch (unlinkError) {
                console.log('Error cleaning up temp file:', unlinkError);
              }
            }
          }
        }
      }
      
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timeout: The upload took too long to complete');
      }
      throw new Error(`Network error: ${fetchError.message}`);
    }
    
    console.log('Backend response status:', backendResponse.status);
    console.log('Backend response headers:', backendResponse.headers.raw());

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      console.error('Backend canvas response error:', errorData);
      
      // Handle validation errors properly
      if (errorData.detail && Array.isArray(errorData.detail)) {
        const errorMessages = errorData.detail.map(err => err.msg).join(', ');
        throw new Error(`Validation error: ${errorMessages}`);
      } else if (errorData.detail) {
        throw new Error(`Backend error: ${errorData.detail}`);
      } else if (errorData.error) {
        throw new Error(`Backend error: ${errorData.error}`);
      } else {
        throw new Error(`Failed to upload to canvas service (HTTP ${backendResponse.status})`);
      }
    }

    const backendData = await backendResponse.json();
    console.log('Backend canvas upload successful:', backendData);

    // Get existing images to merge with new ones
    let existingImages = {};
    try {
      const existingResponse = await fetch(`${backendUrl}/api/data-center/settings/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        }
      });
      
      if (existingResponse.ok) {
        const existingData = await existingResponse.json();
        existingImages = existingData.data?.image_pdf_canva || {};
      }
    } catch (error) {
      console.log('Could not fetch existing images, starting fresh:', error.message);
    }

    // Merge existing and new images
    const mergedImagePaths = { ...existingImages, ...backendData.data };

    // Convert to the new format: image_path_1, image_path_2, etc.
    const newImageFormat = {};
    Object.entries(mergedImagePaths).forEach(([key, path], index) => {
      newImageFormat[`image_path_${index + 1}`] = path;
    });

    // Prepare the data structure for the new MongoDB format
    const updateData = {
      userId: userId,
      type: 'settings',
      data: {
        image_path: existingImages.image_path || Object.values(backendData.data)[0] || '/asfgrebvxcv',
        updateImage: existingImages.updateImage || Object.values(backendData.data)[0]?.split('/').pop() || 'image.jpg',
        image_pdf_canva: newImageFormat,
        updated_at: new Date().toISOString()
      }
    };

    console.log('Sending updated data to backend:', updateData);

    // Send the updated image paths to the backend API
    const settingsResponse = await fetch(`${backendUrl}/api/admin/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(updateData)
    });

    if (!settingsResponse.ok) {
      const errorData = await settingsResponse.json().catch(() => ({}));
      console.error('Settings update response error:', errorData);
      throw new Error(errorData.detail || errorData.error || 'Failed to update settings');
    }

    const settingsData = await settingsResponse.json();
    console.log('Settings update successful:', settingsData);

    res.status(200).json({ 
      success: true,
      imagePaths: backendData.data, // Return the formatted data for frontend processing
      uploaded_images: backendData.uploaded_images, // Pass through uploaded images info
      data: backendData.data, // Pass through the formatted data
      message: 'Images uploaded successfully to canvas service',
      backendData,
      settingsData
    });
  } catch (error) {
    console.error('Error uploading images to canvas:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to upload images to canvas',
      details: error.stack
    });
  }
}
