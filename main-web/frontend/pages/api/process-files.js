import { process_images } from '../../../backend/process_images';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { setNumbers } = req.body;

    if (!setNumbers || !Array.isArray(setNumbers)) {
      return res.status(400).json({ error: 'Invalid set numbers' });
    }

    // Set headers for streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Process images and stream updates
    for await (const update of process_images(setNumbers)) {
      res.write(JSON.stringify(update) + '\n');
    }

    res.end();
  } catch (error) {
    console.error('Error in process-files API:', error);
    res.status(500).json({ error: error.message });
  }
} 