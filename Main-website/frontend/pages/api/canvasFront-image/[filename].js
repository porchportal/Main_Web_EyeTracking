export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename } = req.query;
    
    console.log(`[Canvas API] Request for filename: ${filename}`);
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    // Get the backend URL from environment variables
    const backendUrl = process.env.BACKEND_URL || 'http://nginx:80';
    const fullUrl = `${backendUrl}/api/canvas-image/${filename}`;
    
    console.log(`[Canvas API] Fetching from backend: ${fullUrl}`);

    // Fetch the image from the backend canvas service
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'Next.js-Frontend'
      }
    });

    console.log(`[Canvas API] Backend response status: ${response.status}`);

    if (!response.ok) {
      console.error(`[Canvas API] Backend error: ${response.status} ${response.statusText}`);
      if (response.status === 404) {
        return res.status(404).json({ error: 'Image not found' });
      }
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    console.log(`[Canvas API] Successfully fetched image: ${filename}, size: ${imageBuffer.byteLength} bytes, type: ${contentType}`);

    // Set appropriate headers for image serving
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Content-Length', imageBuffer.byteLength);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Send the image data
    res.status(200).send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error('Error serving canvas image:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to serve canvas image'
    });
  }
}
