export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { setNumbers, enhanceFace } = req.body;
    const { userId } = req.query;

    // Debug logging
    console.log(`aprocess-file API received: setNumbers=${JSON.stringify(setNumbers)}, enhanceFace=${enhanceFace} (type: ${typeof enhanceFace}), userId=${userId}`);

    if (!setNumbers || !Array.isArray(setNumbers)) {
      return res.status(400).json({ error: 'Invalid set numbers' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (typeof enhanceFace !== 'boolean') {
      return res.status(400).json({ error: 'enhanceFace parameter must be a boolean value' });
    }

    // Get auth service URL from environment (which includes image processing)
    const authServiceUrl = process.env.AUTH_SERVICE_URL;
    const apiKey = process.env.BACKEND_API_KEY ;

    // Set headers for streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Call the auth service backend which handles image processing
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for image processing
    
    const response = await fetch(`${authServiceUrl}/api/queue-processing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        user_id: userId,
        set_numbers: setNumbers,
        enhanceFace: enhanceFace
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Auth service returned ${response.status}: ${errorText}`);
      return res.status(response.status).json({ 
        success: false, 
        error: `Backend service error: ${response.status} ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();
    
    // Return the response directly instead of streaming
    return res.status(200).json({
      success: true,
      data: data,
      results: data.results || [data]
    });
  } catch (error) {
    console.error('Error in process-files API:', error);
    if (error.name === 'AbortError') {
      res.status(408).json({ error: 'Request timeout - image processing took too long' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}
