import { formidable } from 'formidable';
import fs from 'fs';
import path from 'path';

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
      maxFileSize: 50 * 1024 * 1024, // 50mb
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

    // Create canva directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'public', 'canva');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Process each file
    const imagePaths = {};
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

        // Generate unique filename
        const timestamp = Date.now();
        const originalName = singleFile.originalFilename || `image_${i}.jpg`;
        const filename = `${timestamp}-${originalName}`;
        const filepath = path.join(uploadDir, filename);

        try {
          // Move file to public directory
          fs.copyFileSync(singleFile.filepath, filepath);
          fs.unlinkSync(singleFile.filepath); // Remove temporary file

          // Store the relative path
          const imagePath = `/canva/${filename}`;
          imagePaths[`Image_path_${i + 1}`] = imagePath;
          
          console.log(`Successfully processed file: ${filename}`);
        } catch (fileError) {
          console.error(`Error processing file ${originalName}:`, fileError);
          throw new Error(`Failed to process file ${originalName}: ${fileError.message}`);
        }
      }
    }

    if (Object.keys(imagePaths).length === 0) {
      return res.status(400).json({ error: 'No valid files were processed' });
    }

    // Get the backend URL and API key from environment variables
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';

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

    // Generate unique keys for new images to avoid conflicts
    const existingKeys = Object.keys(existingImages);
    const newImagePaths = {};
    
    Object.entries(imagePaths).forEach(([key, path], index) => {
      let newKey = key;
      let counter = 1;
      
      // Find a unique key
      while (existingKeys.includes(newKey)) {
        newKey = `${key}_${counter}`;
        counter++;
      }
      
      newImagePaths[newKey] = path;
    });

    // Merge existing and new images
    const mergedImagePaths = { ...existingImages, ...newImagePaths };

    // Prepare the data structure for the new MongoDB format
    const updateData = {
      userId: userId,
      type: 'settings',
      data: {
        image_path: existingImages.image_path || newImagePaths['Image_path_1'] || Object.values(newImagePaths)[0],
        updateImage: existingImages.updateImage || Object.values(newImagePaths)[0]?.split('/').pop() || 'image.jpg',
        image_pdf_canva: mergedImagePaths,
        updated_at: new Date().toISOString()
      }
    };

    console.log('Sending data to backend:', updateData);

    // Send the image paths to the backend API
    const backendResponse = await fetch(`${backendUrl}/api/admin/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(updateData)
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      console.error('Backend response error:', errorData);
      throw new Error(errorData.detail || errorData.error || 'Failed to update backend');
    }

    const backendData = await backendResponse.json();
    console.log('Backend update successful:', backendData);

    res.status(200).json({ 
      success: true,
      imagePaths: newImagePaths, // Return only the new images for frontend processing
      message: 'Images uploaded successfully',
      backendData
    });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to upload images',
      details: error.stack
    });
  }
} 