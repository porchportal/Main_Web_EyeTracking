export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename } = req.query;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    // Get the backend URL and API key from environment variables
    const backendUrl = process.env.AUTH_SERVICE_URL;
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;

    if (!backendUrl) {
      throw new Error('BACKEND_URL environment variable is not set');
    }

    if (!apiKey) {
      throw new Error('NEXT_PUBLIC_API_KEY environment variable is not set');
    }

    // Fetch the image from the backend canvas service
    const response = await fetch(`${backendUrl}/api/canvas-admin/canvas/${filename}`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'Image not found' });
      }
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Set appropriate headers for image serving
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Content-Length', imageBuffer.byteLength);

    // Send the image data
    res.status(200).send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error('Error serving canvas image:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to serve canvas image'
    });
  }
}
