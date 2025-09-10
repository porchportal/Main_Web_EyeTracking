// Test endpoint to verify user-captures backend connection
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const BACKEND_URL = process.env.BACKEND_URL || 'http://backend_auth_service:8108';
    
    console.log('🔍 Testing user-captures backend connection...');
    console.log('Backend URL:', BACKEND_URL);
    
    // Test the health endpoint first
    const healthResponse = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      headers: {
        'X-API-Key': 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
      }
    });
    
    console.log('Health check status:', healthResponse.status);
    
    if (!healthResponse.ok) {
      const healthError = await healthResponse.text();
      console.error('Health check failed:', healthError);
      return res.status(500).json({
        success: false,
        error: 'Backend health check failed',
        details: healthError
      });
    }
    
    const healthData = await healthResponse.json();
    console.log('Health check response:', healthData);
    
    // Test user-captures endpoint with a dummy request
    const testUserId = 'test-user-123';
    const testData = {
      imageData: 'data:text/csv;base64,dGVzdCxkYXRh',
      filename: 'test_001.csv',
      type: 'parameters',
      captureGroup: 'test-group'
    };
    
    console.log('Testing user-captures save endpoint...');
    
    const saveResponse = await fetch(`${BACKEND_URL}/api/user-captures/save/${testUserId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV'
      },
      body: JSON.stringify(testData)
    });
    
    console.log('Save test status:', saveResponse.status);
    
    if (!saveResponse.ok) {
      const saveError = await saveResponse.text();
      console.error('Save test failed:', saveError);
      return res.status(500).json({
        success: false,
        error: 'User-captures save test failed',
        details: saveError,
        status: saveResponse.status
      });
    }
    
    const saveData = await saveResponse.json();
    console.log('Save test response:', saveData);
    
    return res.status(200).json({
      success: true,
      message: 'Backend connection test successful',
      health: healthData,
      saveTest: saveData
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
