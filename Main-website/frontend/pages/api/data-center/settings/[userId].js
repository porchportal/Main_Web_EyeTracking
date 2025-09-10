export default async function handler(req, res) {
  const { userId } = req.query;
  const { method } = req;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Use direct backend service URL for server-side calls
    const backendUrl = process.env.AUTH_SERVICE_URL;

    // GET - Retrieve user settings
    if (method === 'GET') {
      const response = await fetch(`${backendUrl}/api/data-center/settings/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }

      const data = await response.json();
      return res.status(200).json({ success: true, data });
    }

    // POST - Update user settings
    if (method === 'POST') {
      const settings = req.body;

      const response = await fetch(`${backendUrl}/api/data-center/settings/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }

      const data = await response.json();
      return res.status(200).json({ success: true, data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in settings API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 