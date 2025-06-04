import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename } = req.query;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    // Determine if this is an enhanced image
    const isEnhanced = filename.includes('_enhance_');
    
    // Set the base directory based on whether it's an enhanced image
    const baseDir = isEnhanced 
      ? path.join(process.cwd(), 'public', 'captures', 'enhance')
      : path.join(process.cwd(), 'public', 'captures', 'eye_tracking_captures');

    const filePath = path.join(baseDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false,
        error: '404: File not found',
        message: 'Failed to get preview'
      });
    }

    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/jpeg'; // default
    
    if (ext === '.csv') {
      contentType = 'text/csv';
      // For CSV files, send as text
      const textContent = fileBuffer.toString('utf-8');
      return res.status(200).json({
        success: true,
        type: 'text',
        data: textContent
      });
    } else if (ext === '.png') {
      contentType = 'image/png';
    }

    // For images, convert to base64
    const base64Data = fileBuffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64Data}`;

    return res.status(200).json({
      success: true,
      type: 'image',
      data: dataUrl
    });

  } catch (error) {
    console.error('Error in preview-api:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message,
      message: 'Failed to get preview'
    });
  }
} 