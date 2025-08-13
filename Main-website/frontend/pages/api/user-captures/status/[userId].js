// pages/api/user-captures/status/[userId].js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;

    // Get backend URL from environment or use default
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8108';
    
    // Forward the request to the backend
    const response = await fetch(`${backendUrl}/api/user-captures/status/${userId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': process.env.BACKEND_API_KEY || 'your-backend-api-key'
      }
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in user-captures status proxy:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
