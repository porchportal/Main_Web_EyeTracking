import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const baseDir = path.join(process.cwd(), 'res');
    const captureDir = path.join(baseDir, 'eye_tracking_captures');

    // Check if directories exist
    try {
      await fs.access(captureDir);
    } catch (error) {
      return res.status(200).json({
        success: true,
        files: {
          capture: []
        }
      });
    }

    // Read files from eye_tracking_captures directory
    const captureFiles = await fs.readdir(captureDir);
    const captureFilesInfo = captureFiles
      .filter(file => file.endsWith('.csv'))
      .map(file => ({
        filename: file,
        path: path.join('eye_tracking_captures', file)
      }));

    return res.status(200).json({
      success: true,
      files: {
        capture: captureFilesInfo
      }
    });
  } catch (error) {
    console.error('Error checking files:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
} 