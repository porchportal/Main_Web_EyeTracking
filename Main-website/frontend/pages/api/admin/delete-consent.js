import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Check if the request method is POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for API key
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.NEXT_PUBLIC_API_KEY;
  
  // Validate required environment variables
  if (!expectedApiKey) {
    console.error('NEXT_PUBLIC_API_KEY environment variable is not set');
    return res.status(500).json({ error: 'Server configuration error: API key not configured' });
  }
  
  if (!apiKey || apiKey !== expectedApiKey) {
    console.error('API Key validation failed:', {
      received: apiKey,
      expected: expectedApiKey
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Get auth service URL
    const authServiceUrl = process.env.AUTH_SERVICE_URL;

    // Validate auth service URL
    if (!authServiceUrl) {
      console.error('AUTH_SERVICE_URL environment variable is not set');
      return res.status(500).json({ error: 'Server configuration error: AUTH_SERVICE_URL not configured' });
    }

    // Delete from admin consent file via auth service
    const response = await fetch(`${authServiceUrl}/consent/admin/consent-data/${userId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': expectedApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Auth service responded with status: ${response.status}`);
    }


    // Delete from individual consent file (keep this local as it's in frontend public folder)
    const consentDir = path.join(process.cwd(), 'public', 'consent');
    const userConsentFile = path.join(consentDir, `consent_${userId}.json`);

    if (fs.existsSync(userConsentFile)) {
      fs.unlinkSync(userConsentFile);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting consent data:', error);
    return res.status(500).json({ error: 'Failed to delete consent data' });
  }
} 