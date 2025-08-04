export default async function handler(req, res) {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80';
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';

  try {
    if (req.method === 'GET') {
      // Get settings for user
      const response = await fetch(`${backendUrl}/api/data-center/settings/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json(errorData);
      }

      const data = await response.json();
      return res.status(200).json(data);
    } else if (req.method === 'POST') {
      // Update settings for user
      const response = await fetch(`${backendUrl}/api/data-center/settings/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify(req.body)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json(errorData);
      }

      const data = await response.json();
      return res.status(200).json(data);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in data-center settings API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 