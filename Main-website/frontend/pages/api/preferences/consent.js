// frontend/pages/api/preferences/consent.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Get the backend URL and API key from environment variables
  const backendUrl = process.env.AUTH_SERVICE_URL || 'http://backend_auth_service:8108';
  const apiKey = process.env.BACKEND_API_KEY;
  
  console.log('🔧 Environment check:', {
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL,
    BACKEND_API_KEY: process.env.BACKEND_API_KEY ? 'SET' : 'NOT SET',
    backendUrl,
    apiKey: apiKey ? 'SET' : 'NOT SET'
  });

  // Check if API key is available
  if (!apiKey) {
    console.error('❌ BACKEND_API_KEY is not set in environment variables');
    return res.status(500).json({
      success: false,
      message: 'API key not configured'
    });
  }

  try {
    if (req.method === 'GET') {
      // Get user consent status from backend
      const userId = req.query.userId;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }
      
      const response = await fetch(`${backendUrl}/consent/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        }
      });
      
      const data = await response.json();
      return res.status(response.ok ? 200 : 400).json(data);
      
    } else if (req.method === 'POST') {
      // Update user consent status
      const { userId, consentStatus } = req.body;
      
      console.log('📝 Frontend API received:', { userId, consentStatus });
      
      if (!userId || consentStatus === undefined) {
        console.log('❌ Missing required fields:', { userId, consentStatus });
        return res.status(400).json({
          success: false,
          message: 'User ID and consent status are required'
        });
      }
      
      const timestamp = new Date().toISOString();
      const requestBody = {
        consent_status: consentStatus,
        timestamp: timestamp
      };
      
      console.log('📤 Sending to backend:', requestBody);
      console.log('🔗 Backend URL:', `${backendUrl}/consent/${userId}`);
      
      const response = await fetch(`${backendUrl}/consent/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📥 Backend response status:', response.status);
      
      const data = await response.json();
      console.log('📥 Backend response data:', data);
      
      if (!response.ok) {
        console.log('❌ Backend error:', {
          status: response.status,
          data: data
        });
      } else {
        console.log('✅ Consent successfully saved to backend for user:', userId);
      }
      
      return res.status(response.ok ? 200 : 400).json(data);
      
    } else {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('Error communicating with backend:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to communicate with backend',
      error: error.message
    });
  }
}