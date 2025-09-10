// pages/api/user-captures/status/[userId].js
// Use direct backend URL instead of nginx proxy to avoid circular routing
const BACKEND_URL = process.env.AUTH_SERVICE_URL;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;

    console.log('🔍 Frontend API received status request for user:', userId);

    // Forward the request to the backend via nginx
    const backendResponse = await fetch(`${BACKEND_URL}/api/user-captures/status/${userId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': req.headers['x-api-key'] || req.headers['X-API-Key'] || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
      }
    });

    console.log(`📥 Backend status response: ${backendResponse.status} ${backendResponse.statusText}`);

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      console.error('❌ Backend error response:', errorData);
      return res.status(backendResponse.status).json({
        success: false,
        detail: errorData.detail || `Backend returned ${backendResponse.status}`
      });
    }

    const result = await backendResponse.json();
    console.log(`✅ Successfully forwarded status request to backend for user ${userId}:`, result);
    
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Error in user-captures status API:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
    return res.status(500).json({
      success: false,
      detail: error.message
    });
  }
}
