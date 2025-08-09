export default async function handler(req, res) {
  // Get auth service URL
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth_service:8108';
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';

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
      console.log(`Retrieved ${existingData.length} consent records from auth service`);
      
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
      console.log(`Saved consent data for user ${consentData.userId} via auth service`);
      
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error saving consent data to auth service:', error);
      return res.status(500).json({ error: 'Failed to save consent data' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 