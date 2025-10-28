export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    return res.status(200).end();
  }

  // Get auth service URL and API key
  const authServiceUrl = process.env.AUTH_SERVICE_URL;
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;

  // Validate required environment variables
  if (!authServiceUrl) {
    console.error('AUTH_SERVICE_URL environment variable is not set');
    return res.status(500).json({ error: 'Server configuration error: AUTH_SERVICE_URL not configured' });
  }

  if (!apiKey) {
    console.error('NEXT_PUBLIC_API_KEY environment variable is not set');
    return res.status(500).json({ error: 'Server configuration error: API key not configured' });
  }

  if (req.method === 'POST') {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      // Fetch consent data from auth service
      const response = await fetch(`${authServiceUrl}/consent/admin/consent-data`, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Auth service responded with status: ${response.status}`);
      }

      const consentData = await response.json();

      // Check if userId exists in the consent data
      const userExists = Array.isArray(consentData) && consentData.some(entry => entry.userId === userId);

      return res.status(200).json({
        exists: userExists,
        userId: userId
      });
    } catch (error) {
      console.error('Error checking consent data:', error);
      return res.status(500).json({
        error: 'Failed to check consent data',
        exists: false
      });
    }
  } else {
    console.warn(`Method ${req.method} not allowed for /api/consent/check`);
    return res.status(405).json({
      error: 'Method not allowed',
      message: `${req.method} is not supported. Use POST instead.`,
      allowedMethods: ['POST', 'OPTIONS']
    });
  }
}
