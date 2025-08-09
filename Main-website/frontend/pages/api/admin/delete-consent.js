import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Check if the request method is POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for API key
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';
  
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
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth_service:8108';

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

    console.log(`Deleted consent data for user ${userId} via auth service`);

    // Delete from individual consent file (keep this local as it's in frontend public folder)
    const consentDir = path.join(process.cwd(), 'public', 'consent');
    const userConsentFile = path.join(consentDir, `consent_${userId}.json`);

    if (fs.existsSync(userConsentFile)) {
      fs.unlinkSync(userConsentFile);
      console.log(`Deleted individual consent file for user ${userId}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting consent data:', error);
    return res.status(500).json({ error: 'Failed to delete consent data' });
  }
} 