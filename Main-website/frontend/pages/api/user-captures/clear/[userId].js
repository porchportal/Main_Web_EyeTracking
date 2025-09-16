// pages/api/user-captures/clear/[userId].js
// Use direct backend URL instead of nginx proxy to avoid circular routing
const BACKEND_URL = process.env.AUTH_SERVICE_URL;

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;

    // Forward the request to the backend via nginx
    const backendResponse = await fetch(`${BACKEND_URL}/api/user-captures/clear/${userId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': req.headers['x-api-key'] || req.headers['X-API-Key'] || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
      }
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return res.status(backendResponse.status).json({
        success: false,
        detail: errorData.detail || `Backend returned ${backendResponse.status}`
      });
    }

    const result = await backendResponse.json();
    
    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      success: false,
      detail: error.message
    });
  }
}
