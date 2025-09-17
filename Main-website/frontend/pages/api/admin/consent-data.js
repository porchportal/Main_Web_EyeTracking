export default async function handler(req, res) {
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

  if (req.method === 'GET') {
    try {
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

      const existingData = await response.json();
      
      return res.status(200).json(existingData);
    } catch (error) {
      console.error('Error reading consent data from auth service:', error);
      return res.status(500).json({ error: 'Failed to read consent data' });
    }
  } else if (req.method === 'POST') {
    try {
      const consentData = req.body;
      
      const response = await fetch(`${authServiceUrl}/consent/admin/consent-data`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(consentData),
      });

      if (!response.ok) {
        throw new Error(`Auth service responded with status: ${response.status}`);
      }

      const result = await response.json();
      
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error saving consent data to auth service:', error);
      return res.status(500).json({ error: 'Failed to save consent data' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 