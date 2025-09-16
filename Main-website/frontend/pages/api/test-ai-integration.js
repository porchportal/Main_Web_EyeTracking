// test-ai-integration.js - Test endpoint to verify AI integration
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Test the backend connection
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8001';
    
    console.log("Testing backend connection to:", backendUrl);
    
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Backend health check failed: ${response.status}`);
    }
    
    const healthData = await response.json();
    
    return res.status(200).json({
      success: true,
      message: 'AI integration test successful',
      backend: {
        url: backendUrl,
        status: 'connected',
        health: healthData
      },
      endpoints: {
        individualProcessing: `${backendUrl}/process-single-image`,
        batchProcessing: `${backendUrl}/process-images`,
        health: `${backendUrl}/health`
      }
    });
    
  } catch (error) {
    console.error('AI integration test failed:', error);
    return res.status(500).json({
      success: false,
      error: 'AI integration test failed',
      message: error.message,
      backend: {
        url: process.env.BACKEND_URL || 'http://localhost:8001',
        status: 'disconnected'
      }
    });
  }
}
