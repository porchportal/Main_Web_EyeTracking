// pages/api/user-captures/clear/[userId].js
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8108';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;

    // Forward the request to the backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/user-captures/clear/${userId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': req.headers['x-api-key'] || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
      }
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      console.error('Backend error:', errorData);
      return res.status(backendResponse.status).json({
        success: false,
        detail: errorData.detail || `Backend returned ${backendResponse.status}`
      });
    }

    const result = await backendResponse.json();
    console.log(`✅ Forwarded clear request to backend for user ${userId}:`, result);
    
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Error in user-captures clear API:', error);
    return res.status(500).json({
      success: false,
      detail: error.message
    });
  }
}
