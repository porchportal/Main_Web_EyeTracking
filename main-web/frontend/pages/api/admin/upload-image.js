import formidable from 'formidable';
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
    const form = new formidable.IncomingForm();
    form.keepExtensions = true;
    form.multiples = true;

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const userId = fields.userId;
    const fileCount = parseInt(fields.fileCount, 10);

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
      const file = files[`image_${i}`];
      if (!file) continue;

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.originalFilename}`;
      const filepath = path.join(uploadDir, filename);

      // Move file to public directory
      fs.copyFileSync(file.filepath, filepath);
      fs.unlinkSync(file.filepath); // Remove temporary file

      // Store the relative path
      const imagePath = `/canva/${filename}`;
      imagePaths[`Image_path_${i + 1}`] = imagePath;
    }

    // Send the image paths to the backend API
    const backendResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.API_KEY
      },
      body: JSON.stringify({
        userId: userId,
        type: 'settings',
        data: {
          'value.image_path': imagePaths['Image_path_1'],
          'value.updateImage': Object.values(imagePaths)[0].split('/').pop(),
          'image&pdf_canva': imagePaths,
          updated_at: new Date().toISOString()
        }
      })
    });

    if (!backendResponse.ok) {
      throw new Error('Failed to update backend');
    }

    res.status(200).json({ imagePaths });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
} 